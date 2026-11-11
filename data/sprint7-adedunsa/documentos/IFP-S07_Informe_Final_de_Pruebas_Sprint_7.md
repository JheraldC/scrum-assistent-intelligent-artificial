UNIVERSIDAD NACIONAL DE SAN AGUSTÍN DE AREQUIPA

Facultad de Ingeniería de Producción y Servicios · Escuela Profesional de Ingeniería de Sistemas

IFP-S07

Informe final de pruebas del Sprint 7

Base de escritorio, seguridad, socios, caja y contabilidad

| Proyecto | Aplicativo Web para la Derrama de Docentes de la UNSA |
|---|---|
| Código | IFP-S07 |
| Versión | 1.0 |
| Fecha de emisión | 08/11/2026 |
| Elaborado por | Equipo G9 |
| Revisado por | Jherald Caceres |
| Aprobado por | Ariel Taco |
| Clasificación | Documento de ejecución: registra lo realizado en el sprint y la evidencia que lo respalda |

1. Propósito y alcance

Este documento deja por escrito el resultado final de las pruebas del Sprint 7 («Base de escritorio, seguridad, socios, caja y contabilidad», 26/10/2026 al 06/11/2026). Se elaboró el 08/11/2026 como regularización documental de la carpeta del sprint, que no tenía este documento. Toda la información proviene de los documentos que ya existen en el Drive (entregable, backlog, artefactos e informes de QA); lo que esas fuentes no registran se indica como pendiente y no se completa por inferencia. Las fechas de los sprints son las del Entregable de Sprint (reconstruidas a partir de los registros).

2. Resumen

564 registros de caso con ID único en los paquetes P02 a P08: 513 aprobados y 51 no ejecutados (verificaciones manuales). La suite automatizada global informada es de 1177 pruebas: 1168 superadas, 0 fallidas y 9 omitidas. Los dos conjuntos son distintos y no se suman.

3. Enfoque

Pruebas automatizadas (xUnit con EF Core InMemory o PostgreSQL de pruebas) y verificaciones manuales; versión consultada: commit 6471286 de la rama dev.

4. Resultados

| Indicador | Valor | Referencia |
|---|---|---|
| P02 Acceso y roles (DANIEL) | 37 aprobados / 8 no ejecutados | Total 45 |
| P03 Usuarios y bitácora (Wily) | 98 / 0 | Total 98 |
| P04 Padrón de socios (Giovanni) | 36 / 5 | Total 41 |
| P05 Estados, parámetros y tasas (Andre) | 130 / 11 | Total 141 |
| P06 Cuentas y caja (Luis) | 74 / 10 | Total 84 |
| P07 Contabilidad base (Yimy) | 86 / 10 | Total 96 |
| P08 Consultas y reportes (Fidel) | 52 / 7 | Total 59 |
| Total | 513 / 51 | Total 564 |

5. Observaciones y pendientes

No hay acta institucional de aceptación de la Derrama para el Sprint 7.

Pendiente para el 09/11/2026 (retrospectiva): ejecutar las 51 verificaciones manuales (S07-M01), confirmar la matriz de permisos (S07-M02), obtener el plan contable aprobado PD-10 y la fecha de inicio PD-12 (S07-M03), verificar la impresión física de reportes (S07-M04).

El paquete P01 no figura en el consolidado de casos: sus pruebas son 29 + 1 + 29 y su CI se verificó en GitHub Actions (cuatro ejecuciones, la última correcta el 23/10/2026).

6. Fuentes

Plan de pruebas de DerramaSoft Sprint 7 (DS-PP-01 v1.3), Sprint Retrospective 07, S07-P01_Evidencias_Base_Tecnica.

7. Aprobación

Revisado por: pendiente. Aprobado por: pendiente. El informe resume registros ya existentes; no sustituye a la aprobación del responsable de calidad.

8. Control de cambios

| Versión | Fecha | Descripción | Responsable |
|---|---|---|---|
| 1.0 | 08/11/2026 | Emisión inicial: informe final de pruebas del sprint, que la carpeta no tenía. | Equipo G9 |
