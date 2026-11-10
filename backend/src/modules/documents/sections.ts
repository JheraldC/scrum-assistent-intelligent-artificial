// Fragmentación y selección de texto de documentos para el contexto de la IA. Funciones puras.

export interface DocSection {
  /** Nombre citable de la sección (encabezado Markdown, «Página n» o «Fragmento n»). */
  title: string;
  text: string;
}

const MAX_SECTION_CHARS = 1200;

function chunk(title: string, text: string): DocSection[] {
  const body = text.trim();
  if (body === '') return [];
  if (body.length <= MAX_SECTION_CHARS) return [{ title, text: body }];
  const parts: DocSection[] = [];
  let n = 1;
  for (let i = 0; i < body.length; i += MAX_SECTION_CHARS) {
    parts.push({ title: `${title} (parte ${n})`, text: body.slice(i, i + MAX_SECTION_CHARS) });
    n += 1;
  }
  return parts;
}

/** Markdown: una sección por encabezado. Texto plano: «Página n» si hay saltos de página, si no, «Fragmento n». */
export function splitSections(text: string, fileName: string): DocSection[] {
  if (/\.md$/i.test(fileName)) {
    const sections: DocSection[] = [];
    let title = 'Inicio';
    let buffer: string[] = [];
    const flush = () => sections.push(...chunk(title, buffer.join('\n')));
    for (const line of text.split(/\r?\n/)) {
      const heading = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
      if (heading) {
        flush();
        title = heading[1]!.slice(0, 100);
        buffer = [];
      } else {
        buffer.push(line);
      }
    }
    flush();
    return sections;
  }
  if (text.includes('\f')) return text.split('\f').flatMap((page, i) => chunk(`Página ${i + 1}`, page));
  const paragraphs = text.split(/\n\s*\n/);
  const sections: DocSection[] = [];
  let current = '';
  const push = () => {
    if (current.trim() !== '') sections.push(...chunk(`Fragmento ${sections.length + 1}`, current));
    current = '';
  };
  for (const p of paragraphs) {
    if (current.length + p.length > MAX_SECTION_CHARS) push();
    current += `${current ? '\n\n' : ''}${p}`;
  }
  push();
  return sections;
}

const STOPWORDS = new Set(
  'para como pero porque cual cuales donde cuando esta este estos estas esto algo todo todos todas desde hasta sobre entre tiene tienen hacer debe deben puede pueden segun también tambien muy mas más del las los una uno unos unas con por que'.split(' '),
);

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function keywords(question: string): string[] {
  return [...new Set(fold(question).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4 && !STOPWORDS.has(w)))];
}

/** Puntúa una sección por coincidencia de palabras con la pregunta (título pesa el doble). */
export function scoreSection(section: DocSection, words: string[]): number {
  if (words.length === 0) return 0;
  const title = fold(section.title);
  const body = fold(section.text);
  return words.reduce((acc, w) => acc + (title.includes(w) ? 2 : 0) + (body.includes(w) ? 1 : 0), 0);
}

export interface RankedSection extends DocSection {
  document: string;
}

/** Las secciones más pertinentes (puntaje > 0) hasta agotar el presupuesto de caracteres. */
export function selectRelevant(docs: { name: string; sections: DocSection[] }[], question: string, budgetChars: number): RankedSection[] {
  const words = keywords(question);
  const scored = docs.flatMap((d) => d.sections.map((s) => ({ ...s, document: d.name, score: scoreSection(s, words) })));
  const picked: RankedSection[] = [];
  let used = 0;
  for (const s of scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score)) {
    if (used + s.text.length > budgetChars) continue;
    picked.push({ document: s.document, title: s.title, text: s.text });
    used += s.text.length;
  }
  return picked;
}
