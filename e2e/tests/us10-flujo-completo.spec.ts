import { expect, test, type Page } from '@playwright/test';
import { createProject, expectAccessible, register } from './helpers';

const PANEL = (page: Page) => page.getByRole('complementary', { name: 'Asistente de Scrum' });
const ultimaRecomendacion = (page: Page) => PANEL(page).locator('[data-recommendation]').last();

/** Acepta, una tras otra, todas las propuestas de cambio de la recomendación visible. */
async function aceptarTodas(page: Page, esperadas: number) {
  const tarjeta = ultimaRecomendacion(page);
  await expect(tarjeta.locator('[data-suggestion]')).toHaveCount(esperadas);
  for (let i = esperadas; i > 0; i -= 1) {
    const propuesta = tarjeta.locator('[data-suggestion]').first();
    await propuesta.getByRole('button', { name: 'Aceptar', exact: true }).click();
    await propuesta.getByRole('button', { name: 'Confirmar y aplicar' }).click();
    await expect(tarjeta.locator('[data-suggestion]')).toHaveCount(i - 1); // la siguiente sigue disponible
  }
  await expect(tarjeta.getByText('Cambio aplicado.')).toHaveCount(esperadas);
  await expect(PANEL(page).getByRole('alert')).toHaveCount(0); // ningún error ni conflicto
}

