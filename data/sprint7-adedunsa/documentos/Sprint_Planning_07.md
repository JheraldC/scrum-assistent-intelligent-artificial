CONTROL DOCUMENTAL

Sprint Planning 07

Proyecto: Renovación DerramaSoft (prototipo administrativo de escritorio)

Código: SB S7 PLANNING

Área: Ejecución / Semestre B

Versión: 1.1

Estado: actividades completadas al cierre informado por el equipo

Fecha de actualización: 04/11/2026

Elaborado por: Equipo G9

Revisado por: Jherald Cáceres | Aprobado por: Ariel Taco

SPRINT PLANNING

1. Datos generales

Sprint: 7

Objetivo: base técnica .NET y WPF, seguridad y acceso, usuarios y bitácora, padrón de socios, estados y parámetros, caja, contabilidad base y reportes.

Periodo planificado: 26/10/2026 al 06/11/2026. Cierre de actividades informado: 04/11/2026.

Planning de referencia: 26/10/2026, 21:00, 60 minutos, modalidad virtual (fecha y horario aproximados). Coordinación: Wily, paquete P03.

2. Plan de trabajo del equipo

Jherald — P01: Base técnica e interfaz principal

Punto de partida: alcance y dependencias definidos en el Sprint_Backlog_07 vigente.

Tareas asignadas: S07-T001, S07-T003, S07-T002, S07-T004, S07-T024, S07-T025, S07-T005, S07-T026. Entregables: 1) Repositorio con ramas main/develop y regla de PR revisado. 2) Solución .NET (WPF) en capas compilando. 3) Modelo de datos inicial y migraciones versionadas que se aplican en un PostgreSQL vacío. 4) Pipeline de compilación y pruebas automáticas. 5) Ventana principal con el menú de los 7 módulos y plantilla de ventana de trabajo reutilizable. 6) README «clonar, compilar y migrar». 7) Acta breve de revisión del menú con usuarios. Cierre: 100 % de actividades completadas según confirmación del equipo.

Dependencias y verificaciones: Ruta crítica del sprint: los entregables E1–E4 tienen fecha fija. Tecnología adoptada: C#/.NET 10 y WPF (C-01). Los resultados de pruebas se mantienen según el registro de cada paquete.

Apoyo: integración entre paquetes, revisión por otro integrante y consolidación de evidencias en Drive.

DANIEL — P02: Acceso, bloqueo y roles

Punto de partida: alcance y dependencias definidos en el Sprint_Backlog_07 vigente.

Tareas asignadas: S07-T006, S07-T017, S07-T007, S07-T018, S07-T008, S07-T019, S07-T010, S07-T011, S07-T009, S07-T012, S07-T020. Entregables: 1) Pantalla de inicio de sesión. 2) Servicio de autenticación con contraseña cifrada (bcrypt/Argon2). 3) Bloqueo tras 5 intentos fallidos y opción de desbloqueo. 4) Modelo de roles y permisos (Administrador, Cajero, Contable). 5) Autorización en la capa de aplicación y menú filtrado por rol. 6) Pruebas automáticas de autenticación, bloqueo y permisos + registro de pruebas. Cierre: 100 % de actividades completadas según confirmación del equipo.

Dependencias y verificaciones: Entrega E5 y E6 a P03 y P06. Los resultados de pruebas se mantienen según el registro de cada paquete.

Apoyo: integración entre paquetes, revisión por otro integrante y consolidación de evidencias en Drive.

Wily — P03: Usuarios, bitácora y gestión del sprint

Punto de partida: alcance y dependencias definidos en el Sprint_Backlog_07 vigente.

Tareas asignadas: S07-T086, S07-T087, S07-T021, S07-T013, S07-T022, S07-T023, S07-T014, S07-T015, S07-T016, S07-T090, S07-T091, S07-T088, S07-T089. Entregables: 1) Pantalla y servicio de usuarios (alta, edición, desactivación, rol) y restablecimiento de contraseña. 2) Tabla y servicio de bitácora transversal + consulta con filtros. 3) Actas de Sprint Planning, Daily Scrum, Sprint Review y Retrospectiva. 4) Manual de usuario de los módulos del sprint. 5) Evidencias del sprint consolidadas en Drive. Cierre: 100 % de actividades completadas según confirmación del equipo.

Dependencias y verificaciones: La parte de gestión (GEST-07) corresponde al Scrum Master; se recomienda que la persona de este paquete coordine los eventos. Los resultados de pruebas se mantienen según el registro de cada paquete.

Apoyo: integración entre paquetes, revisión por otro integrante y consolidación de evidencias en Drive.

Giovanni — P04: Padrón de socios

Punto de partida: alcance y dependencias definidos en el Sprint_Backlog_07 vigente.

Tareas asignadas: S07-T027, S07-T030, S07-T029, S07-T028, S07-T031, S07-T032, S07-T033, S07-T034, S07-T050, S07-T051, S07-T052. Entregables: 1) Tablas de socio y catálogos (condición, tipo, régimen). 2) Servicio de socios con validaciones. 3) Pantalla de ficha del socio. 4) Búsqueda por apellido con ventana de coincidencias y botón Actualizar. 5) Control de entrega de la declaración de beneficiarios. 6) Script de migración de socios desde DerramaSoft. 7) Pruebas, incluida la de tiempo de respuesta. Cierre: 100 % de actividades completadas según confirmación del equipo.

