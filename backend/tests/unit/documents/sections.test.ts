import { describe, expect, it } from 'vitest';
import { keywords, scoreSection, selectRelevant, splitSections } from '../../../src/modules/documents/index.js';

describe('fragmentación de documentos para la IA', () => {
  it('Markdown: una sección por encabezado, citable por su título', () => {
    const md = '# Requisitos\nEl sistema registra asistencia.\n\n## Reglas del negocio\nUna falta se justifica en 48 horas.\n\n## Arquitectura\nAPI REST y base de datos relacional.';
    const sections = splitSections(md, 'requisitos.md');
    expect(sections.map((s) => s.title)).toEqual(['Requisitos', 'Reglas del negocio', 'Arquitectura']);
    expect(sections[1]!.text).toContain('48 horas');
  });

  it('Markdown: el texto previo al primer encabezado va en «Inicio»', () => {
    expect(splitSections('Texto suelto\n# Título\nCuerpo', 'a.md').map((s) => s.title)).toEqual(['Inicio', 'Título']);
  });

  it('texto con saltos de página: una sección «Página n» por página', () => {
    const sections = splitSections('Página uno\fPágina dos\f\fPágina cuatro', 'a.txt');
    expect(sections.map((s) => s.title)).toEqual(['Página 1', 'Página 2', 'Página 4']);
  });

  it('texto plano largo: fragmentos de tamaño acotado', () => {
    const text = Array.from({ length: 40 }, (_, i) => `Párrafo número ${i} con bastante texto de relleno para ocupar espacio.`).join('\n\n');
    const sections = splitSections(text, 'a.txt');
    expect(sections.length).toBeGreaterThan(1);
    expect(sections.every((s) => s.text.length <= 1300)).toBe(true);
    expect(sections[0]!.title).toBe('Fragmento 1');
  });

  it('una sección enorme se parte en partes numeradas', () => {
    const sections = splitSections(`# Grande\n${'x'.repeat(3000)}`, 'a.md');
    expect(sections.map((s) => s.title)).toEqual(['Grande (parte 1)', 'Grande (parte 2)', 'Grande (parte 3)']);
  });

  it('un documento vacío no produce secciones', () => {
    expect(splitSections('   \n\n', 'a.txt')).toEqual([]);
    expect(splitSections('', 'a.md')).toEqual([]);
  });
});

describe('selección de fragmentos pertinentes', () => {
  const docs = [
    {
      name: 'Reglas del negocio',
      sections: [
        { title: 'Justificación de faltas', text: 'Una falta se justifica con un certificado en 48 horas.' },
        { title: 'Roles', text: 'El coordinador aprueba los reportes mensuales.' },
      ],
    },
  ];

  it('quita palabras vacías y acentos al extraer palabras clave', () => {
    expect(keywords('¿Cómo se justifica una FALTA para el reporte?')).toEqual(expect.arrayContaining(['justifica', 'falta', 'reporte']));
    expect(keywords('para como pero')).toEqual([]);
  });

  it('el título pesa más que el cuerpo', () => {
    const [a, b] = docs[0]!.sections;
    expect(scoreSection(a!, ['falta'])).toBeGreaterThan(scoreSection(b!, ['falta']));
  });

  it('elige solo lo pertinente y cita documento y sección', () => {
    const picked = selectRelevant(docs, '¿Cómo justifico una falta?', 5000);
    expect(picked).toEqual([{ document: 'Reglas del negocio', title: 'Justificación de faltas', text: expect.stringContaining('48 horas') }]);
  });

  it('sin coincidencias no se envía ningún fragmento', () => {
    expect(selectRelevant(docs, 'xyz qwerty', 5000)).toEqual([]);
  });

  it('respeta el presupuesto de caracteres', () => {
    expect(selectRelevant(docs, 'falta certificado coordinador reportes', 20)).toEqual([]);
  });
});
