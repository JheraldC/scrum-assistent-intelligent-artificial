import { expect, test, type Page } from '@playwright/test';
import { createProject, expectAccessible, expectNoHorizontalScroll, register } from './helpers';

/** Proyecto con un Sprint cuya planificación queda validada (el seguimiento lo exige). */
async function prepararSprintPlanificado(page: Page) {
  await register(page);
  await createProject(page, `Seguimiento e2e ${Date.now()}`);
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
}

test.describe('US7: seguimiento del Sprint y Sprint Review', () => {
  test('registra avances e impedimentos, resuelve un impedimento y completa el seguimiento', async ({ page }) => {
    await prepararSprintPlanificado(page);
    await page.getByRole('link', { name: 'Seguimiento', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: /Seguimiento del Sprint/ })).toBeVisible();
    await expect(page.getByText('Aún no hay registros de seguimiento.')).toBeVisible();
    await expectAccessible(page);

    await page.getByLabel('Contenido').fill('Terminamos el formulario de asistencia');
    await page.getByRole('button', { name: 'Registrar', exact: true }).click();
    await expect(page.getByText('Registro añadido.')).toBeVisible();

    await page.getByLabel('Tipo de registro').selectOption('IMPEDIMENT');
    await page.getByLabel('Contenido').fill('No tenemos acceso al servidor de pruebas');
    await page.getByRole('button', { name: 'Registrar', exact: true }).click();
    await expect(page.locator('[data-kind="IMPEDIMENT"]')).toHaveCount(1);
    await expect(page.getByText('1 impedimento sin resolver')).toBeVisible();
    await expect(page.locator('[data-kind="PROGRESS"]')).toHaveCount(1);

    await page.getByRole('button', { name: 'Marcar como resuelto' }).click();
    await expect(page.locator('[data-kind="IMPEDIMENT"]').getByText(/Resuelto/)).toBeVisible();
    await expect(page.getByText('impedimento sin resolver')).toHaveCount(0);

    await page.getByRole('button', { name: 'Completar seguimiento' }).click();
    await expect(page.getByText('Seguimiento completado.')).toBeVisible();
    await page.getByRole('link', { name: 'Flujo' }).click();
    await expect(page.locator('[data-stage="TRACKING"]')).toHaveAttribute('data-status', 'VALIDATED');
  });

  test('la Review incompleta se señala sin bloquear; completarla la deja aprobada y se puede cerrar la etapa', async ({ page }) => {
    await register(page);
    await createProject(page, `Review e2e ${Date.now()}`);
    await page.getByRole('button', { name: 'Crear Sprint' }).click();
    await page.getByRole('link', { name: 'Revisión', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: /Revisión del Sprint/ })).toBeVisible();

    const panel = page.getByRole('region', { name: 'Resultado de la evaluación' });
    const encabezado = panel.getByRole('heading', { level: 3 });

    // Review vacía: se evalúa y se explica qué falta.
    await page.getByRole('button', { name: 'Evaluar Review' }).click();
    await expect(encabezado).toContainText('No aprobada');
    await expect(panel.getByText('Se valora el avance hacia el Sprint Goal y se explica')).toBeVisible();
    await expect(panel.getByText('Se registraron los resultados del Sprint')).toBeVisible();
    await expectAccessible(page);

    // La evaluación es orientativa: no hay botón de excepción.
    await expect(page.getByRole('button', { name: 'Pedir excepción' })).toHaveCount(0);

    // Se completa y se guarda.
    await page.getByLabel('Resultados del Sprint').fill('Se completaron 3 de las 4 historias seleccionadas.');
    await page.getByLabel('Incremento presentado').fill('El formulario de asistencia ya registra la fecha y la hora.');
    await page.getByLabel('Retroalimentación recibida').fill('El profesor sugirió mostrar un resumen semanal.');
    await page.getByLabel('Valoración del Sprint Goal').selectOption('PARTIAL');
    await page.getByLabel('Explique la valoración').fill('Se logró el registro pero faltó el panel de resumen.');
    await page.getByRole('button', { name: 'Guardar Review' }).click();
    await expect(page.getByText('Review guardada.')).toBeVisible();

    await page.getByRole('button', { name: 'Evaluar Review' }).click();
    await expect(encabezado).toContainText('Intento 2');
    await expect(encabezado).not.toContainText('No aprobada');

    await page.getByRole('button', { name: 'Completar Review' }).click();
    await expect(page.getByText('Review completada.')).toBeVisible();
    await page.getByRole('link', { name: 'Flujo' }).click();
    await expect(page.locator('[data-stage="REVIEW"]')).toHaveAttribute('data-status', 'VALIDATED');
  });

  test('las pantallas se usan en móvil sin desplazamiento horizontal', async ({ page }) => {
    await register(page);
    await createProject(page, `Móvil US7 ${Date.now()}`);
    await page.getByRole('button', { name: 'Crear Sprint' }).click();
    await page.getByRole('link', { name: 'Seguimiento', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: /Seguimiento del Sprint/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole('link', { name: 'Revisión', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: /Revisión del Sprint/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
