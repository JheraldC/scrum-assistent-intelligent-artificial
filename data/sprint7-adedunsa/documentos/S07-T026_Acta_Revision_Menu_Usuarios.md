# Acta de revisión con usuarios

Menú principal y ventana de trabajo – DerramaSoft .NET

| Campo | Valor |
|---|---|
| Tarea | S07-T026 – Revisión con usuarios del menú y la ventana de trabajo |
| Historia de usuario | DS-HU-07 – Menú principal con los 7 módulos y ventana de trabajo base |
| Paquete / Sprint | P01 – Base técnica e interfaz principal / Sprint 7 |
| Fecha | ____ / ____ / ________ |
| Hora de inicio y fin | ______ a ______ |
| Lugar o medio |  |
| Versión revisada | Rama ____________ commit ____________ |
| Responsable del acta |  |

## 1. Objetivo

Comprobar con el personal de la Derrama que el menú principal y la ventana de trabajo base les permiten reconocer el sistema actual sin volver a aprenderlo, como pide DS-HU-07.

## 2. Asistentes

| Nombre | Cargo o rol | Área | Firma |
|---|---|---|---|

## 3. Qué se mostró

Marcar lo que efectivamente se mostró en la reunión.

☐  Pantalla inicial al abrir la aplicación.

☐  Menú superior con Aporte, Operaciones, Caja, Contabilidad, Reportes, Mantenimiento y Sistema.

☐  Pantallas de cada módulo previstas en el Sprint 7 (hojas en blanco con su título).

☐  Aviso de los módulos sin pantallas en el Sprint 7 (Aporte y Operaciones).

☐  Barra de estado con usuario y fecha de operación.

☐  Plantilla de ventana de trabajo (búsqueda, resultados, detalle, mensajes y acciones).

☐  Otro: ______________________________________________

## 4. Resultado de los casos de prueba

Detalle de cada caso en el Anexo. Resultado: Cumple / No cumple / No evaluado.

| Caso | Resultado | Comentario |
|---|---|---|
| CP-07-01 |  |  |
| CP-07-02 |  |  |
| CP-07-03 |  |  |
| CP-07-04 |  |  |
| CP-07-05 |  |  |
| CP-07-06 |  |  |
| CP-07-07 |  |  |
| CP-07-08 |  |  |
| CP-07-09 |  |  |

## 5. Observaciones de los usuarios

| N.° | Observación | Pantalla o módulo | Prioridad (A/M/B) |
|---|---|---|---|
| 1 |  |  |  |
| 2 |  |  |  |
| 3 |  |  |  |
| 4 |  |  |  |
| 5 |  |  |  |

## 6. Acuerdos

| N.° | Acuerdo | Responsable | Fecha límite |
|---|---|---|---|
| 1 |  |  |  |
| 2 |  |  |  |
| 3 |  |  |  |
| 4 |  |  |  |

## 7. Conclusión

☐  Se aprueba el menú principal y la ventana de trabajo base.

☐  Se aprueba con observaciones (ver acuerdos).

☐  No se aprueba; se programa una nueva revisión el ____ / ____ / ________.

## 8. Firmas

| Nombre | Rol | Firma |
|---|---|---|
|  | Representante de los usuarios |  |
|  | Responsable de P01 |  |
|  | Revisor del equipo |  |

## Anexo. Casos de prueba de DS-HU-07

Historia: Como personal de la Derrama, quiero el menú principal con los 7 módulos y la ventana de trabajo base, para reconocer el sistema actual sin volver a aprenderlo.

Criterios de aceptación: el menú muestra los 7 módulos; las ventanas siguen un patrón común de búsqueda, detalle y acciones; los mensajes están en español.

Preparación: abrir la aplicación con dotnet run --project src/DerramaSoft.Desktop. No requiere base de datos ni datos reales. CP-07-01 a CP-07-07 también están cubiertos por pruebas automatizadas; CP-07-08 y CP-07-09 requieren a los usuarios.

| ID | Caso | Pasos | Resultado esperado | Resultado obtenido | Estado | Evidencia / Observaciones |
|---|---|---|---|---|---|---|
| CP-07-01 | Pantalla inicial | Abrir la aplicación. | El área principal muestra «Hola mundo» y no hay pestañas abiertas. |  |  |  |
| CP-07-02 | Módulos del menú | Revisar el menú superior. | Se ven, en orden: Aporte, Operaciones, Caja, Contabilidad, Reportes, Mantenimiento y Sistema. |  |  |  |
| CP-07-03 | Pantallas de cada módulo | Desplegar cada módulo. | Caja, Contabilidad, Reportes, Mantenimiento y Sistema muestran solo las pantallas del Sprint 7. |  |  |  |
| CP-07-04 | Módulos sin pantallas | Hacer clic en Aporte y en Operaciones. | Se abre una pestaña con «Sin opciones en el Sprint 7.» |  |  |  |
| CP-07-05 | Abrir una pantalla | Abrir Caja > Cheques. | Se abre la pestaña «Cheques» con la referencia «S07-T057 · DS-HU-16 · P06». |  |  |  |
| CP-07-06 | Pestañas | Abrir dos pantallas, volver a abrir la primera y cerrar una. | No se duplica la pantalla; al cerrar una queda activa otra; al cerrar todas vuelve «Hola mundo». |  |  |  |
| CP-07-07 | Barra de estado | Revisar la parte inferior de la ventana. | Muestra el usuario y la fecha de operación en formato dd/mm/aaaa. |  |  |  |
| CP-07-08 | Patrón de ventana de trabajo | Revisar con los usuarios la plantilla de ventana de trabajo. | Reconocen búsqueda, resultados, detalle, mensajes y acciones (Nuevo, Guardar, Anular, Imprimir, Cerrar); mensajes en español. |  |  |  |
| CP-07-09 | Reconocimiento del sistema | Pedir a un usuario que ubique sin ayuda Cheques, Plan de cuentas y Ficha del socio. | El usuario encuentra las tres opciones en su módulo sin indicaciones. |  |  |  |
