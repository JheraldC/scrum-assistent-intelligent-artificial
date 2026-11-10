import { expect, test, type Page } from '@playwright/test';
import { createProject, expectAccessible, expectNoHorizontalScroll, register } from './helpers';

const PANEL = (page: Page) => page.getByRole('complementary', { name: 'Asistente de Scrum' });

async function nuevoProyecto(page: Page, nombre: string) {
  await register(page);
  await createProject(page, `${nombre} ${Date.now()}`);
}

async function crearHistoria(page: Page, titulo = 'Registrar asistencia del equipo') {
  await page.getByRole('link', { name: 'Backlog' }).click();
  await page.getByRole('link', { name: 'Nueva historia' }).click();
  await page.getByLabel('Título').fill(titulo);
  await page.getByLabel('Como (rol)').fill('Scrum Master');
  await page.getByLabel('Quiero (necesidad)').fill('registrar la asistencia diaria del equipo en la reunión');
  await page.getByLabel('Para (beneficio)').fill('puedo detectar ausencias recurrentes a tiempo');
  await page.getByLabel('Criterios de aceptación').fill('Se guarda la fecha y la hora del registro\nSolo el Scrum Master puede modificar un registro guardado');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByRole('button', { name: 'Evaluar historia' }).click();
  await expect(page.getByRole('region', { name: 'Resultado de la evaluación' }).getByRole('heading', { level: 3 })).toContainText('Aprobada');
}

async function preguntar(page: Page, texto: string) {
  await page.getByLabel('Pregunta al asistente').fill(texto);
  await page.getByRole('button', { name: 'Preguntar', exact: true }).click();
}

