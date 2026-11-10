import { describe, expect, it } from 'vitest';
import { DOCUMENT_TYPES, EVIDENCE_TYPES, MB, safeFileName, validateUpload } from '../../../src/platform/uploads.js';

const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n');
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

describe('validación de archivos subidos', () => {
  it('acepta texto UTF-8 y devuelve su contenido (sin BOM)', () => {
    const file = validateUpload('Requisitos.md', Buffer.from('﻿# Hola ñandú'), DOCUMENT_TYPES, MB);
    expect(file.text).toBe('# Hola ñandú');
    expect(file.mimeType).toContain('text/markdown');
  });

  it('un PDF válido se guarda sin texto utilizable', () => {
    const file = validateUpload('doc.PDF', pdf, DOCUMENT_TYPES, MB);
    expect(file.text).toBeNull();
    expect(file.mimeType).toBe('application/pdf');
  });

  it('el contenido debe corresponder a la extensión', () => {
    expect(() => validateUpload('falso.pdf', Buffer.from('no soy un pdf'), DOCUMENT_TYPES, MB)).toThrow(/no corresponde/);
    expect(() => validateUpload('falso.png', pdf, EVIDENCE_TYPES, MB)).toThrow(/no corresponde/);
    expect(() => validateUpload('falso.txt', Buffer.from([0x68, 0x00, 0x69]), DOCUMENT_TYPES, MB)).toThrow(/no corresponde/);
    expect(() => validateUpload('malo.txt', Buffer.from([0xff, 0xfe, 0xfd]), DOCUMENT_TYPES, MB)).toThrow(/no corresponde/);
  });

  it('rechaza extensiones fuera de la lista (ejecutables, HTML, SVG, dobles extensiones)', () => {
    for (const name of ['virus.exe', 'pagina.html', 'imagen.svg', 'script.js', 'archivo.pdf.exe', 'sin_extension']) {
      expect(() => validateUpload(name, pdf, EVIDENCE_TYPES, MB), name).toThrow(/no admitido/);
    }
  });

  it('las imágenes solo se admiten como evidencia, no como documentación', () => {
    expect(validateUpload('captura.png', png, EVIDENCE_TYPES, MB).mimeType).toBe('image/png');
    expect(validateUpload('foto.jpeg', jpg, EVIDENCE_TYPES, MB).mimeType).toBe('image/jpeg');
    expect(() => validateUpload('captura.png', png, DOCUMENT_TYPES, MB)).toThrow(/no admitido/);
  });

  it('rechaza archivos vacíos y demasiado grandes', () => {
    expect(() => validateUpload('a.txt', Buffer.alloc(0), DOCUMENT_TYPES, MB)).toThrow(/vacío/);
    expect(() => validateUpload('a.txt', Buffer.alloc(MB + 1, 97), DOCUMENT_TYPES, MB)).toThrow(/tamaño máximo/);
    expect(validateUpload('a.txt', Buffer.alloc(MB, 97), DOCUMENT_TYPES, MB).sizeBytes).toBe(MB);
  });

  it('el nombre se limpia: sin rutas ni caracteres de control', () => {
    expect(safeFileName('..\\..\\etc/passwd')).toBe('passwd');
    expect(safeFileName('a\u0000b"<c>.txt')).toBe('abc.txt');
    expect(safeFileName('')).toBe('archivo');
    expect(safeFileName(`${'x'.repeat(300)}.txt`).length).toBeLessThanOrEqual(120);
  });
});
