import { expect, test, type Page } from '@playwright/test';
import { createProject, expectAccessible, register } from './helpers';

/** En escritorio el panel lateral ya está abierto; en móvil se abre el cajón con el botón flotante. */
async function abrirAsistente(page: Page) {
  const panel = page.getByRole('complementary', { name: 'Asistente de Scrum' });
  if (!(await panel.isVisible())) await page.getByRole('button', { name: 'Abrir asistente' }).click();
  await expect(panel).toBeVisible();
}

async function preguntar(page: Page, texto: string) {
  await page.getByLabel('Pregunta al asistente').fill(texto);
  await page.getByRole('button', { name: 'Preguntar' }).click();
}

test.describe('US4: asistente conversacional con IA', () => {
  test('respuesta etiquetada como recomendación de IA, con aviso, y sin modificar artefactos', async ({ page }) => {
    await register(page);
    await createProject(page, `Asistente e2e ${Date.now()}`);

    // Una historia incompleta, con el asistente enfocado en ella.
    await page.getByRole('link', { name: 'Backlog' }).click();
    await page.getByRole('link', { name: 'Nueva historia' }).click();
    await page.getByLabel('Título').fill('Idea suelta');
    await page.getByLabel('Como (rol)').fill('usuario');
    await page.getByLabel('Quiero (necesidad)').fill('algo rápido y fácil');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.getByRole('button', { name: 'Evaluar historia' }).click();
    await expect(page.getByRole('region', { name: 'Resultado de la evaluación' })).toBeVisible();

    await abrirAsistente(page);
    await expect(page.getByText(/HU-1 · Idea suelta/).first()).toBeVisible();
    await expectAccessible(page);

    const antes = await page.getByLabel('Quiero (necesidad)').inputValue();
    await preguntar(page, '¿Qué le falta a mi historia?');

    const respuesta = page.locator('[data-ai-reply]').first();
    await expect(respuesta).toBeVisible();
    await expect(respuesta.getByText('Recomendación de IA')).toBeVisible();
    await expect(respuesta.getByText(/puede contener errores/i)).toBeVisible();
    await expect(respuesta.getByText(/Respuesta simulada para pruebas/)).toBeVisible();
    // Las recomendaciones no cambian el artefacto.
    expect(await page.getByLabel('Quiero (necesidad)').inputValue()).toBe(antes);
    await expect(page.getByRole('region', { name: 'Resultado de la evaluación' }).getByRole('heading', { level: 3 })).toContainText('No aprobada');
  });

  test('si la IA falla muestra un error claro y las reglas siguen funcionando', async ({ page }) => {
    await register(page);
    await createProject(page, `Asistente caído ${Date.now()}`);
    await abrirAsistente(page);

    await preguntar(page, 'FALLO-IA-SIMULADO');
    await expect(page.getByRole('alert').filter({ hasText: /no está disponible/i })).toBeVisible();
    await expect(page.getByText(/reglas siguen funcionando/i).first()).toBeVisible();

    await preguntar(page, 'TIMEOUT-IA-SIMULADO');
    await expect(page.getByRole('alert').filter({ hasText: /tardó demasiado/i })).toBeVisible();

    // Las comprobaciones por reglas funcionan igual con la IA caída.
    await page.getByRole('button', { name: 'Contraer asistente' }).click();
    await page.getByRole('link', { name: 'Backlog' }).click();
    await page.getByRole('link', { name: 'Nueva historia' }).click();
    await page.getByLabel('Título').fill('Historia con IA caída');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.getByRole('button', { name: 'Evaluar historia' }).click();
    await expect(page.getByRole('region', { name: 'Resultado de la evaluación' }).getByRole('heading', { level: 3 })).toContainText('No aprobada');
  });

  test('«Pedir recomendación de IA» añade observaciones etiquetadas sin cambiar el estado', async ({ page }) => {
    await register(page);
    await createProject(page, `Observaciones e2e ${Date.now()}`);
    await page.getByRole('link', { name: 'Backlog' }).click();
    await page.getByRole('link', { name: 'Nueva historia' }).click();
    await page.getByLabel('Título').fill('Historia sin detalle');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.getByRole('button', { name: 'Evaluar historia' }).click();

    const panel = page.getByRole('region', { name: 'Resultado de la evaluación' });
    await expect(panel.getByRole('heading', { level: 3 })).toContainText('No aprobada');
    await panel.getByRole('button', { name: 'Pedir recomendación de IA' }).click();
    const ia = panel.getByRole('region', { name: 'Recomendaciones de IA' });
    await expect(ia.getByText('Recomendación de IA').first()).toBeVisible();
    await expect(ia.getByText(/Revise que el objetivo y el trabajo/)).toBeVisible();
    await expect(panel.getByRole('heading', { level: 3 })).toContainText('No aprobada');
  });
});