test.describe('US8: equipo Scrum, documentación y asistente lateral', () => {
  test('panel lateral persistente: abierto en escritorio, se contrae, se redimensiona con el teclado y recuerda su estado @movil', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'El panel lateral es solo de escritorio; el cajón móvil se prueba aparte.');
    await nuevoProyecto(page, 'Panel lateral');
    await expect(PANEL(page)).toBeVisible();
    await expect(PANEL(page).getByText('Contexto:')).toBeVisible();
    await expectAccessible(page);

    const separador = page.getByRole('separator', { name: 'Cambiar el ancho del asistente' });
    const antes = Number(await separador.getAttribute('aria-valuenow'));
    await separador.focus();
    await page.keyboard.press('ArrowLeft');
    expect(Number(await separador.getAttribute('aria-valuenow'))).toBeGreaterThan(antes);

    await page.getByRole('button', { name: 'Contraer asistente' }).click();
    await expect(PANEL(page)).toBeHidden();
    await page.reload();
    await expect(PANEL(page)).toBeHidden(); // recuerda que estaba contraído
    await page.getByRole('button', { name: 'Abrir asistente' }).click();
    await expect(PANEL(page)).toBeVisible();
  });

  test('en móvil el asistente es un cajón: cerrado al inicio, se abre, se cierra con Escape y no ocupa el contenido @movil', async ({ page, isMobile }) => {
    test.skip(isMobile !== true, 'Solo en el proyecto móvil.');
    await nuevoProyecto(page, 'Cajón móvil');
    await expect(PANEL(page)).toBeHidden();
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Abrir asistente' }).click();
    await expect(PANEL(page)).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press('Escape');
    await expect(PANEL(page)).toBeHidden();
    await page.getByRole('button', { name: 'Abrir asistente' }).click();
    await PANEL(page).getByRole('button', { name: 'Cerrar asistente' }).click();
    await expect(PANEL(page)).toBeHidden();
  });

  test('propuestas de la IA: se revisan, se aceptan con confirmación y se descartan; la IA no aprueba compuertas @movil', async ({ page, isMobile }) => {
    await nuevoProyecto(page, 'Propuestas IA');
    await crearHistoria(page);
    // Evaluar abre el panel por sí solo (en móvil, el cajón); si no está abierto, se abre con el botón.
    if (isMobile && !(await PANEL(page).isVisible())) await page.getByRole('button', { name: 'Abrir asistente' }).click();

    await preguntar(page, 'PROPUESTA-IA-SIMULADA ¿Qué propones?');
    await expect(page.locator('[data-ai-reply]').first()).toBeVisible();
    await expect(PANEL(page).getByText(/Cambios propuestos \(modifican un campo\)/)).toBeVisible();
    await expect(PANEL(page).getByText(/Solo informativas \(no modifican nada\)/)).toBeVisible();
    const historia = PANEL(page).locator('[data-kind="STORY"]');
    await expect(historia).toContainText('Consultar el resumen semanal de asistencia');
    await expect(historia).toContainText('Inferencia de la IA');
    await expect(historia).toContainText('Se creará la historia');

    // Aceptar exige revisar y confirmar; solo entonces se aplica.
    await historia.getByRole('button', { name: 'Revisar y aceptar' }).click();
    await expect(historia.getByText(/Se registrará quién lo hizo/)).toBeVisible();
    await historia.getByRole('button', { name: 'Confirmar y aplicar' }).click();
    await expect(PANEL(page).getByText(/La IA no aprueba compuertas/)).toBeVisible();
    await expect(PANEL(page).locator('[data-kind="STORY"]')).toHaveCount(0);

    // Una propuesta informativa se puede descartar.
    await PANEL(page).locator('[data-kind="RISK"]').getByRole('button', { name: 'Descartar' }).click();
    await expect(PANEL(page).locator('[data-kind="RISK"]')).toHaveCount(0);

    // La historia creada aparece en el backlog, sin aprobar: solo las reglas la evalúan.
    if (isMobile) await PANEL(page).getByRole('button', { name: 'Cerrar asistente' }).click();
    await page.getByRole('link', { name: 'Backlog' }).click();
    await expect(page.getByText('Consultar el resumen semanal de asistencia')).toBeVisible();
  });

  test('editar una propuesta antes de aceptarla aplica lo editado', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await nuevoProyecto(page, 'Editar propuesta');
    await crearHistoria(page);
    await preguntar(page, 'PROPUESTA-IA-SIMULADA ¿Qué propones?');
    const historia = PANEL(page).locator('[data-kind="STORY"]');
    await historia.getByRole('button', { name: 'Editar' }).click();
    await historia.getByLabel('Título').fill('Título corregido por una persona');
    await historia.getByRole('button', { name: 'Confirmar y aplicar' }).click();
    await expect(PANEL(page).getByText(/Cambio aplicado/)).toBeVisible();
    await page.getByRole('link', { name: 'Backlog' }).click();
    await expect(page.getByText('Título corregido por una persona')).toBeVisible();
  });

  test('documentación opcional: sin documentos el asistente funciona; con uno vigente lo cita; desactualizado ya no', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await nuevoProyecto(page, 'Documentos');
    await page.getByRole('link', { name: 'Documentación' }).click();
    await expect(page.getByText(/Aún no hay documentos/)).toBeVisible();
    await expect(page.getByText(/se envía|pueden enviarse/i).first()).toBeVisible();

    // Sin documentos, el asistente responde con el contexto del proyecto.
    await preguntar(page, '¿Cómo justificar una falta con certificado?');
    await expect(page.locator('[data-ai-reply]').first()).toBeVisible();

    await page.getByLabel('Nombre del documento').fill('Reglas del negocio');
    await page.getByLabel('Archivo', { exact: true }).setInputFiles({
      name: 'reglas.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Reglas del negocio\nUna falta se justifica con certificado en 48 horas.'),
    });
    await page.getByRole('button', { name: 'Subir documento' }).click();
    await expect(page.locator('[data-document]')).toContainText('Reglas del negocio');
    await expect(page.locator('[data-document]')).toContainText('Vigente');
    await expectAccessible(page);

    await preguntar(page, 'PROPUESTA-IA-SIMULADA ¿Cómo justificar una falta con certificado?');
    const respuesta = page.locator('[data-ai-reply]').last();
    await respuesta.getByText('Contexto usado').click();
    await expect(respuesta).toContainText('Reglas del negocio');
    await expect(PANEL(page).locator('[data-kind="STORY"]').first()).toContainText('Reglas del negocio');

    await page.getByRole('button', { name: 'Marcar como desactualizado' }).click();
    await expect(page.locator('[data-document]')).toContainText('Desactualizado');
    await preguntar(page, 'PROPUESTA-IA-SIMULADA ¿Cómo justificar una falta con certificado?');
    const ultima = page.locator('[data-ai-reply]').last();
    await ultima.getByText('Contexto usado').click();
    await expect(ultima).toContainText('No se consultaron documentos');
  });

  test('un archivo con formato no admitido se rechaza con un mensaje claro', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await nuevoProyecto(page, 'Archivo inválido');
    await page.getByRole('link', { name: 'Documentación' }).click();
    await page.getByLabel('Archivo', { exact: true }).setInputFiles({ name: 'virus.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') });
    await page.getByRole('button', { name: 'Subir documento' }).click();
    await expect(page.getByText(/Tipo de archivo no admitido/)).toBeVisible();
  });

  test('vistas por responsabilidad, DoD, decisiones y tareas opcionales', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await nuevoProyecto(page, 'Vistas');
    await crearHistoria(page);

    // Definition of Done en los ajustes del proyecto.
    await page.getByRole('link', { name: 'Ajustes' }).click();
    await page.getByLabel('Definition of Done (compartida)').fill('Código revisado y con pruebas');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText(/guardad/i).first()).toBeVisible();

    // Responsabilidades Scrum, independientes de los permisos.
    await page.getByRole('link', { name: 'Participantes' }).click();
    const casilla = page.getByRole('group', { name: /Responsabilidades Scrum/ }).getByLabel('Product Owner');
    await casilla.click(); // se guarda en el servidor y la casilla refleja lo guardado
    await expect(page.getByText('Responsabilidades guardadas.')).toBeVisible();
    await expect(casilla).toBeChecked();

    // Una decisión del equipo.
    await page.getByRole('link', { name: 'Decisiones' }).click();
    await page.getByLabel('Texto').fill('La Daily será a las 9:00');
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page.locator('[data-decision]')).toContainText('La Daily será a las 9:00');

    // Vistas: abre primero la del Product Owner (su responsabilidad).
    await page.getByRole('link', { name: 'Vistas del equipo' }).click();
    await expect(page).toHaveURL(/vistas\/product-owner/);
    await expect(page.locator('[data-view="product-owner"]')).toContainText('Registrar asistencia del equipo');
    await expect(page.locator('[data-view="product-owner"]')).toContainText('Código revisado y con pruebas');
    await expectAccessible(page);

    await page.getByRole('tab', { name: /Scrum Master/ }).click();
    const sm = page.locator('[data-view="scrum-master"]');
    await expect(sm).toContainText('Asuntos que requieren atención');
    await expect(sm).toContainText('La Daily será a las 9:00');
    await page.getByRole('button', { name: 'Pedir preguntas de facilitación a la IA' }).click();
    await expect(PANEL(page).getByText(/Sugiere 3 preguntas de facilitación/)).toBeVisible(); // se envía sola

    // Planificar (las tareas son opcionales) y desglosar en una tarea.
    await page.getByRole('link', { name: 'Flujo' }).click();
    await page.getByRole('button', { name: 'Crear Sprint' }).click();
    await page.getByRole('link', { name: 'Planificación', exact: true }).first().click();
    await page.getByLabel('Sprint Goal').fill('Permitir que el equipo registre su asistencia diaria desde el panel');
    await page.getByRole('checkbox', { name: /HU-1/ }).check();
    await page.getByLabel('Plan de trabajo').fill('HU-1: diseñar el formulario de asistencia y luego implementar el registro de asistencia.');
    await page.getByRole('button', { name: 'Guardar planificación' }).click();
    await expect(page.getByText('Planificación guardada.')).toBeVisible();
    await page.getByRole('button', { name: 'Evaluar planificación' }).click();
    await page.getByRole('button', { name: 'Completar planificación' }).click();
    await expect(page.getByText('La planificación está validada.')).toBeVisible();

    await page.getByLabel('Título de la tarea').fill('Diseñar el formulario');
    await page.getByRole('button', { name: 'Agregar tarea' }).click();
    await expect(page.locator('[data-task]')).toContainText('Diseñar el formulario');
    await page.locator('[data-task]').getByLabel('Estado').selectOption('DONE');
    await expect(page.getByText('Tarea actualizada.')).toBeVisible();

    await page.getByRole('link', { name: 'Vistas del equipo' }).click();
    await page.getByRole('tab', { name: /Developers/ }).click();
    const dev = page.locator('[data-view="developers"]');
    await expect(dev).toContainText('Permitir que el equipo registre su asistencia');
    await expect(dev).toContainText('Hecha 1');
  });

  test('evidencia con archivo adjunto opcional, con autor, fecha y etapa', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await nuevoProyecto(page, 'Evidencia con archivo');
    await page.getByRole('button', { name: 'Crear Sprint' }).click();
    const planificacion = page.locator('[data-stage="PLANNING"]');
    await planificacion.getByLabel('Adjuntar un archivo (opcional)').setInputFiles({ name: 'acta.md', mimeType: 'text/markdown', buffer: Buffer.from('# Acta de planning') });
    await planificacion.getByLabel('Registrar evidencia').fill('Acta de la reunión');
    await planificacion.getByRole('button', { name: 'Registrar evidencia' }).click();
    await expect(planificacion).toContainText('Acta de la reunión');
    await expect(planificacion).toContainText('Archivo adjunto: acta.md');
    await expect(planificacion).toContainText('Planificación del Sprint');
    await expect(planificacion.getByText(/NO verifica su contenido/)).toBeVisible();
  });
});
