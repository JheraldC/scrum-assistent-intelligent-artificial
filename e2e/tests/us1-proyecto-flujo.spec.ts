import { expect, test } from '@playwright/test';
import { createProject, expectAccessible, expectNoHorizontalScroll, login, register } from './helpers';

test.describe('US1: cuentas, proyectos y flujo guiado', () => {
  test('registro → crear proyecto → ver las 4 etapas pendientes → agregar a otra cuenta @movil', async ({ page, browser }) => {
    const emailAna = await register(page);
    await expect(page.getByText('Todavía no participa en ningún proyecto')).toBeVisible();
    await expectAccessible(page);

    const nombre = `Proyecto e2e ${Date.now()}`;
    await createProject(page, nombre);

    // Flujo guiado: cuatro etapas, todas "Pendiente", con guía de qué se espera.
    const etapas = page.locator('[data-stage]');
    await expect(etapas).toHaveCount(0); // aún no hay Sprint
    await page.getByRole('button', { name: 'Crear Sprint' }).click();
    await expect(etapas).toHaveCount(4);
    for (const estado of await etapas.evaluateAll((els) => els.map((e) => e.getAttribute('data-status')))) {
      expect(estado).toBe('PENDING');
    }
    await expect(page.getByText('Pendiente').first()).toBeVisible();
    await expect(page.getByText('El equipo define el objetivo del Sprint')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);

    // Registrar evidencia mueve la etapa a "En progreso".
    await page.getByLabel('Registrar evidencia').first().fill('Acta de la reunión: https://ejemplo.test/acta');
    await page.getByRole('button', { name: 'Registrar evidencia' }).first().click();
    await expect(page.locator('[data-stage="PLANNING"]')).toHaveAttribute('data-status', 'IN_PROGRESS');

    // Otra cuenta, en otro contexto de navegador.
    const contextoB = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
    const paginaB = await contextoB.newPage();
    const emailBeto = await register(paginaB);
    await expect(paginaB.getByText(nombre)).toHaveCount(0); // no ve proyectos ajenos

    // Ana agrega a Beto como Participante.
    await page.getByRole('link', { name: 'Participantes' }).click();
    await page.getByLabel('Correo electrónico').fill(emailBeto);
    await page.getByRole('button', { name: 'Agregar participante' }).click();
    await expect(page.getByText(emailBeto)).toBeVisible();

    // Beto ahora ve el proyecto como Participante, sin la pestaña de ajustes.
    await paginaB.reload();
    await expect(paginaB.getByRole('link', { name: nombre })).toBeVisible();
    await paginaB.getByRole('link', { name: nombre }).click();
    await expect(paginaB.getByText('Participante', { exact: true }).first()).toBeVisible();
    await expect(paginaB.getByRole('link', { name: 'Ajustes' })).toHaveCount(0);

    await contextoB.close();
    void emailAna;
  });

  test('errores de formulario claros y en español', async ({ page }) => {
    await page.goto('/registro');
    await page.getByLabel('Correo electrónico').fill('correo-invalido');
    await page.getByLabel('Contraseña').fill('corta');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page).toHaveURL(/\/registro$/);

    const email = await register(page);
    await page.getByRole('button', { name: 'Salir' }).click();
    await page.goto('/entrar');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña').fill('clave-incorrecta-123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();
    await login(page, email);
  });
});
