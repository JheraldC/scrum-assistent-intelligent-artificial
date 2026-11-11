"""Convierte el paquete «Sprint 7 Base Escritorio y Aportes» (Word y Excel) a Markdown y JSON de solo texto.

Uso:  python convertir.py <carpeta_extraida_del_zip> <carpeta_de_salida>
Requiere: python-docx y openpyxl. No copia imágenes ni binarios; solo texto.
"""
import json
import pathlib
import re
import sys

import docx
import openpyxl
from docx.document import Document as _Doc
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph

NL = chr(10)


def iter_blocks(document: _Doc):
    for child in document.element.body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, document)
        elif child.tag == qn('w:tbl'):
            yield Table(child, document)


def cell_text(cell) -> str:
    return re.sub(r'\s+', ' ', cell.text).strip().replace('|', '/')


def is_heading(text: str, style: str) -> bool:
    """Los Word de origen marcan casi todo como «Heading»: solo se respetan los títulos reales (cortos, sin «:»)."""
    if not style.startswith('heading') and style != 'title':
        return False
    return len(text) <= 90 and ':' not in text and '|' not in text


def docx_to_md(path: pathlib.Path) -> str:
    d = docx.Document(str(path))
    out: list[str] = []
    for block in iter_blocks(d):
        if isinstance(block, Paragraph):
            text = block.text.strip()
            if not text:
                continue
            style = (block.style.name or '').lower()
            m = re.match(r'heading (\d)', style)
            if is_heading(text, style):
                level = int(m.group(1)) + 1 if m else 1
                out.append('#' * min(level, 6) + ' ' + text)
            elif 'list' in style:
                out.append('- ' + text)
            else:
                out.append(text)
        else:
            rows = [[cell_text(c) for c in r.cells] for r in block.rows]
            rows = [r for r in rows if any(r)]
            if not rows:
                continue
            width = max(len(r) for r in rows)
            rows = [r + [''] * (width - len(r)) for r in rows]
            table = ['| ' + ' | '.join(rows[0]) + ' |', '|' + '---|' * width]
            table += ['| ' + ' | '.join(r) + ' |' for r in rows[1:]]
            out.append(NL.join(table))
    text = (NL + NL).join(out)
    return re.sub(r'\n{3,}', NL + NL, text).strip() + NL


def sheet_rows(ws, header_row: int):
    rows = list(ws.iter_rows(min_row=header_row, values_only=True))
    header = [str(h).strip() if h is not None else '' for h in rows[0]]
    result = []
    for r in rows[1:]:
        if not any(v is not None for v in r):
            break
        item = {header[i]: ('' if v is None else str(v).strip()) for i, v in enumerate(r) if header[i]}
        if item.get(header[0], '') == 'Total':
            continue
        result.append(item)
    return result


def main(src: pathlib.Path, dst: pathlib.Path) -> None:
    dst.mkdir(parents=True, exist_ok=True)
    docs_dir = dst / 'documentos'
    docs_dir.mkdir(exist_ok=True)
    for f in sorted(src.rglob('*.docx')):
        name = re.sub(r'[^A-Za-z0-9_.-]+', '_', f.stem).strip('_')
        (docs_dir / f'{name}.md').write_text(docx_to_md(f), encoding='utf-8')
        print('docx ->', name)

    wb = openpyxl.load_workbook(next(src.rglob('Sprint_Backlog_07.xlsx')), data_only=True)
    ws = wb.worksheets[0]
    meta = {}
    wanted = {'Sprint', 'Nombre', 'Objetivo', 'Inicio', 'Fin', 'Capacidad (h)', 'Horas planificadas (tareas)', 'Puntos de historia', 'Personas del equipo'}
    for row in ws.iter_rows(min_row=1, max_row=20, values_only=True):
        if row[0] and row[1] is not None and str(row[0]).strip() in wanted:
            meta[str(row[0]).strip()] = str(row[1]).strip()
    header_stories = next(i for i, r in enumerate(ws.iter_rows(values_only=True), 1) if r[0] == 'Orden')
    header_tasks = next(i for i, r in enumerate(ws.iter_rows(values_only=True), 1) if r[0] == 'ID tarea')
    stories = sheet_rows(ws, header_stories)
    tasks = sheet_rows(ws, header_tasks)
    ws2 = wb.worksheets[1]
    packages = sheet_rows(ws2, next(i for i, r in enumerate(ws2.iter_rows(values_only=True), 1) if r[0] == 'Paquete'))
    (dst / 'sprint_backlog.json').write_text(json.dumps({'meta': meta, 'historias': stories, 'tareas': tasks, 'paquetes': packages}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(stories), 'historias', len(tasks), 'tareas', len(packages), 'paquetes')


if __name__ == '__main__':
    main(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
