# CONTROL DOCUMENTAL

# Sprint Review 07

Proyecto: DerramaSoft .NET y WPF

Código del documento: DS-RV-S07

Área: Ejecución

Versión: 1.1

Estado: documento de cierre completado

Clasificación: Uso interno

Fecha de actualización: 05/11/2026

Elaborado por: Equipo del Proyecto G9

Revisado por: Jherald Cáceres

Aprobado por: Ariel Taco

# Control de cambios

Versión 1.2 | 05/11/2026 | Se añade la sección 13 con capturas y observaciones posteriores; se preserva el cierre histórico.

# SPRINT REVIEW

Proyecto: DerramaSoft .NET y WPF

Sprint: 7 Base técnica, seguridad, socios, caja y contabilidad base

## 1. Datos generales

Fecha: 04/11/2026 (aproximada para el cierre documental)

Hora: 21:00 (aproximada)

Modalidad o lugar: Presencial

Scrum Master: Ariel Taco

Product Owner del equipo: Jherald Cáceres

Equipo relacionado con el incremento: Jherald, DANIEL, Wily, Giovanni, Andre, Luis, Yimy, Fidel. La relación identifica responsables y no reconstruye asistencia nominal.

## 2. Objetivo de la revisión

Revisar el incremento, sus criterios y evidencias, registrar el cierre de actividades y distinguirlo de los resultados de pruebas y de la aceptación institucional.

## 3. Objetivo del sprint

Objetivo: Dejar la solución .NET en capas, el acceso y los roles, usuarios y bitácora, padrón de socios, parámetros, caja, contabilidad manual y reportes funcionando.

## 4. Incremento presentado

Incremento disponible: P01 Base técnica e interfaz principal; P02 Acceso, bloqueo y roles; P03 Usuarios, bitácora y gestión del sprint; P04 Padrón de socios; P05 Estados del socio, parámetros y tasas; P06 Cuentas bancarias y caja; P07 Contabilidad base; P08 Consultas y reportes de caja y contabilidad. Todas las actividades fueron declaradas terminadas por el equipo al corte de cierre.

## 5. Historias de usuario revisadas

| Código | Historia de usuario | Responsable | Estado | Criterio de aceptación | Evidencia |
|---|---|---|---|---|---|
| P01 | Base técnica e interfaz principal | Jherald | Completado | Otro integrante clona, compila y aplica las migraciones siguiendo solo el README; el pipeline queda en verde. | Evidencia P01: Desarrollo S07 y código del repositorio; fuentes al final. |
| P02 | Acceso, bloqueo y roles | DANIEL | Completado | Con un usuario de prueba por rol, cada uno ve solo sus módulos; el 5.º intento fallido bloquea la cuenta y el Administrador la desbloquea. | Evidencia P02: Desarrollo S07 y código del repositorio; fuentes al final. |
| P03 | Usuarios, bitácora y gestión del sprint | Wily | Completado | Un usuario creado inicia sesión con su rol; toda operación de prueba aparece en la bitácora; actas y evidencias publicadas en la carpeta del Sprint 7. | Evidencia P03: Desarrollo S07 y código del repositorio; fuentes al final. |
| P04 | Padrón de socios | Giovanni | Completado | La búsqueda responde en menos de 2 s con el volumen real; el script migra los socios de prueba sin errores y el conteo coincide con el origen. | Evidencia P04: Desarrollo S07 y código del repositorio; fuentes al final. |
| P05 | Estados del socio, parámetros y tasas | Andre | Completado | Un parámetro con vigencia futura no se aplica antes de su fecha; un cambio de estado queda en el historial con fecha y usuario. | Evidencia P05: Desarrollo S07 y código del repositorio; fuentes al final. |
| P06 | Cuentas bancarias y caja | Luis | Completado | Un ingreso, un egreso con cheque y una anulación de prueba quedan registrados con su cuenta, numeración y rastro en la bitácora. | Evidencia P06: Desarrollo S07 y código del repositorio; fuentes al final. |
| P07 | Contabilidad base | Yimy | Completado | Un voucher de prueba cuadra (debe = haber), no se puede registrar en un periodo cerrado y el asiento de apertura carga los saldos iniciales. | Evidencia P07: Desarrollo S07 y código del repositorio; fuentes al final. |
| P08 | Consultas y reportes de caja y contabilidad | Fidel | Completado | Los totales de las consultas coinciden con los movimientos de prueba y el Balance cuadra con el Mayor. | Evidencia P08: Desarrollo S07 y código del repositorio; fuentes al final. |