test.describe('US10: flujo completo de un Sprint con el asistente', () => {
  test.setTimeout(120_000);

  test('de crear el proyecto a cerrar el Sprint, aceptando varias recomendaciones seguidas en cada artefacto', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await register(page);
    await createProject(page, `Flujo completo ${Date.now()}`);

    // ----- Historia: guardar, evaluar y aceptar DOS recomendaciones seguidas (antes fallaba la segunda) -----
    await page.getByRole('link', { name: 'Backlog' }).click();
    await page.getByRole('link', { name: 'Nueva historia' }).click();
    await page.getByLabel('Título').fill('Registrar asistencia del equipo');
    await page.getByLabel('Como (rol)').fill('Scrum Master');
    await page.getByLabel('Quiero (necesidad)').fill('registrar la asistencia diaria del equipo en la reunión');
    await page.getByLabel('Para (beneficio)').fill('puedo detectar ausencias recurrentes a tiempo');
    await page.getByLabel('Criterios de aceptación').fill('Se guarda la fecha y la hora del registro\nSolo el Scrum Master puede modificar un registro guardado');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('heading', { name: /HU-1/ })).toBeVisible();
    await page.getByRole('button', { name: 'Evaluar historia' }).click();
    await expect(PANEL(page).getByRole('region', { name: 'Resultado de la evaluación' }).getByRole('heading', { level: 3 })).toContainText('Aprobada');

    await page.getByRole('button', { name: 'Pedir recomendación de IA' }).click();
    await aceptarTodas(page, 2); // título y beneficio
    await expect(page.getByLabel('Título')).toHaveValue(/revisada por la IA simulada/);
    await expect(page.getByLabel('Para (beneficio)')).toHaveValue(/revisada por la IA simulada/);
    await expect(PANEL(page).getByText(/Reevaluación por reglas/)).toBeVisible();
    // Tras los cambios, una nueva evaluación por reglas sigue funcionando.
    await page.getByRole('button', { name: 'Evaluar historia' }).click();
    await expect(PANEL(page).getByRole('region', { name: 'Resultado de la evaluación' })).toHaveCount(1);

    // ----- Planificación -----
    await page.getByRole('link', { name: 'Flujo' }).click();
    await page.getByRole('button', { name: 'Crear Sprint' }).click();
    await page.getByRole('link', { name: 'Planificación', exact: true }).first().click();
    await page.getByLabel('Sprint Goal').fill('Permitir que el equipo registre su asistencia diaria desde el panel');
    await page.getByRole('checkbox', { name: /HU-1/ }).check();
    await page.getByLabel('Plan de trabajo').fill('HU-1: diseñar el formulario de asistencia y luego implementar el registro de asistencia.');
    await page.getByRole('button', { name: 'Guardar planificación' }).click();
    await expect(page.getByText('Planificación guardada.')).toBeVisible();
    await page.getByRole('button', { name: 'Evaluar planificación' }).click();
    await expect(PANEL(page).getByRole('region', { name: 'Resultado de la evaluación' }).getByRole('heading', { level: 3 })).toContainText('Aprobada');
    // Una recomendación que se descarta no cambia nada.
    await page.getByRole('button', { name: 'Pedir recomendación de IA' }).click();
    await ultimaRecomendacion(page).locator('[data-suggestion]').first().getByRole('button', { name: 'Descartar' }).click();
    await expect(ultimaRecomendacion(page).getByText('Propuesta descartada.')).toBeVisible();
    await expect(page.getByLabel('Sprint Goal')).toHaveValue('Permitir que el equipo registre su asistencia diaria desde el panel');
    await page.getByRole('button', { name: 'Completar planificación' }).click();
    await expect(page.getByText('La planificación está validada.')).toBeVisible();

    // Una tarea opcional y su recomendación.
    await page.getByLabel('Título de la tarea').fill('Diseñar el formulario');
    await page.getByRole('button', { name: 'Agregar tarea' }).click();
    await expect(page.locator('[data-task]')).toContainText('Diseñar el formulario');
    await page.locator('[data-task]').getByRole('button', { name: 'Pedir recomendación de IA' }).click();
    await aceptarTodas(page, 1);
    await expect(page.locator('[data-task]')).toContainText('revisada por la IA simulada');

    // ----- Seguimiento -----
    await page.getByRole('link', { name: 'Seguimiento', exact: true }).first().click();
    await page.getByLabel('Contenido').fill('Terminamos el formulario de asistencia');
    await page.getByRole('button', { name: 'Registrar', exact: true }).click();
    await expect(page.getByText('Registro añadido.')).toBeVisible();
    await page.getByRole('button', { name: 'Completar seguimiento' }).click();
    await expect(page.getByText('Seguimiento completado.')).toBeVisible();

    // ----- Review: guardar y aceptar DOS recomendaciones seguidas -----
    await page.getByRole('link', { name: 'Revisión', exact: true }).first().click();
    await page.getByLabel('Resultados del Sprint').fill('Se completó la historia de asistencia.');
    await page.getByLabel('Incremento presentado').fill('El formulario registra la fecha y la hora.');
    await page.getByLabel('Retroalimentación recibida').fill('El profesor sugirió un resumen semanal.');
    await page.getByLabel('Valoración del Sprint Goal').selectOption('ACHIEVED');
    await page.getByLabel('Explique la valoración').fill('Se logró registrar la asistencia desde el panel.');
    await page.getByRole('button', { name: 'Guardar Review' }).click();
    await expect(page.getByText('Review guardada.')).toBeVisible();
    await page.getByRole('button', { name: 'Pedir recomendación de IA' }).click();
    await aceptarTodas(page, 2); // resultados y explicación de la valoración
    await expect(page.getByLabel('Resultados del Sprint')).toHaveValue(/revisada por la IA simulada/);
    await expect(page.getByLabel('Explique la valoración')).toHaveValue(/revisada por la IA simulada/);
    await page.getByRole('button', { name: 'Evaluar Review' }).click();
    await page.getByRole('button', { name: 'Completar Review' }).click();
    await expect(page.getByText('Review completada.')).toBeVisible();

    // ----- Retrospectiva: listas, acción con responsable, recomendación y cierre -----
    await page.getByRole('link', { name: 'Retrospectiva', exact: true }).first().click();
    await page.getByLabel('Aspectos positivos').fill('El equipo se comunicó bien durante el Sprint');
    await page.getByLabel('Problemas').fill('Las reuniones diarias se alargaron demasiado');
    await page.getByLabel('Oportunidades de mejora').fill('Limitar la reunión diaria a quince minutos');
    await page.getByRole('button', { name: 'Guardar retrospectiva' }).click();
    await expect(page.getByText('Retrospectiva guardada.')).toBeVisible();
    await page.getByLabel('Descripción de la acción').last().fill('Limitar cada reunión diaria a quince minutos con temporizador');
    await page.getByLabel('Responsable').last().selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Agregar acción' }).click();
    await expect(page.locator('[data-action]')).toHaveCount(1);
    // Recomendación sobre las listas: se aceptan los cambios (uno) y el formulario se actualiza.
    await page.getByRole('button', { name: 'Pedir recomendación de IA' }).last().click();
    await aceptarTodas(page, 1);
    await expect(page.getByLabel('Aspectos positivos')).toHaveValue(/Elemento propuesto por la IA simulada/);

    await page.getByRole('button', { name: 'Evaluar retrospectiva' }).click();
    await expect(PANEL(page).getByRole('region', { name: 'Resultado de la evaluación' }).getByRole('heading', { level: 3 })).toContainText('Aprobada');
    await page.getByRole('button', { name: 'Completar retrospectiva y cerrar el Sprint' }).click();
    await expect(page.getByText(/Sprint cerrado/).first()).toBeVisible();

    // El flujo permite continuar con el siguiente Sprint y la conversación del panel se conserva.
    await page.getByRole('link', { name: 'Flujo' }).click();
    await page.getByRole('button', { name: 'Crear Sprint' }).click();
    await expect(page.getByRole('heading', { name: 'Sprint 2' })).toBeVisible();
    await expect(PANEL(page).locator('[data-user-message]').first()).toBeVisible();
  });

  test('chat: Enter envía, Mayús+Enter no; los mensajes propios y los de la IA tienen colores distintos; los errores se ven en rojo', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await register(page);
    await createProject(page, `Chat ${Date.now()}`);
    const cuadro = page.getByLabel('Pregunta al asistente');

    await cuadro.fill('Primera línea');
    await cuadro.press('Shift+Enter');
    await expect(PANEL(page).locator('[data-user-message]')).toHaveCount(0); // Mayús+Enter no envía
    await cuadro.pressSequentially('segunda línea');
    await cuadro.press('Enter');
    await expect(PANEL(page).locator('[data-user-message]')).toHaveCount(1);
    await expect(PANEL(page).locator('[data-user-message]')).toContainText('segunda línea');
    await expect(cuadro).toHaveValue('');
    await expect(PANEL(page).locator('[data-ai-reply]')).toHaveCount(1);

    const fondo = (selector: string) => PANEL(page).locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor);
    const [mio, ia] = [await fondo('[data-user-message]'), await fondo('[data-ai-reply]')];
    expect(mio).not.toBe(ia);

    // Un fallo de la IA se muestra en rojo, con icono y texto; las reglas siguen funcionando.
    await cuadro.fill('FALLO-IA-SIMULADO');
    await cuadro.press('Enter');
    const error = PANEL(page).getByRole('alert').filter({ hasText: /no está disponible/i });
    await expect(error).toBeVisible();
    const colores = await error.evaluate((el) => ({ borde: getComputedStyle(el).borderTopColor, peligro: getComputedStyle(document.documentElement).getPropertyValue('--color-danger').trim() }));
    expect(colores.peligro).not.toBe('');
    await expectAccessible(page);
  });

  test('ayuda en el icono «i» y campos obligatorios en rojo', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'Flujo de escritorio.');
    await register(page);

    // Campo obligatorio vacío: borde y mensaje en rojo al salir del campo, sin enviar el formulario.
    await page.getByRole('link', { name: 'Crear proyecto' }).click();
    const nombre = page.getByLabel('Nombre del proyecto');
    await nombre.focus();
    await page.getByLabel('Descripción').focus();
    await expect(nombre).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Este campo es obligatorio.').first()).toBeVisible();
    const borde = await nombre.evaluate((el) => getComputedStyle(el).borderTopWidth);
    expect(borde).toBe('2px');
    // Al escribir, el aviso desaparece.
    await nombre.fill('Proyecto con ayuda');
    await expect(nombre).not.toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Objetivo del producto').fill('Entregar valor a equipos novatos de Scrum');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Proyecto con ayuda' })).toBeVisible();
    await page.getByRole('button', { name: 'Crear Sprint' }).click();

    // La explicación de la pantalla está en el icono «i», no como texto fijo.
    await page.getByRole('link', { name: 'Planificación', exact: true }).first().click();
    const explicacion = page.getByRole('tooltip').filter({ hasText: /Product Backlog es la lista ordenada/ });
    await expect(explicacion).toBeHidden();
    const icono = page.getByRole('heading', { name: /Planificación del Sprint/ }).locator('..').getByRole('button', { name: 'Más información' });
    await icono.hover();
    await expect(explicacion).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(explicacion).toBeHidden();
    // También con teclado: foco para abrir y Escape para cerrar.
    await icono.focus();
    await expect(explicacion).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(explicacion).toBeHidden();
    await expectAccessible(page);
  });
});