Dependencias y verificaciones: Requiere el backup de DerramaSoft anonimizado (C-02). Entrega E8 a P05. Los resultados de pruebas se mantienen según el registro de cada paquete.

Apoyo: integración entre paquetes, revisión por otro integrante y consolidación de evidencias en Drive.

Andre — P05: Estados del socio, parámetros y tasas

Punto de partida: alcance y dependencias definidos en el Sprint_Backlog_07 vigente.

Tareas asignadas: S07-T039, S07-T041, S07-T040, S07-T042, S07-T043, S07-T044, S07-T045, S07-T046, S07-T035, S07-T036, S07-T037, S07-T038. Entregables: 1) Modelo de parámetros con fecha de vigencia, servicio del parámetro vigente y pantalla. 2) Catálogo de tasas «Servicios» con vigencia, estado y reglas de inactivación. 3) Historial de estados del socio, servicio de cambio de estado y pantalla de estados y licencias. 4) Pruebas de vigencias, tasas y estados. Cierre: 100 % de actividades completadas según confirmación del equipo.

Dependencias y verificaciones: Los estados del socio (HU-10) esperan E8 de P04: hacer primero parámetros y tasas. Los resultados de pruebas se mantienen según el registro de cada paquete.

Apoyo: integración entre paquetes, revisión por otro integrante y consolidación de evidencias en Drive.

Luis — P06: Cuentas bancarias y caja

Punto de partida: alcance y dependencias definidos en el Sprint_Backlog_07 vigente.

Tareas asignadas: S07-T047, S07-T048, S07-T049, S07-T054, S07-T053, S07-T055, S07-T065, S07-T066, S07-T067, S07-T056, S07-T057, S07-T058, S07-T059, S07-T060, S07-T061. Entregables: 1) Tablas y pantalla de cuentas bancarias y chequeras. 2) Servicio y pantalla Recibidor/Pagador (ingresos y egresos con concepto, medio de pago y cuenta). 3) Registro de cheques con control de numeración. 4) Anulación con justificación obligatoria registrada en la bitácora. 5) Tipo de recibo caja chica / caja secretaría. 6) Pruebas de cada operación. Cierre: 100 % de actividades completadas según confirmación del equipo.

Dependencias y verificaciones: Entrega E10 a P08. Usa E6 (roles) y E7 (bitácora). Los resultados de pruebas se mantienen según el registro de cada paquete.

Apoyo: integración entre paquetes, revisión por otro integrante y consolidación de evidencias en Drive.

Yimy — P07: Contabilidad base

Punto de partida: alcance y dependencias definidos en el Sprint_Backlog_07 vigente.

Tareas asignadas: S07-T068, S07-T070, S07-T069, S07-T071, S07-T072, S07-T073, S07-T074, S07-T075, S07-T076, S07-T077, S07-T081, S07-T082. Entregables: 1) Modelo, carga inicial y pantalla del plan de cuentas. 2) Apertura y cierre de periodos mensuales y cierre anual con bloqueo. 3) Servicio y pantalla de voucher (asientos manuales). 4) Asiento de apertura con saldos iniciales. 5) Pruebas de periodos, asientos y apertura. Cierre: 100 % de actividades completadas según confirmación del equipo.

Dependencias y verificaciones: Bloqueos externos: plan de cuentas aprobado (PD-10) y fecha de inicio de la contabilidad (PD-12). Entrega E9 y E11 a P08. Los resultados de pruebas se mantienen según el registro de cada paquete.

Apoyo: integración entre paquetes, revisión por otro integrante y consolidación de evidencias en Drive.

Fidel — P08: Consultas y reportes de caja y contabilidad

Punto de partida: alcance y dependencias definidos en el Sprint_Backlog_07 vigente.

Tareas asignadas: S07-T063, S07-T079, S07-T084, S07-T083, S07-T062, S07-T064, S07-T078, S07-T080, S07-T085. Entregables: 1) Consultas de caja por día, mes, rango, usuario y concepto con totales. 2) Libro Diario y Libro Mayor en pantalla e impresión. 3) Balance general y Estado de resultados imprimibles. 4) Pruebas de cuadre contra los datos de prueba. Cierre: 100 % de actividades completadas según confirmación del equipo.

Dependencias y verificaciones: Es el paquete con más dependencias (E9, E10, E11): empieza por los formatos de reporte con datos simulados. Los resultados de pruebas se mantienen según el registro de cada paquete.

Apoyo: integración entre paquetes, revisión por otro integrante y consolidación de evidencias en Drive.

3. Acuerdos y acciones

Asignaciones P01 a P08 confirmadas por la selección del Sprint Backlog. Sus 91 tareas técnicas y de gestión están completadas al cierre informado.

Las 39 correcciones V6 conservan su asignación documental histórica, independiente de los ocho paquetes técnicos. Las validaciones de negocio e institucionales se registran con su resultado real.

Consolidar Planning, Daily, Review, pruebas, retrospectiva y entregable del Sprint 07 con referencias al repositorio derramasoft-net y a las carpetas de Drive.

4. Observaciones

Registro de planificación reconstruido con fechas aproximadas a partir del Sprint Backlog vigente. El equipo confirma el 100 % de actividades terminadas. Los registros de pruebas conservan las verificaciones manuales pendientes y las decisiones PD-10 y PD-12. La aceptación institucional se acredita en su acta cuando exista.