## 6. Demostración y validación

Incremento revisado: Base técnica, seguridad, socios, caja y contabilidad base. Ver matriz de tareas y evidencia.

Resultado: incremento completado según confirmación del equipo, con las observaciones de verificación registradas.

Evidencias: carpeta Desarrollo del sprint, Product Backlog y repositorio correspondiente. Enlaces y resumen de pruebas al final del documento.

## 7. Retroalimentación del cliente y de los interesados

| N.° | Cliente o interesado | Retroalimentación o comentario | Respuesta o decisión |
|---|---|---|---|
| 1 | Registros P02 a P08 | Los registros de P02 a P08 documentan las pruebas de .NET. El corte global de P03 del 02/11/2026 informa 1168 superadas, 0 fallidas y 9 omitidas de 1177; P03 incluye 13 verificaciones manuales aprobadas, una con observaciones. Otros paquetes mantienen verificaciones manuales pendientes. Los cortes acumulativos no se suman. | Conservar estados originales y resolver las verificaciones pendientes con su responsable. |
| 2 | Equipo del proyecto | Cierre del 100 % de actividades confirmado al 04/11/2026; las fechas aproximadas se usan para completar el registro. | Mantener trazabilidad entre backlog, código y evidencia de cada tarea. |

## 8. Métricas y resultado del sprint

Historias del backlog: 34 (25 funcionales, 8 documentales V6 y GEST-07)

Historias completadas: 34 (cierre confirmado por el equipo)

Actividades pendientes del alcance comprometido: 0 según cierre informado; las verificaciones pendientes se detallan por separado.

Cumplimiento de actividades: 100 % (130 tareas: 91 técnicas y de gestión y 39 correcciones V6).

Resultado general: completado con observaciones de calidad y validación.

## 9. Acuerdos y acciones

| Acuerdo o acción | Responsable | Fecha objetivo | Estado |
|---|---|---|---|
| Consolidar el entregable y resolver las observaciones de pruebas en el siguiente ciclo, con evidencia de reejecución. | Responsables del sprint y revisión de Jherald Cáceres | 09/11/2026 | Cierre documental completado; seguimiento de verificaciones |

## 10. Conclusiones

El Sprint 7 completó el 100 % de sus actividades, según confirmación del equipo al 04/11/2026. Los registros de P02 a P08 documentan las pruebas de .NET. El corte global de P03 del 02/11/2026 informa 1168 superadas, 0 fallidas y 9 omitidas de 1177; P03 incluye 13 verificaciones manuales aprobadas, una con observaciones. Otros paquetes mantienen verificaciones manuales pendientes. Los cortes acumulativos no se suman. La conformidad institucional se acredita en su acta; este cierre documental conserva las observaciones y su seguimiento.

## 11. Conformidad

Representante del producto en el equipo: Jherald Cáceres

Cargo: Product Owner del equipo del proyecto

Observaciones finales: control documental revisado por Jherald Cáceres y aprobado por Ariel Taco. Se conserva la evidencia histórica y se registran las verificaciones pendientes.

Firma del representante del cliente: no incorporada en esta actualización documental.

Firma del Scrum Master: no incorporada en esta actualización documental.

Firma del Product Owner (Jherald Cáceres): no incorporada en esta actualización documental.

12 Fuentes y alcance de la revisión

