# Sprint Retrospective de DerramaSoft

Sprint 07

Retrospectiva de cierre reconstruida a partir del backlog vigente, la confirmación de actividades al 100 % y los resultados de pruebas. Fecha de sesión aproximada según el sprint; no se reconstruyen asistencia, votaciones ni firmas.

| Control | Información de cierre |
|---|---|
| Código y versión | DS-RET-S07 / Versión 1.1 / Consolidación 05/11/2026 |
| Proyecto | DerramaSoft .NET 10 y WPF |
| Sprint y periodo | S07 / Planificado 26/10/2026 al 06/11/2026 / Cierre de actividades informado 04/11/2026 |
| Estado | Retrospectiva documental completada; actividades 100 %; calidad con observaciones |
| Fecha y modalidad de sesión | 04/11/2026, 21:30 (Perú), fecha y hora aproximadas de cierre. Reconstrucción documental; modalidad y asistencia no acreditadas. |
| Facilita y registra | Coordinación documental: Jherald Cáceres / Aprobado por: Ariel Taco (roles indicados por el equipo; sin firma añadida) |
| Versiones y evidencias | Fuentes .NET dev 647128617a73ecb13902ab193726a97bf7eeb04f. Registros P02 a P08; Plan de pruebas S07 y Sprint Backlog vigente. |

## 1 Participantes y seguimiento previo

| Integrante | Paquete o función | Participación |
|---|---|---|
| Jherald | P01 Base técnica e interfaz principal | Responsable según selección del backlog; asistencia no reconstruida |
| DANIEL | P02 Acceso, bloqueo y roles | Responsable según selección del backlog; asistencia no reconstruida |
| Wily | P03 Usuarios, bitácora y gestión del sprint | Responsable según selección del backlog; asistencia no reconstruida |
| Giovanni | P04 Padrón de socios | Responsable según selección del backlog; asistencia no reconstruida |
| Andre | P05 Estados del socio, parámetros y tasas | Responsable según selección del backlog; asistencia no reconstruida |
| Luis | P06 Cuentas bancarias y caja | Responsable según selección del backlog; asistencia no reconstruida |
| Yimy | P07 Contabilidad base | Responsable según selección del backlog; asistencia no reconstruida |
| Fidel | P08 Consultas y reportes de caja y contabilidad | Responsable según selección del backlog; asistencia no reconstruida |

| Acción de la retrospectiva anterior | Estado y evidencia | Decisión |
|---|---|---|
| Sin acta previa individualizada localizada para S06. | Las actividades S01–S06 fueron confirmadas al 100 %. El registro web conserva resultados de pruebas distintos de la ejecución .NET. | Mantener la trazabilidad por versión y plataforma; no trasladar aprobaciones de pruebas web a .NET. |

Los nombres identifican responsabilidad de trabajo. El seguimiento siguiente se formula como mejora propuesta, sin atribuir acuerdos de una reunión no documentada.

## 2 Resumen de pruebas y calidad

Consolidación de los siete registros P02–P08, sin nueva ejecución. Cada ID se cuenta una vez; 513 aprobados y 51 no ejecutados = 564 registros.

| Indicador | Cantidad al cierre |
|---|---|
| Total de casos registrados | 564 |
| Aprobadas | 513 |
| Fallidas | 0 |
| Bloqueadas | 0 |
| No ejecutadas | 51 |
| No aplica con justificación | 0 |

Control: 564 = 513 + 0 + 0 + 51 + 0. Hay pendientes aunque no figuren casos fallidos en estos registros.

Suite global informada por P03 el 02/11/2026: 1168 superadas, 0 fallidas y 9 omitidas de 1177. Las suites acumulativas de otros paquetes no se suman. Los resultados con PostgreSQL desechable corresponden a otro entorno/corte. No se certifica el estado actual de CI.

| Criterio de cierre | Verificación |
|---|---|
| HU, tareas y responsables identificados | Ocho paquetes, 34 historias y 130 actividades en el Product Backlog. Casos P02–P08; P01 con evidencia técnica. |
| Versión, resultado y evidencia de casos ejecutados | Sí en el alcance documentado de cada fuente; la versión consultada no sustituye un commit de ejecución no indicado. |
| Correcciones y regresión registradas | Suite y verificación manual según las fuentes; P03-VM-07 conserva observaciones. Sin reejecución documental. |
| Defectos críticos o altos abiertos | No hay casos Fallidos en estos registros. Se mantienen permisos, reglas institucionales, PD-10, PD-12 e impresión en seguimiento; no se infiere ausencia de otros defectos. |
| Pendientes con responsables y acción | Sí: 51 verificaciones manuales No ejecutadas se mantienen; seguimiento propuesto S07-M01–M05. |

| Campo | Información de cierre |
|---|---|
| Conclusión del sprint | Conforme con observaciones documentales. Actividades completadas al 100 % según confirmación del equipo. Los resultados de calidad y sus pendientes se conservan en el resumen de la sección 2. |
| Revisión del equipo | Revisado por Jherald Cáceres. Aprobado por Ariel Taco. Consolidación documental 05/11/2026, por indicación del equipo; no se añade firma ni acta de una sesión no acreditada. |
| Aceptación del usuario | No se localizó acta institucional independiente para afirmar aceptación de la Derrama. El cierre de actividades fue confirmado por el solicitante; la aceptación institucional queda diferenciada. |

El cierre de actividades al 100 % no modifica los estados de pruebas ni acredita aceptación institucional.

