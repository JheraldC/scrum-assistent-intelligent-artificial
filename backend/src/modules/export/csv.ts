// Escritura de CSV (contracts/export-format.md): UTF-8 con BOM, coma, comillas dobles, \r\n,
// cabecera obligatoria y neutralización de inyección de fórmulas.

export const CSV_BOM = '﻿';

/**
 * Las celdas de texto que empiezan por =, +, -, @, tabulación o retorno de carro se prefijan con
 * una comilla simple para que las hojas de cálculo no las interpreten como fórmulas.
 */
export function neutralizeFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (typeof value === 'string') text = neutralizeFormula(value);
  else if (value instanceof Date) text = value.toISOString();
  else if (typeof value === 'object') text = JSON.stringify(value);
  else text = String(value); // números y booleanos: no se neutralizan
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns: readonly string[], rows: readonly Record<string, unknown>[]): string {
  const lines = [columns.join(','), ...rows.map((row) => columns.map((c) => cell(row[c])).join(','))];
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`;
}
