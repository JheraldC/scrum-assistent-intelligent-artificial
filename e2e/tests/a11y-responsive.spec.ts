import { expect, test } from '@playwright/test';
import { createProject, expectAccessible, expectNoHorizontalScroll, register } from './helpers';

/** Accesibilidad y diseño responsivo de todas las pantallas (T139, FR-031, FR-032, SC-010). */
const PANTALLAS = [
  { ruta: '', titulo: /Sprint 1/ },
  { ruta: '/backlog', titulo: /Product Backlog/ },
  { ruta: '/sprint/planificacion', titulo: /Planificación/ },
  { ruta: '/sprint/seguimiento', titulo: /Seguimiento del Sprint/ },
  { ruta: '/sprint/revision', titulo: /Revisión del Sprint/ },
  { ruta: '/sprint/retrospectiva', titulo: /Retrospectiva del Sprint/ },
  { ruta: '/validaciones', titulo: /Validaciones|Evaluaciones/ },
  { ruta: '/participantes', titulo: /Participantes/ },
  { ruta: '/historial', titulo: /Exportar datos|Historial/ },
  { ruta: '/ajustes', titulo: /Ajustes|Editar proyecto|Proyecto/ },
];

test.describe('Accesibilidad y diseño responsivo', () => {
  test('cada pantalla del proyecto no tiene violaciones graves ni desplazamiento horizontal y está en español @movil', async ({ page }) => {
    await register(page);
    await createProject(page, `Accesibilidad ${Date.now()}`);
    await page.getByRole('button', { name: 'Crear Sprint' }).click();
    await expect(page.getByRole('heading', { name: /Sprint 1/ })).toBeVisible();
    const base = new URL(page.url()).pathname;

    for (const { ruta, titulo } of PANTALLAS) {
      await page.goto(`${base}${ruta}`);
      await expect(page.getByRole('heading', { name: titulo }).first(), ruta || 'flujo').toBeVisible();
      await expectAccessible(page);
      await expectNoHorizontalScroll(page);
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    }
  });

  test('las pantallas de cuenta y la lista de proyectos son accesibles y responsivas @movil', async ({ page }) => {
    await page.goto('/registro');
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await page.goto('/entrar');
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await register(page);
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await page.getByRole('link', { name: 'Crear proyecto' }).click();
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
  });

  test('se puede operar con teclado: el enlace «Saltar al contenido» es el primer elemento enfocable', async ({ page }) => {
    await page.goto('/entrar');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  });
});