Product Backlog actualizado: https://docs.google.com/spreadsheets/d/1O7whN4zvQeMf9iSIMy8k8d9TuHpPr61I/edit

Evidencia de Desarrollo: https://drive.google.com/drive/folders/1QfiGr-IyR5yzUmKF2-gtZiGtyOTVf8bl

Código del incremento: https://github.com/AriettaaS/derramasoft-net/tree/647128617a73ecb13902ab193726a97bf7eeb04f

Resultado de pruebas: Los registros de P02 a P08 documentan las pruebas de .NET. El corte global de P03 del 02/11/2026 informa 1168 superadas, 0 fallidas y 9 omitidas de 1177; P03 incluye 13 verificaciones manuales aprobadas, una con observaciones. Otros paquetes mantienen verificaciones manuales pendientes. Los cortes acumulativos no se suman.

Las asignaciones provienen del Sprint_Backlog_07 vigente. Las correcciones V6 conservan sus responsables documentales históricos.

El cierre de actividades fue confirmado por el equipo. Las fechas aproximadas y este registro reconstruido no constituyen evidencia nueva de asistencia, firma o aceptación institucional.

Entregable de Sprint 07 — resumen por tarea o paquete y evidencia técnica: https://docs.google.com/document/d/15ymLCuKpZPoxVd0G22LqTUXmgYjkbeBmchJlUYoPuek

## 13 Evidencias visuales y observaciones del 05 de noviembre de 2026

Se incorporaron al Entregable de Sprint 07 las 89 imágenes aportadas: 22 históricas de P03 del 02/11/2026 y 67 capturas actuales de la aplicación de escritorio fechadas 05/11/2026. La versión ejecutada del paquete adicional no consigna un SHA; el entorno declarado es derramasoft_dev. Son evidencias recibidas, no una reejecución independiente durante esta consolidación.

OBS-S07-20261105-01 — Voucher bloqueado en la interfaz. El informe y las imágenes aportadas no permiten acreditar un asiento registrado: Debe y Haber no admitieron escritura. El código local 585f2f9 presenta un DataGrid global de solo lectura en Estilos/Tema.xaml:118 y no lo anula en VoucherVista.xaml:68. Esta revisión estática es compatible con la causa informada; falta corregir y verificar el recorrido completo. Responsable de seguimiento propuesto: Yimy (P07), con revisión de Jherald.

Impacto en P08. Las consultas de caja muestran los datos ficticios de la recopilación; Diario, Mayor, Balance y Estado de resultados están sin asientos. Esas vistas no acreditan cuadre, impresión ni resultados contables sobre un voucher registrado. La verificación de ese recorrido queda pendiente.

Otras observaciones del paquete: Cerrar sesión abre una pantalla marcador y no se acreditó su cierre efectivo; Aporte y Operaciones muestran Sin opciones en el Sprint 7; no se ejecutó cambio de estado del socio; el historial correspondiente está vacío y la vista de licencias informa que no se registran allí. Deben contrastarse con el alcance y la versión candidata antes de una conformidad técnica final.

El cierre de actividades al 100 % se mantiene como declaración del equipo. Las nuevas observaciones condicionan la verificación funcional actual; no convierten en aprobados los recorridos bloqueados o no ejecutados. Los 564 registros históricos de P02–P08 conservan 513 aprobados y 51 no ejecutados; los resultados de suite se informan por separado.

Los datos ficticios que el paquete declara conservados en derramasoft_dev están inventariados en pendientes.md. Esta actualización documental no eliminó registros, modificó la base ni reparó código. La adenda de la sección 9 del Plan y registro de pruebas conserva la trazabilidad de las observaciones.

Originales y metadatos del primer paquete: https://drive.google.com/file/d/1_TCQqE0u2YHiLEVeVWioS4sbIxeJHxgr/view?usp=drivesdk

Paquete adicional y pendientes actualizados: https://drive.google.com/file/d/1ISRIPyJ90DHoh3XwFjMsuPzMj5x_K59v/view?usp=drivesdk
