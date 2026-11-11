import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createDb } from '../src/platform/db.js';

/**
 * Carga como datos el paquete «Sprint 7 Base Escritorio y Aportes» (ADEDUNSA / DerramaSoft .NET) en un
 * proyecto nuevo. Lee `data/sprint7-adedunsa/` (generado con `convertir.py`) y lo escribe con Prisma
 * en una sola transacción, a nombre de una cuenta YA EXISTENTE (no crea cuentas ni contraseñas).
 *
 *   npm run db:import-sprint7 -w backend -- --email persona@ejemplo.com [--name "Sistema Adedunsa Update"]
 *
 * Es una carga de datos de desarrollo: se niega a ejecutarse en producción y si ya existe un proyecto con
 * ese nombre para esa cuenta, no hace nada. El Sprint queda ABIERTO con sus artefactos: las compuertas no
 * se simulan; se evalúan con las reglas de la aplicación.
 */
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '..', '..', '.env'));
} catch {
  // Sin .env: se usan las variables del proceso.
}

if (process.env.NODE_ENV === 'production') {
  console.error('La carga de datos del Sprint 7 está prohibida en producción.');
  process.exit(1);
}

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const emails = args.flatMap((a, i) => (a === '--email' && args[i + 1] ? [args[i + 1] as string] : []));
const email = emails[0];
const replace = args.includes('--replace');
const projectName = arg('name') ?? 'Sistema Adedunsa Update';
if (!email) {
  console.error('Indique la cuenta dueña con --email (debe existir; este script no crea cuentas).');
  process.exit(1);
}

