import { describe, expect, it } from 'vitest';
import { CSV_BOM, neutralizeFormula, toCsv } from '../../../src/modules/export/csv.js';

describe('escritura de CSV (T119, contracts/export-format.md)', () => {
  it('empieza con BOM UTF-8, lleva cabecera y usa \\r\\n como separador de línea', () => {
    const csv = toCsv(['a', 'b'], [{ a: 1, b: 'x' }, { a: 2, b: 'y' }]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(CSV_BOM).toBe('﻿');
    expect(csv.slice(1)).toBe('a,b\r\n1,x\r\n2,y\r\n');
  });

  it('sin filas devuelve solo la cabecera', () => {
    expect(toCsv(['a', 'b'], []).slice(1)).toBe('a,b\r\n');
  });

  it('respeta el orden de las columnas, no el de las claves del objeto', () => {
    expect(toCsv(['b', 'a'], [{ a: 1, b: 2 }]).slice(1)).toBe('b,a\r\n2,1\r\n');
  });

  describe('escape', () => {
    it.each([
      ['coma', 'uno, dos', '"uno, dos"'],
      ['comillas dobles', 'dijo "hola"', '"dijo ""hola"""'],
      ['salto de línea', 'a\nb', '"a\nb"'],
      ['retorno de carro', 'a\rb', '"a\rb"'],
      ['texto simple', 'simple', 'simple'],
      ['acentos y eñes', 'Sesión del año', 'Sesión del año'],
    ])('%s', (_caso, valor, esperado) => {
      expect(toCsv(['c'], [{ c: valor }]).slice(1)).toBe(`c\r\n${esperado}\r\n`);
    });
  });

  describe('valores especiales', () => {
    it('null y undefined quedan vacíos (nunca se inventan valores)', () => {
      expect(toCsv(['a', 'b', 'c'], [{ a: null, b: undefined, c: 'x' }]).slice(1)).toBe('a,b,c\r\n,,x\r\n');
    });
    it('booleanos como true/false y números sin comillas', () => {
      expect(toCsv(['a', 'b', 'c'], [{ a: true, b: false, c: 42 }]).slice(1)).toBe('a,b,c\r\ntrue,false,42\r\n');
    });
    it('fechas en ISO 8601 UTC con milisegundos', () => {
      const d = new Date('2026-03-10T15:30:00.123Z');
      expect(toCsv(['f'], [{ f: d }]).slice(1)).toBe('f\r\n2026-03-10T15:30:00.123Z\r\n');
    });
    it('objetos como JSON compacto (con escape de comas y comillas)', () => {
      expect(toCsv(['m'], [{ m: { temperatura: 0.2, max: 700 } }]).slice(1)).toBe('m\r\n"{""temperatura"":0.2,""max"":700}"\r\n');
    });
  });

  describe('neutralización de inyección de fórmulas', () => {
    it.each([
      ['=SUMA(A1:A2)', "'=SUMA(A1:A2)"],
      ['+cmd|calc', "'+cmd|calc"],
      ['-2+3', "'-2+3"],
      ['@usuario', "'@usuario"],
      ['\tTabulación inicial', "'\tTabulación inicial"],
      ['\rRetorno inicial', "'\rRetorno inicial"],
    ])('prefija con comilla simple: %j', (entrada, esperado) => {
      expect(neutralizeFormula(entrada)).toBe(esperado);
    });

    it('no toca textos normales ni números', () => {
      expect(neutralizeFormula('texto normal')).toBe('texto normal');
      expect(neutralizeFormula('a=b')).toBe('a=b');
      expect(neutralizeFormula('')).toBe('');
    });

    it('se aplica a cadenas dentro del CSV, no a números ni fechas', () => {
      const csv = toCsv(['t', 'n'], [{ t: '=HYPERLINK("http://malo")', n: -5 }]).slice(1);
      expect(csv).toBe('t,n\r\n"\'=HYPERLINK(""http://malo"")",-5\r\n');
    });
  });

  it('1000 filas se generan sin errores y con el número correcto de líneas', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ n: i, t: `fila ${i}` }));
    const lineas = toCsv(['n', 't'], rows).slice(1).split('\r\n');
    expect(lineas).toHaveLength(1002); // cabecera + 1000 filas + cadena vacía final
  });
});
