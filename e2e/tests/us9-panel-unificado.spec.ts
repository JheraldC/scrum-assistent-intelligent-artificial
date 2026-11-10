import { expect, test, type Page } from '@playwright/test';
import { createProject, expectAccessible, register } from './helpers';

const PANEL = (page: Page) => page.getByRole('complementary', { name: 'Asistente de Scrum' });

async function nuevoProyecto(page: Page, nombre: string) {
  await register(page);
  await createProject(page, `${nombre} ${Date.now()}`);
}

async function historiaIncompleta(page: Page) {
  await page.getByRole('link', { name: 'Backlog' }).click();
  await page.getByRole('link', { name: 'Nueva historia' }).click();
  await page.getByLabel('Título').fill('Idea suelta');
  await page.getByLabel('Como (rol)').fill('usuario');
  await page.getByLabel('Quiero (necesidad)').fill('algo rápido y fácil');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page).toHaveURL(/backlog\/[0-9a-f-]{36}$/); // al crear, la app abre la historia guardada
  await expect(page.getByRole('heading', { name: /HU-1/ })).toBeVisible();
}

test.describe('US9: evaluaciones y recomendaciones unificadas en el panel del asistente', () => {
  test('Product Backlog: «Nueva historia» es la acción principal y «otro tipo de elemento» es secundario', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await nuevoProyecto(page, 'Backlog historias');
    await page.getByRole('link', { name: 'Backlog' }).click();
    await expect(page.getByRole('link', { name: 'Nueva historia' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nuevo elemento', exact: true })).toHaveCount(0);
    const otro = page.locator('[data-other-kind]');
    await expect(otro.getByRole('link', { name: 'Crear un elemento general' })).toBeHidden();
    await otro.getByText('Otro tipo de elemento').click();
    await expect(otro).toContainText('Scrum no lo exige');
    await expect(otro.getByRole('link', { name: 'Crear un elemento general' })).toBeVisible();
  });

  test('Evaluar historia: el resultado por reglas aparece en el panel (sin IA) y bajo el formulario solo hay un indicador compacto', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await nuevoProyecto(page, 'Evaluación en panel');
    await historiaIncompleta(page);
    await page.getByRole('button', { name: 'Evaluar historia' }).click();

    const resultado = PANEL(page).getByRole('region', { name: 'Resultado de la evaluación' });
    await expect(PANEL(page).getByText(/Evaluando con las reglas: HU-1/)).toBeVisible();
    await expect(PANEL(page).getByText(/no usa IA/)).toBeVisible();
    await expect(resultado.getByRole('heading', { level: 3 })).toContainText('No aprobada');
    await expect(resultado.getByText('La historia tiene rol, necesidad y beneficio')).toBeVisible();
    await expect(resultado.getByText(/Cómo corregirlo/).first()).toBeVisible();
    await expect(resultado.getByText('Oficial de Scrum').first()).toBeVisible();

    // En la pantalla del artefacto solo queda un indicador compacto, sin duplicar el resultado.
    await expect(page.locator('main [data-evaluation-summary]')).toContainText('No aprobada');
    await expect(page.getByRole('region', { name: 'Resultado de la evaluación' })).toHaveCount(1); // solo el del panel
    await expect(PANEL(page).getByRole('region', { name: 'Resultado de la evaluación' })).toHaveCount(1);
    await expect(PANEL(page).getByText('Recomendación de IA', { exact: true })).toHaveCount(0); // la evaluación no llamó a la IA
    await expectAccessible(page);
  });

  test('Pedir recomendación de IA: se envía sola y responde campo por campo, incluido «sin cambios» y «no se pronunció»', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await nuevoProyecto(page, 'Recomendación por campo');
    await historiaIncompleta(page);
    await page.getByRole('button', { name: 'Pedir recomendación de IA' }).click();

    await expect(PANEL(page).getByText(/Pido recomendaciones, campo por campo, para: HU-1/)).toBeVisible();
    const tarjeta = PANEL(page).locator('[data-recommendation]');
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.locator('[data-field="title"]')).toContainText('Cambio recomendado');
    await expect(tarjeta.locator('[data-field="asA"]')).toContainText('Sin cambios recomendados');
    await expect(tarjeta.locator('[data-field="iWant"]')).toContainText('Sin certeza');
    await expect(tarjeta.locator('[data-field="acceptanceCriteria"]')).toContainText('El modelo no se pronunció');
    await expect(tarjeta.locator('[data-field="title"]')).toContainText('Inferencia de la IA');
    await expect(tarjeta).toContainText('La validación sigue siendo por reglas');

    // El formulario no cambió: nada se aplica solo.
    await expect(page.getByLabel('Título')).toHaveValue('Idea suelta');
  });

  test('revisar, editar y aplicar una propuesta: valor actual y propuesto, confirmación, pantalla actualizada y reevaluación por reglas', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await nuevoProyecto(page, 'Aplicar propuesta');
    await historiaIncompleta(page);
    await page.getByRole('button', { name: 'Pedir recomendación de IA' }).click();

    const cambio = PANEL(page).locator('[data-field="title"] [data-field-change="title"]');
    await expect(cambio).toContainText('Valor actual');
    await expect(cambio).toContainText('Idea suelta');
    await expect(cambio).toContainText('Valor propuesto');
    await expect(cambio).toContainText('revisada por la IA simulada');

    await PANEL(page).locator('[data-field="title"]').getByRole('button', { name: 'Editar' }).click();
    await PANEL(page).getByLabel(/Valor propuesto \(editable\)/).fill('Registrar la asistencia del equipo');
    await expect(PANEL(page).getByText(/Se registrará quién lo hizo/)).toBeVisible();
    await PANEL(page).getByRole('button', { name: 'Confirmar y aplicar' }).click();

    await expect(PANEL(page).getByText(/La IA no aprueba compuertas/)).toBeVisible();
    await expect(page.getByLabel('Título')).toHaveValue('Registrar la asistencia del equipo'); // la pantalla se actualizó
    // Las reglas reevaluaron la historia, a nombre de quien aceptó.
    await expect(PANEL(page).getByText(/Reevaluación por reglas/)).toBeVisible();
  });

  test('descartar una propuesta no cambia nada', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await nuevoProyecto(page, 'Descartar propuesta');
    await historiaIncompleta(page);
    await page.getByRole('button', { name: 'Pedir recomendación de IA' }).click();
    await PANEL(page).locator('[data-field="title"]').getByRole('button', { name: 'Descartar' }).click();
    await expect(PANEL(page).locator('[data-field="title"]')).toContainText('Propuesta descartada');
    await expect(page.getByLabel('Título')).toHaveValue('Idea suelta');
  });

  test('conflicto de versión: si el artefacto cambió, no se sobrescribe y se avisa', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await nuevoProyecto(page, 'Conflicto');
    await historiaIncompleta(page);
    await page.getByRole('button', { name: 'Pedir recomendación de IA' }).click();
    await expect(PANEL(page).locator('[data-field="title"]')).toContainText('Cambio recomendado');

    // Otra persona (aquí, otra pestaña con la misma sesión) cambia la historia después de la recomendación.
    const otra = await page.context().newPage();
    await otra.goto(page.url());
    await otra.getByLabel('Título').fill('Título cambiado por el equipo');
    await otra.getByRole('button', { name: 'Guardar' }).click();
    await expect(otra.getByText('Elemento guardado.').first()).toBeVisible();
    await otra.close();

    await PANEL(page).locator('[data-field="title"]').getByRole('button', { name: 'Revisar y aceptar' }).click();
    await PANEL(page).getByRole('button', { name: 'Confirmar y aplicar' }).click();
    await expect(PANEL(page).getByRole('alert')).toContainText('No se sobrescribió nada');
  });

  test('planificación, Review y retrospectiva usan el mismo modelo: evaluación en el panel y botón de recomendación', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await nuevoProyecto(page, 'Modelo común');
    await page.getByRole('button', { name: 'Crear Sprint' }).click();

    await page.getByRole('link', { name: 'Planificación', exact: true }).first().click();
    await page.getByRole('button', { name: 'Evaluar planificación' }).click();
    await expect(PANEL(page).getByRole('region', { name: 'Resultado de la evaluación' })).toBeVisible();
    await page.getByRole('button', { name: 'Pedir recomendación de IA' }).click();
    await expect(PANEL(page).locator('[data-recommendation]')).toContainText('Planificación del Sprint 1');
    await expect(PANEL(page).locator('[data-recommendation] [data-field="sprintGoal"]')).toBeVisible();

    await page.getByRole('link', { name: 'Revisión', exact: true }).first().click();
    await page.getByRole('button', { name: 'Evaluar Review' }).click();
    await expect(PANEL(page).getByText(/Evaluando con las reglas: Review del Sprint 1/)).toBeVisible();
    await page.getByRole('button', { name: 'Pedir recomendación de IA' }).click();
    await expect(PANEL(page).locator('[data-recommendation]').last()).toContainText('Review del Sprint 1');

    await page.getByRole('link', { name: 'Retrospectiva', exact: true }).first().click();
    await page.getByRole('button', { name: 'Evaluar retrospectiva' }).click();
    await expect(PANEL(page).getByText(/Evaluando con las reglas: Retrospectiva del Sprint 1/)).toBeVisible();
    await page.getByRole('button', { name: 'Pedir recomendación de IA' }).click();
    await expect(PANEL(page).locator('[data-recommendation]').last()).toContainText('Retrospectiva del Sprint 1');

    // La conversación se conserva al navegar por el proyecto.
    await page.getByRole('link', { name: 'Flujo' }).click();
    await expect(PANEL(page).getByText(/Pido recomendaciones, campo por campo, para: Planificación del Sprint 1/)).toBeVisible();
  });

  test('seguimiento: análisis asesor de IA sin campos editables, y Product Goal con propuesta de cambio', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await nuevoProyecto(page, 'Asesor y proyecto');
    await page.getByRole('button', { name: 'Crear Sprint' }).click();
    await page.getByRole('link', { name: 'Seguimiento', exact: true }).first().click();
    await page.getByRole('button', { name: 'Pedir recomendación de IA' }).click();
    await expect(PANEL(page).locator('[data-recommendation]')).toContainText('Análisis asesor de IA');
    await expect(PANEL(page).locator('[data-recommendation]')).toContainText('no tiene campos editables');

    await page.getByRole('link', { name: 'Ajustes' }).click();
    await page.getByRole('button', { name: 'Pedir recomendación de IA' }).click();
    await expect(PANEL(page).locator('[data-recommendation]').last().locator('[data-field="productGoal"]')).toContainText('Cambio recomendado');
  });

  test('el Scrum Master pide preguntas de facilitación y se envían solas al asistente', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await nuevoProyecto(page, 'Facilitación');
    await page.getByRole('link', { name: 'Vistas del equipo' }).click();
    await page.getByRole('button', { name: 'Pedir preguntas de facilitación a la IA' }).click();
    await expect(PANEL(page).getByText(/Sugiere 3 preguntas de facilitación/)).toBeVisible();
    await expect(PANEL(page).locator('[data-ai-reply]').first()).toBeVisible();
  });
});
