import { expect, test } from '@playwright/test';
import { createProject, expectAccessible, register } from './helpers';

test.describe('US5: retrospectiva con validación de acciones de mejora', () => {
  test('sin acciones → falla; acción sin responsable → señalada; corregir → cierra el Sprint y permite el siguiente', async ({ page }) => {
    await register(page);
    await createProject(page, `Retrospectiva e2e ${Date.now()}`);
    await page.getByRole('button', { name: 'Crear Sprint' }).click();
    await page.getByRole('link', { name: 'Retrospectiva', exact: true }).first().click();

    const panel = page.getByRole('region', { name: 'Resultado de la evaluación' });
    const encabezado = panel.getByRole('heading', { level: 3 });

    // Retrospectiva sin acciones: la evaluación falla y se explica por qué.
    await page.getByRole('button', { name: 'Evaluar retrospectiva' }).click();
    await expect(encabezado).toContainText('No aprobada');
    await expect(panel.getByText('Se identificó al menos una mejora (acción)')).toBeVisible();
    await expect(panel.getByText(/no define ninguna acción de mejora/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Completar retrospectiva y cerrar el Sprint' })).toBeDisabled();
    await expectAccessible(page);

    // Positivos, problemas y mejoras.
    await page.getByLabel('Aspectos positivos').fill('El equipo se comunicó bien durante el Sprint');
    await page.getByLabel('Problemas').fill('Las reuniones diarias se alargaron demasiado');
    await page.getByLabel('Oportunidades de mejora').fill('Limitar la reunión diaria a quince minutos');
    await page.getByRole('button', { name: 'Guardar retrospectiva' }).click();
    await expect(page.getByText('Retrospectiva guardada.')).toBeVisible();

    // Acción válida pero sin responsable.
    await page.getByLabel('Descripción de la acción').last().fill('Limitar cada reunión diaria a quince minutos con temporizador');
    await page.getByRole('button', { name: 'Agregar acción' }).click();
    await expect(page.locator('[data-action]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Evaluar retrospectiva' }).click();
    await expect(encabezado).toContainText('No aprobada');
    await expect(panel.getByText('Cada acción tiene un responsable')).toBeVisible();
    await expect(panel.getByText(/Sin responsable: acción n\.º 1/)).toBeVisible();

    // Se asigna responsable a la acción y se vuelve a evaluar.
    const fila = page.locator('[data-action]').first();
    await fila.getByLabel('Responsable').selectOption({ index: 1 });
    const guardado = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/retrospective/actions/'));
    await fila.getByRole('button', { name: 'Guardar acción' }).click();
    expect((await guardado).ok()).toBe(true);
    await page.getByRole('button', { name: 'Evaluar retrospectiva' }).click();
    await expect(encabezado).not.toContainText('No aprobada');
    await expect(encabezado).toContainText('Aprobada');

    // Completar cierra el Sprint; el Facilitador crea el siguiente.
    await page.getByRole('button', { name: 'Completar retrospectiva y cerrar el Sprint' }).click();
    await expect(page.getByText(/Sprint cerrado/).first()).toBeVisible();
    await page.getByRole('link', { name: 'Flujo' }).click();
    await expect(page.getByText('El Sprint anterior está cerrado')).toBeVisible();
    await page.getByRole('button', { name: 'Crear Sprint' }).click();
    await expect(page.getByRole('heading', { name: 'Sprint 2' })).toBeVisible();
    await expect(page.locator('[data-stage="RETROSPECTIVE"]')).toHaveAttribute('data-status', 'PENDING');

    // La retrospectiva del Sprint 2 pide el seguimiento de las acciones del Sprint 1.
    await page.getByRole('link', { name: 'Retrospectiva', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: /Acciones del Sprint anterior/ })).toBeVisible();
    await expect(page.getByText('Limitar cada reunión diaria a quince minutos con temporizador').first()).toBeVisible();
  });
});
