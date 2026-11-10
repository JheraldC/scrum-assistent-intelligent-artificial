import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { createProject, expectAccessible, register } from './helpers';

test.describe('US6: exportación de datos', () => {
  test('el Facilitador exporta JSON y CSV sin correos y con los datos de la aplicación', async ({ page, browser }) => {
    const email = await register(page);
    await createProject(page, `Exportación e2e ${Date.now()}`);

    // Un poco de actividad: un Sprint, una historia y una evaluación.
    await page.getByRole('button', { name: 'Crear Sprint' }).click();
    await page.getByRole('link', { name: 'Backlog' }).click();
    await page.getByRole('link', { name: 'Nueva historia' }).click();
    await page.getByLabel('Título').fill('Historia para exportar');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.getByRole('button', { name: 'Evaluar historia' }).click();
    await expect(page.getByRole('region', { name: 'Resultado de la evaluación' })).toBeVisible();

    await page.getByRole('link', { name: 'Historial' }).click();
    await expect(page.getByRole('heading', { name: 'Exportar datos' })).toBeVisible();
    await expectAccessible(page);

    // JSON completo.
    const [descargaJson] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar JSON' }).click()]);
    expect(descargaJson.suggestedFilename()).toMatch(/^export-.+\.json$/);
    const contenidoJson = await readFile((await descargaJson.path())!, 'utf-8');
    const doc = JSON.parse(contenidoJson) as { schema_version: string; datasets: Record<string, Record<string, unknown>[]> };
    expect(doc.schema_version).toBe('1.0.0');
    expect(doc.datasets.validation_runs!.length).toBeGreaterThan(0);
    expect(doc.datasets.activities!.some((a) => a.action === 'sprint.created')).toBe(true);
    // Privacidad: ni el correo de la cuenta ni datos de acceso.
    expect(contenidoJson).not.toContain(email);
    expect(contenidoJson).not.toMatch(/argon2|password/i);
    await expect(page.getByText(/Archivo descargado: export-/)).toBeVisible();

    // CSV de evaluaciones: cabecera del contrato, BOM y las mismas filas que la API.
    await page.getByLabel('Conjunto de datos (para CSV)').selectOption('validation_runs');
    const [descargaCsv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()]);
    expect(descargaCsv.suggestedFilename()).toMatch(/^validation_runs-.+\.csv$/);
    const bytes = await readFile((await descargaCsv.path())!);
    expect(bytes.subarray(0, 3).toString('hex')).toBe('efbbbf'); // BOM UTF-8
    const texto = bytes.toString('utf-8');
    const csv = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
    const lineas = csv.trim().split('\r\n');
    expect(lineas[0]).toContain('validation_id,project_id,is_sample');
    expect(lineas.length - 1).toBe(doc.datasets.validation_runs!.length);
    expect(csv).not.toContain(email);

    // Un Participante no ve el panel de exportación.
    const contextoB = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
    const paginaB = await contextoB.newPage();
    const emailBeto = await register(paginaB);
    await page.getByRole('link', { name: 'Participantes' }).click();
    await page.getByLabel('Correo electrónico').fill(emailBeto);
    await page.getByRole('button', { name: 'Agregar participante' }).click();
    await expect(page.getByText(emailBeto)).toBeVisible();
    await paginaB.reload();
    await paginaB.getByRole('link', { name: /Exportación e2e/ }).click();
    await paginaB.getByRole('link', { name: 'Historial' }).click();
    await expect(paginaB.getByRole('heading', { name: 'Historial de actividad' })).toBeVisible();
    await expect(paginaB.getByRole('heading', { name: 'Exportar datos' })).toHaveCount(0);
    await contextoB.close();
  });
});