const DATA = path.resolve(import.meta.dirname, '..', '..', 'data', 'sprint7-adedunsa');
const text = (name: string) => readFileSync(path.join(DATA, 'documentos', name), 'utf-8').replaceAll('\r\n', '\n');
const cut = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);
const clean = (value: string | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

interface Backlog {
  meta: Record<string, string>;
  historias: Record<string, string>[];
  tareas: Record<string, string>[];
  paquetes: Record<string, string>[];
}
const key = (row: Record<string, string>, start: string) => row[Object.keys(row).find((k) => k.startsWith(start)) ?? ''] ?? '';
const backlog = JSON.parse(readFileSync(path.join(DATA, 'sprint_backlog.json'), 'utf-8')) as Backlog;

/** Hora de Perú (UTC-5) a instante UTC. */
const lima = (day: number, month: number, year: number, hour = 21, minute = 0) => new Date(Date.UTC(year, month - 1, day, hour + 5, minute));

// -----------------------------------------------------------------------------------------------
// Historias del Product Backlog
// -----------------------------------------------------------------------------------------------
function parseStory(raw: string) {
  const m = /^Como\s+(.+?),\s*(?:quiero|queremos)\s+(.+?),?\s+para\s+(.+?)\.?$/is.exec(clean(raw));
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  return { asA: cut(m[1], 200), iWant: cut(m[2], 500), soThat: cut(m[3], 500) };
}

function criteriaOf(raw: string): string[] {
  return raw
    .split(/[•\n]/)
    .map((c) => clean(c))
    .filter(Boolean)
    .slice(0, 20)
    .map((c) => cut(c, 300));
}

// -----------------------------------------------------------------------------------------------
// Daily: reuniones reconstruidas
// -----------------------------------------------------------------------------------------------
function dailyEntries() {
  const md = text('Sprint_Daily_07.md');
  const out: { at: Date; content: string }[] = [];
  const re = /Reunión (\d+) del (\d{2})\/(\d{2})\/(\d{4}) Avance (\d+) %\s+Trabajo: (.+?)\s+Siguiente acción: (.+?)(?:\n|$)/g;
  for (const m of md.matchAll(re)) {
    const [, n, d, mo, y, pct, work, next] = m;
    out.push({
      at: lima(Number(d), Number(mo), Number(y)),
      content: cut(`Reunión ${n} del ${d}/${mo}/${y} · avance ${pct} % (estimado)\nTrabajo: ${clean(work)}\nSiguiente acción: ${clean(next)}`, 2000),
    });
  }
  return out;
}

// -----------------------------------------------------------------------------------------------
// Retrospectiva
// -----------------------------------------------------------------------------------------------
function retroData() {
  const md = text('Sprint_Retrospective_07_DerramaSoft.md');
  const cell = (label: string) => {
    const m = new RegExp(`^\\| ${label} \\| (.+?) \\| (.+?) \\|$`, 'm').exec(md);
    return { fact: clean(m?.[1]), learning: clean(m?.[2]) };
  };
  const good = cell('Qué salió bien');
  const hard = cell('Qué dificultó el trabajo');
  const change = cell('Qué cambiaremos');
  const actions: { description: string; note: string }[] = [];
  for (const m of md.matchAll(/^\| (S07-M0[1-5]) \| (.+?) \| (.+?) \| (.+?) \| (.+?) \|$/gm)) {
    actions.push({ description: cut(`${m[1]} · ${clean(m[2])}`, 300), note: cut(`Responsable propuesto: ${clean(m[3])}. Fecha propuesta: ${clean(m[4])}. Estado en el documento: ${clean(m[5])}.`, 500) });
  }
  for (const m of md.matchAll(/^(S07-M0[6-8]) — Propuesta: (.+?) Responsables? propuestos?: (.+?)\. Estado: (.+?)\.?$/gm)) {
    actions.push({ description: cut(`${m[1]} · ${clean(m[2])}`, 300), note: cut(`Responsables propuestos: ${clean(m[3])}. Estado en el documento: ${clean(m[4])}.`, 500) });
  }
  return {
    positives: [cut(`${good.fact} → ${good.learning}`, 500)],
    problems: [cut(`${hard.fact} → ${hard.learning}`, 500)],
    improvements: [cut(`${change.fact} → ${change.learning}`, 500)],
    actions,
  };
}

// -----------------------------------------------------------------------------------------------
// Carga
// -----------------------------------------------------------------------------------------------
const db = createDb(process.env.DATABASE_URL ?? '');

async function main() {
  const owner = await db.user.findUnique({ where: { email } });
  if (!owner) throw new Error('No existe una cuenta con ese correo. Regístrela primero en la aplicación (el script no crea cuentas).');
  const others: NonNullable<typeof owner>[] = [];
  for (const e of emails.slice(1)) {
    const u = await db.user.findUnique({ where: { email: e } });
    if (!u) throw new Error(`No existe una cuenta con el correo ${e}.`);
    others.push(u);
  }
  const existing = await db.project.findFirst({ where: { name: projectName, members: { some: { userId: owner.id } } } });
  if (existing && replace) {
    await db.project.delete({ where: { id: existing.id } });
    console.log('Proyecto anterior de la misma carga eliminado (--replace).');
  } else if (existing) {
    console.log(`Ya existe el proyecto «${projectName}» (${existing.id}). No se hizo ningún cambio.`);
    return;
  }

  const now = new Date();
  const sprintStart = lima(26, 10, 2026, 0);
  const review = text('Sprint_Review_07.md');
  const goal = /Objetivo: (Dejar la solución .+?)\n/.exec(review)?.[1] ?? backlog.meta.Objetivo ?? '';

  const result = await db.$transaction(
    async (tx) => {
      const project = await tx.project.create({
        data: {
          name: projectName,
          description: cut(
            'Nuevo Sistema de Gestión de la Derrama de Docentes UNSA (ADEDUNSA), reemplazo de DerramaSoft. Aplicación de escritorio .NET (C# + WPF) con PostgreSQL y 7 módulos: Aporte, Operaciones, Caja, Contabilidad, Reportes, Mantenimiento y Sistema; incluye portal web de consulta para el socio y migración de datos. Datos cargados del Sprint 7.',
            1000,
          ),
          productGoal:
            'Reemplazar DerramaSoft por un sistema moderno y seguro que conserve los módulos y el lenguaje que el personal ya conoce, elimine procesos manuales, incorpore la contabilidad completa y permita al socio consultar su información en línea.',
          createdBy: owner.id,
          createdAt: sprintStart,
          updatedAt: now,
          members: { create: [owner, ...others].map((u) => ({ userId: u.id, role: 'FACILITATOR' as const, createdAt: sprintStart })) },
        },
      });

      // ---- Product Backlog: 34 historias ----
      const counters = { USER_STORY: 0, ITEM: 0 };
      const itemByOriginalId = new Map<string, string>();
      for (const row of backlog.historias) {
        const id = clean(row.Historia);
        const raw = key(row, 'Historia de usuario');
        const story = parseStory(raw);
        const kind = story ? 'USER_STORY' : 'ITEM';
        counters[kind] += 1;
        const code = `${kind === 'USER_STORY' ? 'HU' : 'EL'}-${counters[kind]}`;
        const priority = Math.round(Number(row.Orden));
        const created = await tx.backlogItem.create({
          data: {
            projectId: project.id,
            code,
            kind,
            title: cut(story ? `${id} · ${story.iWant}` : `${id} · ${clean(key(row, 'Épica') || key(row, '�pica'))}`, 120),
            asA: story?.asA ?? null,
            iWant: story?.iWant ?? null,
            soThat: story?.soThat ?? null,
            description: story ? null : cut(clean(raw), 2000),
            acceptanceCriteria: criteriaOf(key(row, 'Criterios de aceptación')),
            priority,
            createdBy: owner.id,
            createdAt: sprintStart,
            updatedAt: sprintStart,
          },
        });
        itemByOriginalId.set(id, created.id);
      }

      // ---- Sprint 7 con su planificación ----
      const workPlan = cut(
        [
          'Plan de trabajo por paquetes (Sprint Backlog 07, 26/10/2026 al 06/11/2026):',
          ...backlog.paquetes.map(
            (p) => `${clean(p.Paquete)} ${clean(p.Nombre)} — ${clean(key(p, 'Integrante'))} — ${clean(p.Horas)} h. Entrega: ${clean(key(p, 'Qué debe entregar'))}`,
          ),
          `Capacidad: ${backlog.meta['Capacidad (h)']} h; horas planificadas: ${backlog.meta['Horas planificadas (tareas)']} h (sobre capacidad: las historias DS-HU-08 en adelante quedaron marcadas «renegociar» en el Sprint Backlog).`,
        ].join('\n'),
        5000,
      );
      const sprint = await tx.sprint.create({
        data: {
          projectId: project.id,
          number: 7,
          sprintGoal: cut(clean(goal), 500),
          workPlan,
          createdAt: sprintStart,
          updatedAt: now,
          stages: {
            create: (['PLANNING', 'TRACKING', 'REVIEW', 'RETROSPECTIVE'] as const).map((type) => ({ type, status: 'IN_PROGRESS' as const, startedAt: sprintStart, createdAt: sprintStart, updatedAt: now })),
          },
          items: { create: [...itemByOriginalId.values()].map((backlogItemId) => ({ backlogItemId, createdAt: sprintStart })) },
        },
      });

      // ---- Tareas (130). Según el Review, el equipo confirmó el cierre del 100 % de las actividades ----
      let tasks = 0;
      for (const t of backlog.tareas) {
        const id = clean(t['ID tarea']);
        const description = clean(key(t, 'Descripción de la tarea'));
        const owner_ = clean(t.Responsable);
        const suffix = owner_ ? ` (${owner_})` : '';
        const title = cut(`${id} · ${description}`, 200 - suffix.length) + suffix;
        await tx.sprintTask.create({
          data: {
            sprintId: sprint.id,
            backlogItemId: itemByOriginalId.get(clean(t.Historia)) ?? null,
            title: cut(title, 200),
            status: 'DONE',
            createdBy: owner.id,
            createdAt: sprintStart,
            updatedAt: lima(4, 11, 2026),
          },
        });
        tasks += 1;
      }

      // ---- Seguimiento: Daily Scrum reconstruido ----
      const daily = dailyEntries();
      for (const e of daily) {
        await tx.trackingEntry.create({ data: { sprintId: sprint.id, kind: 'DAILY_NOTE', content: e.content, createdBy: owner.id, createdAt: e.at } });
      }
      await tx.trackingEntry.create({
        data: {
          sprintId: sprint.id,
          kind: 'OBSERVATION',
          content:
            'Registro reconstruido a partir del Sprint Daily 07: fechas, horarios y avances intermedios son aproximados; no acreditan asistencia nominal. El cierre del 100 % de actividades fue confirmado por el equipo el 04/11/2026.',
          createdBy: owner.id,
          createdAt: lima(4, 11, 2026),
        },
      });

      // ---- Sprint Review ----
      await tx.sprintReview.create({
        data: {
          sprintId: sprint.id,
          results: cut(
            'Cierre de actividades confirmado por el equipo al 04/11/2026: 34 historias (25 funcionales, 8 documentales V6 y GEST-07) y 130 tareas (91 técnicas y de gestión, 39 correcciones V6). Calidad: 564 casos registrados, 513 aprobados, 51 no ejecutados (verificaciones manuales pendientes) y 0 fallidos. Suite global informada el 02/11/2026: 1168 superadas, 0 fallidas y 9 omitidas de 1177.',
            5000,
          ),
          increment: cut(
            'Base técnica e interfaz principal; acceso, bloqueo y roles; usuarios y bitácora; padrón de socios; estados del socio, parámetros y tasas; cuentas bancarias y caja; contabilidad base; consultas y reportes de caja y contabilidad (paquetes P01 a P08, .NET 10 + WPF).',
            5000,
          ),
          feedback: cut(
            'Los registros de P02 a P08 documentan las pruebas de .NET; otros paquetes mantienen verificaciones manuales pendientes. Hallazgo visual (05/11/2026): el voucher no pudo registrarse en la recopilación aportada porque Debe y Haber no admitieron escritura, lo que impidió contrastar libros y estados de P08. La aceptación institucional de la Derrama no está acreditada.',
            5000,
          ),
          goalAssessment: 'PARTIAL',
          goalAssessmentNote: cut(
            'Todas las actividades se declararon terminadas, pero quedan 51 verificaciones manuales, permisos y reglas por confirmar con la Derrama, y el recorrido del voucher quedó bloqueado. La retrospectiva del equipo la califica «conforme con observaciones».',
            2000,
          ),
          createdAt: lima(4, 11, 2026),
          updatedAt: lima(5, 11, 2026),
        },
      });

      // ---- Retrospectiva y acciones ----
      const retro = retroData();
      await tx.retrospective.create({
        data: { sprintId: sprint.id, positives: retro.positives, problems: retro.problems, improvements: retro.improvements, createdAt: lima(4, 11, 2026, 21, 30), updatedAt: lima(5, 11, 2026) },
      });
      for (const a of retro.actions) {
        await tx.retroAction.create({ data: { sprintId: sprint.id, description: a.description, forNextSprint: true, status: 'OPEN', followUpNote: a.note, createdAt: lima(5, 11, 2026) } });
      }

      // ---- Decisiones y acuerdos documentados ----
      const decisions = [
        { kind: 'DECISION' as const, text: 'Tecnología adoptada: aplicación de escritorio C#/.NET 10 con WPF y base de datos PostgreSQL (C-01, Sprint Planning 07).' },
        { kind: 'AGREEMENT' as const, text: 'Consolidar el entregable y resolver las observaciones de pruebas en el siguiente ciclo, con evidencia de reejecución (fecha objetivo 09/11/2026; Sprint Review 07).' },
        { kind: 'AGREEMENT' as const, text: 'El cierre de actividades al 100 % no modifica los estados de pruebas ni acredita la aceptación institucional: se mantienen separados (Sprint Retrospective 07).' },
      ];
      for (const d of decisions) await tx.decision.create({ data: { projectId: project.id, kind: d.kind, text: d.text, createdBy: owner.id, createdAt: lima(5, 11, 2026) } });

      // ---- Documentación del proyecto (texto de los Word originales; sin imágenes) ----
      const files = readdirSync(path.join(DATA, 'documentos')).filter((f) => f.endsWith('.md')).sort();
      let docs = 0;
      for (const file of files) {
        const content = text(file);
        const data = Buffer.from(content, 'utf-8');
        const name = file.replace(/\.md$/, '').replace(/_/g, ' ');
        await tx.projectDocument.create({
          data: {
            projectId: project.id,
            name: cut(name, 120),
            includeInContext: true,
            createdAt: now,
            updatedAt: now,
            versions: { create: { version: 1, fileName: file, mimeType: 'text/markdown; charset=utf-8', sizeBytes: data.length, data: new Uint8Array(data), textContent: content, uploadedBy: owner.id, uploadedAt: now } },
          },
        });
        docs += 1;
      }

      await tx.activityLog.create({
        data: { projectId: project.id, actorId: owner.id, action: 'project.imported', entityType: 'project', entityId: project.id, payload: { source: 'sprint7-adedunsa', items: itemByOriginalId.size, tasks, documents: docs }, occurredAt: now },
      });
      return { projectId: project.id, items: itemByOriginalId.size, stories: counters.USER_STORY, general: counters.ITEM, tasks, daily: daily.length, actions: retro.actions.length, docs };
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  console.log(`Proyecto «${projectName}» cargado: ${result.projectId}`);
  console.log(`  Product Backlog: ${result.items} elementos (${result.stories} historias de usuario, ${result.general} generales)`);
  console.log(`  Sprint 7: ${result.tasks} tareas, ${result.daily} registros de Daily, Review, retrospectiva con ${result.actions} acciones, 3 decisiones`);
  console.log(`  Documentación: ${result.docs} documentos`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