## 3 Aprendizajes y acciones de mejora

Los aprendizajes siguientes se sustentan en los registros y se presentan como síntesis documental del cierre.

| Aspecto | Hecho y evidencia | Aprendizaje o mejora |
|---|---|---|
| Qué salió bien | Ocho paquetes delimitados y siete registros con 564 IDs únicos. P03 documenta 13 verificaciones manuales, una con observaciones. | Mantener responsables por paquete y IDs estables con resultados esperados, obtenidos y evidencias. |
| Qué dificultó el trabajo | 51 verificaciones manuales pendientes; suites de distintos cortes y entornos, incluida omisión sin PostgreSQL. | Separar casos de negocio, tests automatizados y aceptación institucional; indicar entorno y versión en cada ejecución. |
| Qué cambiaremos | Faltan verificaciones institucionales y evidencia de impresión física. | Programar verificación manual, conservar evidencias por versión y revisar CI de la candidata antes de la siguiente entrega. |

## 4 Acciones de mejora para el siguiente sprint

| ID | Acción y criterio de cumplimiento | Responsable | Fecha propuesta | Estado |
|---|---|---|---|---|
| S07-M01 | Ejecutar y registrar las 51 verificaciones manuales pendientes con versión, fecha y evidencia. | DANIEL, Giovanni, Andre, Luis, Yimy y Fidel | 09/11/2026 | Pendiente |
| S07-M02 | Confirmar la matriz de permisos y las reglas funcionales propuestas con la Derrama y registrar su decisión. | DANIEL y Wily | 09/11/2026 | Pendiente |
| S07-M03 | Obtener el plan contable aprobado PD-10 y la fecha de inicio PD-12; documentar el resultado. | Yimy y Andre | 09/11/2026 | Pendiente |
| S07-M04 | Verificar impresión física y paginación de reportes con el área contable. | Fidel | 09/11/2026 | Pendiente |
| S07-M05 | Mantener un único registro por ID y comprobar CI de la versión candidata antes de presentar la siguiente entrega. | Jherald y Wily | 09/11/2026 | Pendiente |

## 5 Pendientes y conclusión del equipo

| Pendiente o incidencia | Siguiente acción | Responsable y seguimiento |
|---|---|---|
| 51 casos manuales; confirmación de permisos y reglas; PD-10, PD-12 e impresión física. | Completar evidencia de las verificaciones pendientes y contrastar los hallazgos históricos con la versión candidata, conservando los resultados originales. | Responsables de P02 y P04–P08; coordinación Wily/Jherald. Seguimiento propuesto 09/11/2026. |
| Conclusión documental | Actividades S07 cerradas al 100 %; calidad con pendientes. Consolidación documental: 05/11/2026. Sesión aproximada; acciones propuestas. | Revisado por Jherald Cáceres / Aprobado por Ariel Taco / Consolidación 05/11/2026. |

Prioridad de seguimiento: completar verificaciones manuales y dependencias institucionales. Las fechas de mejora son propuestas y no representan ejecuciones realizadas.

Formato y procedimiento: SP-02, sección 11.2 (Drive del proyecto).

Pruebas consolidadas S07: https://docs.google.com/document/d/1TYf2qKhs3zi12sNf6EqMPWiaD8DZtYo4/edit

Alcance: Sprint Backlog 07 vigente y dev 6471286; fuentes completas en el registro de pruebas.

## 6 Actualización documental del 05 de noviembre de 2026

El paquete adicional aporta 67 capturas actuales de .NET; las 22 de P03 del primer paquete continúan identificadas como históricas del 02/11/2026. Las imágenes se incorporaron al entregable por paquete. No se reconstruyen acuerdos ni asistencia de una nueva sesión.

Aprendizaje de la verificación visual: las pruebas de servicios y modelos no sustituyen el recorrido de edición de una tabla WPF. El voucher no pudo registrarse en la recopilación aportada porque Debe y Haber no admitieron escritura. La revisión estática de 585f2f9 es compatible con el estilo DataGrid de solo lectura informado. La limitación impidió obtener asientos para contrastar libros y estados de P08.

S07-M06 — Propuesta: corregir la edición del voucher y verificar registro, cuadre, consulta y anulación del asiento, con evidencia de la versión utilizada. Responsables propuestos: Yimy (P07), Fidel (P08) y Jherald para revisión. Estado: pendiente de ejecución; fecha por programar.

S07-M07 — Propuesta: verificar el cierre efectivo de sesión de la versión candidata y contrastar los marcadores visibles con el alcance del sprint. Responsables propuestos: DANIEL (P02) y Jherald (P01), con coordinación de Wily. Estado: pendiente de verificación; fecha por programar.

S07-M08 — Propuesta: conservar el inventario de los datos ficticios de derramasoft_dev y acordar su uso o limpieza antes de otra demostración. Responsables propuestos: coordinación del equipo y responsables de los módulos. Estado: inventario recibido; no se realizó limpieza ni modificación de datos en esta actualización.

El cierre de actividades confirmado al 100 % y los 564 resultados históricos se mantienen con su procedencia. Las observaciones nuevas no acreditan aceptación institucional ni aprobación de los recorridos que quedaron bloqueados. Véanse la sección 9 del registro de pruebas y el entregable con capturas.

Evidencias y pendientes del paquete adicional: https://drive.google.com/file/d/1ISRIPyJ90DHoh3XwFjMsuPzMj5x_K59v/view?usp=drivesdk
