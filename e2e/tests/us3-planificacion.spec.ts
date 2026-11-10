import { expect, test, type Page } from '@playwright/test';
import { createProject, expectAccessible, register } from './helpers';

async function crearHistoriaAprobada(page: Page) {
  await page.getByRole('link', { name: 'Backlog' }).click();
  await page.getByRole('link', { name: 'Nueva historia' }).click();
  await page.getByLabel('Título').fill('Registrar asistencia del equipo');
  await page.getByLabel('Como (rol)').fill('Scrum Master');
  await page.getByLabel('Quiero (necesidad)').fill('registrar la asistencia diaria del equipo en la reunión');
  await page.getByLabel('Para (beneficio)').fill('puedo detectar ausencias recurrentes a tiempo');
  await page.getByLabel('Criterios de aceptación').fill('Se guarda la fecha y la hora del registro\nSolo el Scrum Master puede modificar un registro guardado');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByRole('button', { name: 'Evaluar historia' }).click();
  await expect(page.getByRole('region', { name: 'Resultado de la evaluación' }).getByRole('heading', { level: 3 })).toContainText('Aprobada');
}

async function prepararSprint(page: Page) {
  await register(page);
  await createProject(page, `Planificación e2e ${Date.now()}`);
  await crearHistoriaAprobada(page);
  await page.getByRole('link', { name: 'Flujo' }).click();
  await page.getByRole('button', { name: 'Crear Sprint' }).click();
  await page.getByRole('link', { name: 'Planificación', exact: true }).first().click();
}

test.describe('US3: planificación del Sprint con compuerta', () => {
  test('objetivo vacío → bloqueada con criterios fallidos → corregir → aprobada → avanzar', async ({ page }) => {
    await prepararSprint(page);
    const resultado = page.getByRole('region', { name: 'Resultado de la evaluación' });

    // Sin Sprint Goal: la evaluación falla y no se puede completar.
    await page.getByRole('button', { name: 'Evaluar planificación' }).click();
    await expect(resultado.getByRole('heading', { level: 3 })).toContainText('No aprobada');
    await expect(resultado.getByText('Existe un Sprint Goal')).toBeVisible();
    await expect(resultado.getByText('No cumplido').first()).toBeVisible();
    await expect(resultado.getByText('Oficial de Scrum').first()).toBeVisible(); // PLAN-01 (oficial) no se cumple: queda a la vista
    await expect(page.getByRole('button', { name: 'Completar planificación' })).toBeDisabled();
    await expectAccessible(page);

    // Corrección: objetivo, elemento seleccionado y plan.
    await page.getByLabel('Sprint Goal').fill('Permitir que el equipo registre su asistencia diaria desde el panel');
    await page.getByRole('checkbox', { name: /HU-1/ }).check();
    await page.getByLabel('Plan de trabajo').fill('HU-1: diseñar el formulario de asistencia y luego implementar el registro de asistencia.');
    await page.getByRole('button', { name: 'Guardar planificación' }).click();
    await expect(page.getByText('Planificación guardada.')).toBeVisible();

    await page.getByRole('button', { name: 'Evaluar planificación' }).click();
    await expect(resultado.getByRole('heading', { level: 3 })).toContainText('Intento 2');
    await expect(resultado.getByRole('heading', { level: 3 })).not.toContainText('No aprobada');

    await page.getByRole('button', { name: 'Completar planificación' }).click();
    await expect(page.getByText('La planificación está validada.')).toBeVisible();

    // El flujo refleja la etapa validada y el seguimiento ya se puede trabajar.
    await page.getByRole('link', { name: 'Flujo' }).click();
    await expect(page.locator('[data-stage="PLANNING"]')).toHaveAttribute('data-status', 'VALIDATED');
    await page.getByLabel('Registrar evidencia').nth(1).fill('Primer avance del seguimiento');
    await page.getByRole('button', { name: 'Registrar evidencia' }).nth(1).click();
    await expect(page.locator('[data-stage="TRACKING"]')).toHaveAttribute('data-status', 'IN_PROGRESS');
  });

  test('el Facilitador concede una excepción justificada y el avance se habilita', async ({ page }) => {
    await prepararSprint(page);
    await page.getByLabel('Sprint Goal').fill('Permitir que el equipo registre su asistencia diaria desde el panel');
    await page.getByRole('button', { name: 'Guardar planificación' }).click();
    await page.getByRole('button', { name: 'Evaluar planificación' }).click();
    await expect(page.getByRole('region', { name: 'Resultado de la evaluación' }).getByRole('heading', { level: 3 })).toContainText('No aprobada');
    await expect(page.getByRole('button', { name: 'Completar planificación' })).toBeDisabled();

    await page.getByRole('button', { name: 'Pedir excepción' }).click();
    await page.getByLabel('Justificación').fill('corta');
    await page.getByRole('button', { name: 'Conceder excepción' }).click();
    await expect(page.getByText('al menos 10 caracteres')).toBeVisible();

    await page.getByLabel('Justificación').fill('El docente autorizó avanzar con un plan provisional.');
    await page.getByRole('button', { name: 'Conceder excepción' }).click();
    await expect(page.getByText('Excepción registrada. El avance quedó habilitado.')).toBeVisible();
    await expect(page.getByText('Aprobada con excepción').first()).toBeVisible();

    await page.getByRole('button', { name: 'Completar planificación' }).click();
    await expect(page.getByText('La planificación está validada.')).toBeVisible();
  });
});
