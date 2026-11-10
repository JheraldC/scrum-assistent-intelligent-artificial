import { expect, test } from '@playwright/test';
import { createProject, expectAccessible, register } from './helpers';

test.describe('US2: historias de usuario y evaluación', () => {
  test('historia ambigua → criterios incumplidos con sugerencias → corrección → cumplida', async ({ page }) => {
    await register(page);
    await createProject(page, `Backlog e2e ${Date.now()}`);

    await page.getByRole('link', { name: 'Backlog' }).click();
    await page.getByRole('link', { name: 'Nueva historia' }).click();

    // Historia ambigua: sin criterios de aceptación y con términos vagos.
    await page.getByLabel('Título').fill('Idea suelta');
    await page.getByLabel('Como (rol)').fill('usuario');
    await page.getByLabel('Quiero (necesidad)').fill('algo rápido y fácil');
    await page.getByLabel('Para (beneficio)').fill('todo sea mejor');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await page.getByRole('button', { name: 'Evaluar historia' }).click();
    const panel = page.getByRole('region', { name: 'Resultado de la evaluación' });
    await expect(panel.getByText('No aprobada')).toBeVisible();
    // Completitud: sin criterios de aceptación.
    await expect(panel.getByText('Criterios de aceptación').first()).toBeVisible();
    await expect(panel.getByText('No cumplido').first()).toBeVisible();
    // Verificabilidad: indica los términos detectados.
    await expect(panel.getByText(/rápido/i).first()).toBeVisible();
    // Etiquetas de origen y de fuente.
    await expect(panel.getByText('Criterio adicional del prototipo').first()).toBeVisible();
    await panel.getByText(/Ver \d+ criterio/).click(); // los criterios cumplidos van plegados
    await expect(panel.getByText('Oficial de Scrum').first()).toBeVisible();
    await expect(panel.getByText('Comprobación por reglas').first()).toBeVisible();
    await expectAccessible(page);

    // Corrección: texto concreto y criterios de aceptación verificables.
    await page.getByLabel('Quiero (necesidad)').fill('registrar la asistencia diaria del equipo en la reunión');
    await page.getByLabel('Para (beneficio)').fill('puedo detectar ausencias recurrentes a tiempo');
    await page.getByLabel('Criterios de aceptación').fill('Se guarda la fecha y la hora del registro\nSolo el Scrum Master puede modificar un registro guardado');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await page.getByRole('button', { name: 'Evaluar historia' }).click();
    const encabezado = page.getByRole('region', { name: 'Resultado de la evaluación' }).getByRole('heading', { level: 3 });
    await expect(encabezado).toContainText('Aprobada');
    await expect(encabezado).not.toContainText('No aprobada');
    await expect(encabezado).toContainText('Intento 2');

    // Historial de intentos conservado.
    await page.getByRole('link', { name: 'Validaciones' }).click();
    await expect(page.getByText('Intento 1')).toBeVisible();
    await expect(page.getByText('Intento 2')).toBeVisible();
  });
});
