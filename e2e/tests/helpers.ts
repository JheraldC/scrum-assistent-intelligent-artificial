import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const PASSWORD = 'una-clave-segura-123';

let counter = 0;
export function uniqueEmail(prefix = 'persona'): string {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@ejemplo.test`;
}

/** Se registra por la interfaz; la aplicación inicia sesión y lleva al panel de proyectos. */
export async function register(page: Page, email = uniqueEmail()): Promise<string> {
  await page.goto('/registro');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/\/proyectos$/);
  return email;
}

export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/entrar');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/proyectos$/);
}

export async function createProject(page: Page, name: string): Promise<void> {
  await page.getByRole('link', { name: 'Crear proyecto' }).click();
  await page.getByLabel('Nombre del proyecto').fill(name);
  await page.getByLabel('Descripción').fill('Proyecto creado por una prueba funcional');
  await page.getByLabel('Objetivo del producto').fill('Entregar valor a equipos novatos de Scrum');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** Comprueba accesibilidad con axe: sin violaciones graves ni críticas (FR-032, SC-010). */
export async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

/** Sin desplazamiento horizontal (ancho de móvil, SC-010). */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
