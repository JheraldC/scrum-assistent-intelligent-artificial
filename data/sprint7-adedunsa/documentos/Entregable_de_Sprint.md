# Entregable de Sprint

Sprint 07 · Base de escritorio, seguridad, socios, caja y contabilidad

Periodo: 26/10/2026 al 06/11/2026. Fechas aproximadas reconstruidas a partir de los registros. Cierre de actividades informado el 04/11/2026.

| Control | Detalle |
|---|---|
| Revisado por | Jherald Cáceres |
| Aprobado por | Ariel Taco |
| Estado | Actividades completadas al 100 %; resultados de pruebas conservados. |
| Plataforma | DerramaSoft .NET 10 / WPF |
| Versión de evidencia | 647128617a73ecb13902ab193726a97bf7eeb04f |

## Resultado y alcance

Ocho paquetes técnicos: 91 tareas; además, 39 correcciones documentales V6. Registros P02–P08: 564 casos únicos, 513 aprobados y 51 no ejecutados. Suite global informada: 1168 superados y 9 omitidos de 1177; ambos universos se mantienen separados.

Las asignaciones proceden del Product Backlog y del Sprint Backlog vigente. Las imágenes de código son extractos de archivos reales consultados y se identifican como tales; no representan capturas de una ejecución de la aplicación. Las evidencias actuales corroboran artefactos conservados, sin atribuir su apariencia a una fecha histórica. La revisión no ejecuta nuevamente las pruebas ni añade firmas.

Sprint Review correspondiente

Product Backlog actualizado

Evidencias visuales recibidas. Evidencia visual aportada: 89 capturas. Las 22 de P03 proceden de la ejecución histórica del 02/11/2026 y coinciden con el commit 6471286. Las 67 adicionales están fechadas 05/11/2026 y corresponden a una compilación local Release sobre derramasoft_dev, sin SHA de ejecución consignado. El código local consultado para contrastar el voucher es 585f2f9. Los registros históricos de pruebas mantienen su propio corte; las nuevas observaciones no se suman a sus 564 casos.

Originales y metadatos: https://drive.google.com/file/d/1_TCQqE0u2YHiLEVeVWioS4sbIxeJHxgr/view?usp=drivesdk

Paquete adicional: https://drive.google.com/file/d/1ISRIPyJ90DHoh3XwFjMsuPzMj5x_K59v/view?usp=drivesdk

## P01 · Base técnica e interfaz principal

Responsable seleccionado: Jherald | 8 tareas técnicas | Actividades completadas al 100 %.

Propósito del paquete: Dejar la solución, la base de datos y la ventana principal listas para que los otros siete paquetes integren su trabajo.

Entregables del alcance: 1) Repositorio con ramas main/develop y regla de PR revisado. 2) Solución .NET (WPF) en capas compilando. 3) Modelo de datos inicial y migraciones versionadas que se aplican en un PostgreSQL vacío. 4) Pipeline de compilación y pruebas automáticas. 5) Ventana principal con el menú de los 7 módulos y plantilla de ventana de trabajo reutilizable. 6) README «clonar, compilar y migrar». 7) Acta breve de revisión del menú con usuarios.

Figura 1. Artefacto técnico de P01 en el commit consultado; no es captura de ejecución.

Abrir fuente versionada: README.md

Versión 647128617a73 | Líneas 1–16. El fragmento permite ubicar el artefacto; el enlace contiene el archivo completo.

P01 se sustenta en la solución, README, estructura en capas, migraciones y configuración CI. La existencia del flujo no certifica que la última ejecución de CI sea satisfactoria. El acta de revisión del menú no se sustituye por una captura de código.

### Tareas cubiertas por el paquete

| ID / historia | Resumen del trabajo realizado | Evidencia |
|---|---|---|
| S07-T001 DS-HU-01 | Crear repositorio, ramas y política de revisión | P01: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T002 DS-HU-01 | Estructurar la solución .NET en capas — la arquitectura en capas, el repositorio y la base PostgreSQL con el esquema inicial | P01: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T003 DS-HU-01 | Diseñar el modelo de datos inicial (socio, usuario, rol, bitácora, parámetro) | P01: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T004 DS-HU-01 | Configurar migraciones versionadas de la base | P01: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T005 DS-HU-01 | Configurar compilación y pruebas automáticas — la arquitectura en capas, el repositorio y la base PostgreSQL con el esquema inicial | P01: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T024 DS-HU-07 | Ventana principal y menú — el menú principal con los 7 módulos y la ventana de trabajo base | P01: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T025 DS-HU-07 | Plantilla de ventana de trabajo reutilizable — el menú principal con los 7 módulos y la ventana de trabajo base | P01: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T026 DS-HU-07 | Revisión con usuarios — el menú principal con los 7 módulos y la ventana de trabajo base | P01: artefacto y registro enlazados; cierre del backlog confirmado. |

Observación de evidencia. La ventana y los menús tienen capturas actuales. Aporte y Operaciones muestran Sin opciones en el Sprint 7; se documenta el marcador visible sin atribuir funciones adicionales a esos módulos.

Captura S07-C23 · Menú Aporte

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. El menú no despliega entradas; abre una pantalla marcador 'Sin opciones en el Sprint 7'. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C24 · Menú Caja

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Entradas: Recibidor/Pagador, Cheques, Anulación de movimientos, Consultas de caja. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C25 · Menú Contabilidad

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Entradas: Plan de cuentas, Periodos contables, Voucher, Libro Diario y Libro Mayor. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C26 · Menú Mantenimiento

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Entradas: Socio, Estados y licencias, Parámetros, Tasas «Servicios», Cuentas bancarias y chequeras. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C27 · Menú Operaciones

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. El menú no despliega entradas; abre una pantalla marcador 'Sin opciones en el Sprint 7'. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C28 · Menú Reportes

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Entrada: Balance general y Estado de resultados. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C29 · Menú Sistema

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Entradas: Cerrar sesión, Usuarios, Desbloqueo de cuentas, Bitácora. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C30 · Navegación por pestañas

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Varias pantallas abiertas a la vez (Aporte, Operaciones, Socio, Consultas de caja, Usuarios). Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C31 · Ventana principal

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Ventana principal tras iniciar sesión (demo.admin): menú de 7 módulos, barra de estado con usuario, rol y fecha de operación. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

## P02 · Acceso, bloqueo y roles

Responsable seleccionado: DANIEL | 11 tareas técnicas | Actividades completadas al 100 %.

Propósito del paquete: Que solo el personal autorizado entre al sistema y que cada rol vea únicamente sus módulos.

Entregables del alcance: 1) Pantalla de inicio de sesión. 2) Servicio de autenticación con contraseña cifrada (bcrypt/Argon2). 3) Bloqueo tras 5 intentos fallidos y opción de desbloqueo. 4) Modelo de roles y permisos (Administrador, Cajero, Contable). 5) Autorización en la capa de aplicación y menú filtrado por rol. 6) Pruebas automáticas de autenticación, bloqueo y permisos + registro de pruebas.

Figura 2. Artefacto técnico de P02 en el commit consultado; no es captura de ejecución.

Abrir fuente versionada: src/DerramaSoft.Desktop/Vistas/P02/LoginWindow.xaml

Versión 647128617a73 | Líneas 1–16. El fragmento permite ubicar el artefacto; el enlace contiene el archivo completo.

Registro de calidad: 45 casos; 37 aprobados y 8 no ejecutados. Los resultados conservan el corte y entorno de la fuente.

Registro completo P02

### Tareas cubiertas por el paquete

| ID / historia | Resumen del trabajo realizado | Evidencia |
|---|---|---|
| S07-T006 DS-HU-02 | Pantalla de inicio de sesión (WPF) — iniciar sesión con usuario y contraseña cifrada | P02: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T007 DS-HU-02 | Servicio de autenticación con bcrypt/Argon2 — iniciar sesión con usuario y contraseña cifrada | P02: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T008 DS-HU-02 | Carga de módulos según el rol — iniciar sesión con usuario y contraseña cifrada | P02: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T009 DS-HU-02 | Pruebas de autenticación — iniciar sesión con usuario y contraseña cifrada | P02: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T010 DS-HU-03 | Contador de intentos y bloqueo temporal — que una cuenta se bloquee tras 5 intentos fallidos y poder desbloquearla | P02: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T011 DS-HU-03 | Opción de desbloqueo en Sistema — que una cuenta se bloquee tras 5 intentos fallidos y poder desbloquearla | P02: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T012 DS-HU-03 | Pruebas de bloqueo — que una cuenta se bloquee tras 5 intentos fallidos y poder desbloquearla | P02: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T017 DS-HU-05 | Modelo de roles y permisos por módulo y acción | P02: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T018 DS-HU-05 | Autorización en la capa de aplicación — roles predefinidos (Administrador, Cajero, Contable) que limiten los módulos visibles | P02: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T019 DS-HU-05 | Ocultar opciones del menú según el rol — roles predefinidos (Administrador, Cajero, Contable) que limiten los módulos visibles | P02: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T020 DS-HU-05 | Pruebas por rol — roles predefinidos (Administrador, Cajero, Contable) que limiten los módulos visibles | P02: artefacto y registro enlazados; cierre del backlog confirmado. |

Observación de evidencia. Hay capturas actuales de bloqueo, desbloqueo y menús por rol. Cerrar sesión muestra una pantalla marcador, según el paquete aportado; no se obtuvo cierre efectivo mediante esa entrada. No se modifican los estados históricos de pruebas por estas observaciones.

Captura S07-C32 · Sistema > Cerrar sesión

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. La entrada abre una pantalla marcador (S07-T006) sin botones; no cierra la sesión por sí sola. Hallazgo: para cambiar de usuario hubo que cerrar y reabrir la app. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C33 · Sistema > Desbloqueo de cuentas

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Cuenta prueba.captura con 5 intentos fallidos y fecha de bloqueo. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C34 · Sistema > Desbloqueo de cuentas

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Resultado: 'La cuenta fue desbloqueada. Ya puede iniciar sesión'. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C35 · Bloqueo de cuenta

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. La cuenta sigue bloqueada aunque se use la contraseña correcta. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C36 · Inicio de sesión

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Usuario demo.admin y contraseña enmascarada antes de ingresar. Contraseña mostrada solo como puntos. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C37 · Inicio de sesión

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Mensaje 'Usuario o contraseña incorrectos' con la cuenta de prueba prueba.captura. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C38 · Bloqueo de cuenta

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Mensaje de cuenta bloqueada tras el 5.º intento fallido seguido. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C39 · Inicio de sesión

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Ventana de inicio de sesión sin datos. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C40 · Permisos por rol: Cajero

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Cajero: Caja con Recibidor/Pagador, Cheques, Anulación y Consultas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C41 · Permisos por rol: Cajero

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Cajero: Mantenimiento solo muestra Socio. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C42 · Permisos por rol: Cajero

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Menú del rol Cajero: solo Caja y Mantenimiento. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C43 · Permisos por rol: Contable

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Contable: Caja solo muestra Consultas de caja. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C44 · Permisos por rol: Contable

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Contable: Contabilidad completa. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C45 · Permisos por rol: Contable

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Contable: Reportes con Balance y Estado de resultados. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C46 · Permisos por rol: Contable

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Menú del rol Contable: Caja, Contabilidad y Reportes. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C47 · Sistema > Usuarios

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Alta del usuario de prueba prueba.captura (rol Cajero) con contraseña enmascarada. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C48 · Sistema > Usuarios

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Usuario prueba.captura creado y listado. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C49 · Sistema > Usuarios

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Lista de usuarios y formulario de alta (demo.admin, demo.cajero, demo.contable, prueba.cajero). Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

## P03 · Usuarios, bitácora y gestión del sprint

Responsable seleccionado: Wily | 13 tareas técnicas | Actividades completadas al 100 %.

Propósito del paquete: Administrar usuarios, dejar el servicio de bitácora que usan todos los módulos y llevar los eventos Scrum del sprint.

Entregables del alcance: 1) Pantalla y servicio de usuarios (alta, edición, desactivación, rol) y restablecimiento de contraseña. 2) Tabla y servicio de bitácora transversal + consulta con filtros. 3) Actas de Sprint Planning, Daily Scrum, Sprint Review y Retrospectiva. 4) Manual de usuario de los módulos del sprint. 5) Evidencias del sprint consolidadas en Drive.

Figura 3. Artefacto técnico de P03 en el commit consultado; no es captura de ejecución.

Abrir fuente versionada: src/DerramaSoft.Desktop/Vistas/P03/UsuariosVista.xaml

Versión 647128617a73 | Líneas 1–16. El fragmento permite ubicar el artefacto; el enlace contiene el archivo completo.

Registro de calidad: 98 casos; 98 aprobados y 0 no ejecutados. Los resultados conservan el corte y entorno de la fuente.

Registro completo P03

### Tareas cubiertas por el paquete

| ID / historia | Resumen del trabajo realizado | Evidencia |
|---|---|---|
| S07-T013 DS-HU-04 | Pantalla de usuarios (lista, alta, edición) — crear, editar y desactivar usuarios asignándoles un rol | P03: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T014 DS-HU-04 | Servicio de gestión de usuarios — crear, editar y desactivar usuarios asignándoles un rol | P03: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T015 DS-HU-04 | Restablecimiento de contraseña — crear, editar y desactivar usuarios asignándoles un rol | P03: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T016 DS-HU-04 | Pruebas de gestión de usuarios — crear, editar y desactivar usuarios asignándoles un rol | P03: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T021 DS-HU-06 | Tabla y servicio de bitácora transversal — una bitácora de las operaciones y cambios | P03: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T022 DS-HU-06 | Consulta de bitácora con filtros — una bitácora de las operaciones y cambios | P03: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T023 DS-HU-06 | Pruebas de bitácora — una bitácora de las operaciones y cambios | P03: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T086 GEST-07 | Sprint Planning: acta, objetivo y Sprint Backlog publicado en 01_Sprint_Backlog y 05_Sprint_Planning | P03: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T087 GEST-07 | Daily Scrum: registro de las reuniones diarias con impedimentos y responsables | P03: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T088 GEST-07 | Sprint Review con la Derrama: demostración, observaciones y aceptación (solo si ocurre) | P03: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T089 GEST-07 | Retrospectiva: acciones de mejora con responsable y fecha | P03: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T090 GEST-07 | Actualizar el manual de usuario de los módulos del sprint | P03: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T091 GEST-07 | Consolidar evidencias del sprint (PR, capturas, registros de prueba) en 03_Desarrollo y 04_Artefactos | P03: artefacto y registro enlazados; cierre del backlog confirmado. |

Observación de evidencia. Las 22 imágenes de esta sección son históricas, del registro del 02/11/2026, y no una reejecución del 05/11/2026. El caso P03-VM-07 conserva las observaciones de su registro fuente.

Captura S07-C01 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Alta de usuario: formulario.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-01a-alta-formulario.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C02 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Usuario creado.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-01b-usuario-creado.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C03 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Rechazo por nombre duplicado.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-02-nombre-duplicado.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C04 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Prueba con rol cajero: menú.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-03-prueba-cajero-menu.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C05 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Prueba cajero: mantenimiento.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-03b-prueba-cajero-mantenimiento.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C06 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Cambio de rol.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-04a-cambio-de-rol.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C07 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Nuevo rol: menú.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-04c-nuevo-rol-menu.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C08 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Cuenta inactiva.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-05-cuenta-inactiva.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C09 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Cuenta reactivada.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-06a-cuenta-reactivada.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C10 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Reactivada entra.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-06b-reactivada-entra.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C11 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Lista con usuario bloqueado. Caso P03-VM-07: conserva las observaciones del registro fuente.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-07b-lista-bloqueado.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C12 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Restablecer contraseña. Caso P03-VM-07: conserva las observaciones del registro fuente.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-07c-restablecer-contrasena.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C13 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Contraseña restablecida. Caso P03-VM-07: conserva las observaciones del registro fuente.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-07d-contrasena-restablecida.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C14 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Entra con la nueva contraseña. Caso P03-VM-07: conserva las observaciones del registro fuente.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-07e-entra-con-la-nueva.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C15 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Clave anterior rechazada. Caso P03-VM-07: conserva las observaciones del registro fuente.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-07f-clave-anterior-rechazada.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C16 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Autodesactivación.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-08-autodesactivacion.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C17 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Demo cajero sin sistema.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-09-demo-cajero-sin-sistema.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C18 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Bitácora sin filtros.  Relación: P03, S07-T021. Fuente: docs/P03/capturas/P03-VM-10a-bitacora-sin-filtros.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C19 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Bitácora filtrada.  Relación: P03, S07-T021. Fuente: docs/P03/capturas/P03-VM-10b-bitacora-filtrada.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C20 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Detalle valor anterior/nuevo.  Relación: P03, S07-T021. Fuente: docs/P03/capturas/P03-VM-11-detalle-valor-anterior-nuevo.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C21 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Bitácora: limpiar filtros.  Relación: P03, S07-T021. Fuente: docs/P03/capturas/P03-VM-12-bitacora-limpiar.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

Captura S07-C22 · Aplicación de escritorio WPF DerramaSoft

Evidencia histórica del 02/11/2026; recuperada y aportada el 05/11/2026. Prueba cajero desactivada.  Relación: P03, S07-T013. Fuente: docs/P03/capturas/P03-VM-13-prueba-cajero-desactivada.png; commit 647128617a73ecb13902ab193726a97bf7eeb04f. Coincidencia binaria comprobada.

## P04 · Padrón de socios

Responsable seleccionado: Giovanni | 11 tareas técnicas | Actividades completadas al 100 %.

Propósito del paquete: Tener un padrón único de socios, con búsqueda rápida y migrado desde DerramaSoft.

Entregables del alcance: 1) Tablas de socio y catálogos (condición, tipo, régimen). 2) Servicio de socios con validaciones. 3) Pantalla de ficha del socio. 4) Búsqueda por apellido con ventana de coincidencias y botón Actualizar. 5) Control de entrega de la declaración de beneficiarios. 6) Script de migración de socios desde DerramaSoft. 7) Pruebas, incluida la de tiempo de respuesta.

Figura 4. Artefacto técnico de P04 en el commit consultado; no es captura de ejecución.

Abrir fuente versionada: src/DerramaSoft.Desktop/Vistas/P04/FichaSocioVista.xaml

Versión 647128617a73 | Líneas 1–16. El fragmento permite ubicar el artefacto; el enlace contiene el archivo completo.

Registro de calidad: 41 casos; 36 aprobados y 5 no ejecutados. Los resultados conservan el corte y entorno de la fuente.

Registro completo P04

### Tareas cubiertas por el paquete

| ID / historia | Resumen del trabajo realizado | Evidencia |
|---|---|---|
| S07-T027 DS-HU-08 | Tablas de socio y catálogos (condición, tipo, régimen) | P04: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T028 DS-HU-08 | Servicio de socios con validaciones — registrar y editar la ficha del socio | P04: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T029 DS-HU-08 | Pantalla de ficha del socio — registrar y editar la ficha del socio | P04: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T030 DS-HU-08 | Script de migración de socios desde DerramaSoft | P04: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T031 DS-HU-08 | Pruebas de la ficha — registrar y editar la ficha del socio | P04: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T032 DS-HU-09 | Consulta indexada por apellido — buscar socios por apellido con ventana de coincidencias y botón Actualizar | P04: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T033 DS-HU-09 | Ventana de coincidencias — buscar socios por apellido con ventana de coincidencias y botón Actualizar | P04: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T034 DS-HU-09 | Prueba de tiempo de respuesta — buscar socios por apellido con ventana de coincidencias y botón Actualizar | P04: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T050 DS-HU-14 | Campos de control en la ficha — registrar que el socio entregó su declaración de beneficiarios en sobre cerrado | P04: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T051 DS-HU-14 | Ajuste de la pantalla del socio — registrar que el socio entregó su declaración de beneficiarios en sobre cerrado | P04: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T052 DS-HU-14 | Prueba — registrar que el socio entregó su declaración de beneficiarios en sobre cerrado | P04: artefacto y registro enlazados; cierre del backlog confirmado. |

Observación de evidencia. El adicional muestra el padrón, búsqueda y cinco pestañas de la ficha del socio en .NET. La ficha se recorrió sin guardar, según el CSV. Los datos demostrativos se identifican en el entorno aportado.

Captura S07-C50 · Mantenimiento > Socio

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Búsqueda por apellido 'Apaza': 2 socios. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C51 · Ficha del socio

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Pestaña 1 · Datos personales (socio de demostración). Se abrió con Modificar y se cerró con Cancelar; no se guardó nada. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C52 · Ficha del socio

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Pestaña 2 · Datos familiares. Sin guardar. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C53 · Ficha del socio

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Pestaña 3 · Domicilio. Sin guardar. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C54 · Ficha del socio

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Pestaña 4 · Centro de trabajo. Sin guardar. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C55 · Ficha del socio

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Pestaña 5 · Inscripción. Sin guardar. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C56 · Mantenimiento > Socio

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Padrón de socios (datos de demostración, DNI 9000000x). Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

## P05 · Estados del socio, parámetros y tasas

Responsable seleccionado: Andre | 12 tareas técnicas | Actividades completadas al 100 %.

Propósito del paquete: Configurar los parámetros y tasas con vigencia y registrar los cambios de estado del socio con su historial.

Entregables del alcance: 1) Modelo de parámetros con fecha de vigencia, servicio del parámetro vigente y pantalla. 2) Catálogo de tasas «Servicios» con vigencia, estado y reglas de inactivación. 3) Historial de estados del socio, servicio de cambio de estado y pantalla de estados y licencias. 4) Pruebas de vigencias, tasas y estados.

Figura 5. Artefacto técnico de P05 en el commit consultado; no es captura de ejecución.

Abrir fuente versionada: src/DerramaSoft.Desktop/Vistas/P05/TasasVista.xaml

Versión 647128617a73 | Líneas 1–16. El fragmento permite ubicar el artefacto; el enlace contiene el archivo completo.

Registro de calidad: 141 casos; 130 aprobados y 11 no ejecutados. Los resultados conservan el corte y entorno de la fuente.

Registro completo P05

### Tareas cubiertas por el paquete

| ID / historia | Resumen del trabajo realizado | Evidencia |
|---|---|---|
| S07-T035 DS-HU-10 | Tabla de historial de estados — registrar los cambios de estado del socio con su historial | P05: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T036 DS-HU-10 | Servicio de cambio de estado — registrar los cambios de estado del socio con su historial | P05: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T037 DS-HU-10 | Pantalla de estados y licencias — registrar los cambios de estado del socio con su historial | P05: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T038 DS-HU-10 | Pruebas de estados — registrar los cambios de estado del socio con su historial | P05: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T039 DS-HU-11 | Modelo de parámetros con vigencia — editar los parámetros del sistema con fecha de vigencia | P05: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T040 DS-HU-11 | Servicio de lectura del parámetro vigente — editar los parámetros del sistema con fecha de vigencia | P05: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T041 DS-HU-11 | Pantalla de parámetros — editar los parámetros del sistema con fecha de vigencia | P05: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T042 DS-HU-11 | Pruebas de vigencias — editar los parámetros del sistema con fecha de vigencia | P05: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T043 DS-HU-12 | Tabla de tasas con vigencia y estado — gestionar el catálogo de tasas «Servicios» | P05: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T044 DS-HU-12 | Reglas de inactivación — gestionar el catálogo de tasas «Servicios» | P05: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T045 DS-HU-12 | Pantalla de tasas — gestionar el catálogo de tasas «Servicios» | P05: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T046 DS-HU-12 | Pruebas de tasas — gestionar el catálogo de tasas «Servicios» | P05: artefacto y registro enlazados; cierre del backlog confirmado. |

Observación de evidencia. Se observan parámetros y tasa de servicio de demostración. No se ejecutó cambio de estado; el historial quedó vacío. La pantalla de licencias muestra que no se registran allí, según el paquete. No se atribuye verificación funcional completa a esas dos vistas.

Captura S07-C57 · Mantenimiento > Estados y licencias

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Socio de demostración con estado actual 'Pasivo voluntario' e historial vacío. No se cambió el estado: el cambio queda registrado y no se puede corregir. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C58 · Mantenimiento > Estados y licencias

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Pantalla inicial: búsqueda de socio e historial de estados. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C59 · Mantenimiento > Parámetros

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Pantalla sin parámetros registrados. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C60 · Mantenimiento > Parámetros

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Lista con DEMO_EVIDENCIA y CONTABILIDAD_FECHA_INICIO (20261101). Datos ficticios creados en la BD de pruebas. CONTABILIDAD_FECHA_INICIO se registró para poder abrir un periodo contable en la prueba. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C61 · Mantenimiento > Parámetros

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Formulario con el parámetro ficticio DEMO_EVIDENCIA (valor 100). Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C62 · Mantenimiento > Parámetros

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Valor agregado: historial con vigencia desde 05/11/2026. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C63 · Mantenimiento > Tasas «Servicios»

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Formulario con la tasa ficticia DEMO_SERVICIO (5 %). Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C64 · Mantenimiento > Tasas «Servicios»

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Tasa registrada, vigente desde 05/11/2026. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C65 · Mantenimiento > Tasas «Servicios»

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Pantalla sin tasas registradas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

## P06 · Cuentas bancarias y caja

Responsable seleccionado: Luis | 15 tareas técnicas | Actividades completadas al 100 %.

Propósito del paquete: Registrar ingresos, egresos y cheques asociados a cuentas bancarias, con anulación trazable.

Entregables del alcance: 1) Tablas y pantalla de cuentas bancarias y chequeras. 2) Servicio y pantalla Recibidor/Pagador (ingresos y egresos con concepto, medio de pago y cuenta). 3) Registro de cheques con control de numeración. 4) Anulación con justificación obligatoria registrada en la bitácora. 5) Tipo de recibo caja chica / caja secretaría. 6) Pruebas de cada operación.

Figura 6. Artefacto técnico de P06 en el commit consultado; no es captura de ejecución.

Abrir fuente versionada: src/DerramaSoft.Desktop/Vistas/P06/RecibidorPagadorVista.xaml

Versión 647128617a73 | Líneas 1–16. El fragmento permite ubicar el artefacto; el enlace contiene el archivo completo.

Registro de calidad: 84 casos; 74 aprobados y 10 no ejecutados. Los resultados conservan el corte y entorno de la fuente.

Registro completo P06

### Tareas cubiertas por el paquete

| ID / historia | Resumen del trabajo realizado | Evidencia |
|---|---|---|
| S07-T047 DS-HU-13 | Tablas de cuentas y chequeras — registrar las cuentas bancarias y sus chequeras | P06: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T048 DS-HU-13 | Pantalla de cuentas y chequeras — registrar las cuentas bancarias y sus chequeras | P06: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T049 DS-HU-13 | Pruebas — registrar las cuentas bancarias y sus chequeras | P06: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T053 DS-HU-15 | Servicio de ingresos y egresos — registrar ingresos y egresos generales con concepto, medio de pago y cuenta | P06: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T054 DS-HU-15 | Pantalla Recibidor/Pagador — registrar ingresos y egresos generales con concepto, medio de pago y cuenta | P06: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T055 DS-HU-15 | Pruebas — registrar ingresos y egresos generales con concepto, medio de pago y cuenta | P06: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T056 DS-HU-16 | Servicio de cheques — registrar cada cheque emitido | P06: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T057 DS-HU-16 | Pantalla de cheques — registrar cada cheque emitido | P06: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T058 DS-HU-16 | Pruebas — registrar cada cheque emitido | P06: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T059 DS-HU-17 | Anulación con justificación — anular un movimiento con justificación obligatoria | P06: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T060 DS-HU-17 | Opción en Caja — anular un movimiento con justificación obligatoria | P06: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T061 DS-HU-17 | Pruebas — anular un movimiento con justificación obligatoria | P06: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T065 DS-HU-19 | Tipo de recibo — distinguir los recibos de caja chica y de caja secretaría | P06: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T066 DS-HU-19 | Selector y filtro — distinguir los recibos de caja chica y de caja secretaría | P06: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T067 DS-HU-19 | Prueba — distinguir los recibos de caja chica y de caja secretaría | P06: artefacto y registro enlazados; cierre del backlog confirmado. |

Observación de evidencia. El adicional documenta datos ficticios en derramasoft_dev: cuenta bancaria y chequera, dos ingresos (uno anulado) y un cheque. La creación fue realizada durante la recopilación aportada; no es una ejecución efectuada por esta consolidación documental.

Captura S07-C66 · Caja > Anulación de movimientos

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Tres movimientos ficticios listados. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C67 · Caja > Anulación de movimientos

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Movimiento CC-000002 elegido con justificación escrita. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C68 · Caja > Anulación de movimientos

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Resultado: 'Ingreso CC-000002 anulado. Queda en el historial, fuera de los totales'. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C69 · Caja > Cheques

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Cheque 1 emitido; recibo CS-000001. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C70 · Caja > Cheques

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Formulario del cheque ficticio a Proveedor Ficticio Demo por S/ 40. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C71 · Caja > Cheques

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Pantalla de cheques sin cuenta elegida. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C72 · Mantenimiento > Cuentas bancarias y chequeras

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Formulario con la cuenta ficticia 000-DEMO-0001. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C73 · Mantenimiento > Cuentas bancarias y chequeras

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Cuenta ficticia y chequera 1 al 50 registradas. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C74 · Mantenimiento > Cuentas bancarias y chequeras

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Pantalla sin cuentas bancarias. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C75 · Caja > Recibidor/Pagador

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Formulario con un ingreso ficticio de S/ 100 en efectivo. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C76 · Caja > Recibidor/Pagador

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Dos ingresos ficticios (CC-000001 y CC-000002) con totales. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C77 · Caja > Recibidor/Pagador

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Pantalla sin movimientos y formulario de registro. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

## P07 · Contabilidad base

Responsable seleccionado: Yimy | 12 tareas técnicas | Actividades completadas al 100 %.

Propósito del paquete: Dejar el plan de cuentas, los periodos contables y el registro de asientos funcionando.

Entregables del alcance: 1) Modelo, carga inicial y pantalla del plan de cuentas. 2) Apertura y cierre de periodos mensuales y cierre anual con bloqueo. 3) Servicio y pantalla de voucher (asientos manuales). 4) Asiento de apertura con saldos iniciales. 5) Pruebas de periodos, asientos y apertura.

Figura 7. Artefacto técnico de P07 en el commit consultado; no es captura de ejecución.

Abrir fuente versionada: src/DerramaSoft.Desktop/Vistas/P07/VoucherVista.xaml

Versión 647128617a73 | Líneas 1–16. El fragmento permite ubicar el artefacto; el enlace contiene el archivo completo.

Registro de calidad: 96 casos; 86 aprobados y 10 no ejecutados. Los resultados conservan el corte y entorno de la fuente.

Registro completo P07

### Tareas cubiertas por el paquete

| ID / historia | Resumen del trabajo realizado | Evidencia |
|---|---|---|
| S07-T068 DS-HU-20 | Modelo del plan de cuentas — cargar y mantener el plan de cuentas aprobado | P07: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T069 DS-HU-20 | Carga inicial del plan — cargar y mantener el plan de cuentas aprobado | P07: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T070 DS-HU-20 | Pantalla del plan de cuentas — cargar y mantener el plan de cuentas aprobado | P07: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T071 DS-HU-20 | Pruebas — cargar y mantener el plan de cuentas aprobado | P07: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T072 DS-HU-21 | Periodos contables y bloqueo — abrir y cerrar periodos mensuales y hacer el cierre anual | P07: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T073 DS-HU-21 | Pantalla de periodos — abrir y cerrar periodos mensuales y hacer el cierre anual | P07: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T074 DS-HU-21 | Pruebas — abrir y cerrar periodos mensuales y hacer el cierre anual | P07: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T075 DS-HU-22 | Servicio de asientos — registrar vouchers o asientos manuales | P07: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T076 DS-HU-22 | Pantalla de voucher — registrar vouchers o asientos manuales | P07: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T077 DS-HU-22 | Pruebas — registrar vouchers o asientos manuales | P07: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T081 DS-HU-24 | Asiento de apertura — registrar los saldos iniciales al 01/01/2027 | P07: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T082 DS-HU-24 | Prueba — registrar los saldos iniciales al 01/01/2027 | P07: artefacto y registro enlazados; cierre del backlog confirmado. |

Observación de evidencia. OBS-S07-20261105-01: no se pudo registrar el voucher porque Debe y Haber no admitieron escritura, según el informe aportado. Se contrastó estáticamente el código local 585f2f9: Estilos/Tema.xaml:118 fija IsReadOnly=True para DataGrid y VoucherVista.xaml:68 no lo anula en Lineas. Es una causa compatible con el bloqueo, sin reejecución independiente. Faltan voucher registrado, asiento y anulación de asiento.

Captura S07-C78 · Contabilidad > Periodos contables

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Periodo Noviembre 2026 abierto. Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C79 · Contabilidad > Periodos contables

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Pantalla sin periodos abiertos (falta la fecha de inicio de la contabilidad). Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C80 · Contabilidad > Plan de cuentas

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Plan vacío con aviso de plan provisional. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C81 · Contabilidad > Plan de cuentas

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Cuentas ficticias: 1 ACTIVO, 101 CAJA, 7 INGRESOS, 701 APORTES. Datos ficticios creados en la BD de pruebas. Plan creado a mano; no se cargó el plan provisional del repositorio. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C82 · Contabilidad > Voucher

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Voucher con fecha, glosa y cuentas 101 y 701 elegidas; Debe y Haber no se pudieron escribir (S/ 0.00, 'No cuadra'). Datos ficticios creados en la BD de pruebas. BLOQUEO: no se pudo registrar el voucher. La tabla de líneas es de solo lectura (ver pendientes.md). El informe aportado indica que Debe y Haber no admitieron edición; no se obtuvo asiento registrado. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C83 · Contabilidad > Voucher

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Pantalla del voucher en blanco.  El informe aportado indica que Debe y Haber no admitieron edición; no se obtuvo asiento registrado. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

## P08 · Consultas y reportes de caja y contabilidad

Responsable seleccionado: Fidel | 9 tareas técnicas | Actividades completadas al 100 %.

Propósito del paquete: Consultar la caja con totales y emitir los libros y estados financieros.

Entregables del alcance: 1) Consultas de caja por día, mes, rango, usuario y concepto con totales. 2) Libro Diario y Libro Mayor en pantalla e impresión. 3) Balance general y Estado de resultados imprimibles. 4) Pruebas de cuadre contra los datos de prueba.

Figura 8. Artefacto técnico de P08 en el commit consultado; no es captura de ejecución.

Abrir fuente versionada: src/DerramaSoft.Desktop/Vistas/P08/EstadosFinancierosVista.xaml

Versión 647128617a73 | Líneas 1–16. El fragmento permite ubicar el artefacto; el enlace contiene el archivo completo.

Registro de calidad: 59 casos; 52 aprobados y 7 no ejecutados. Los resultados conservan el corte y entorno de la fuente.

Registro completo P08

### Tareas cubiertas por el paquete

| ID / historia | Resumen del trabajo realizado | Evidencia |
|---|---|---|
| S07-T062 DS-HU-18 | Consultas de caja — consultar los movimientos por día, mes, rango, usuario y concepto con totales | P08: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T063 DS-HU-18 | Pantalla de consultas — consultar los movimientos por día, mes, rango, usuario y concepto con totales | P08: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T064 DS-HU-18 | Pruebas — consultar los movimientos por día, mes, rango, usuario y concepto con totales | P08: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T078 DS-HU-23 | Consultas de Diario y Mayor — consultar e imprimir el Libro Diario y el Libro Mayor | P08: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T079 DS-HU-23 | Pantallas e impresión — consultar e imprimir el Libro Diario y el Libro Mayor | P08: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T080 DS-HU-23 | Pruebas — consultar e imprimir el Libro Diario y el Libro Mayor | P08: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T083 DS-HU-25 | Estructura de los estados financieros — generar el Balance general y el Estado de resultados | P08: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T084 DS-HU-25 | Reportes imprimibles — generar el Balance general y el Estado de resultados | P08: artefacto y registro enlazados; cierre del backlog confirmado. |
| S07-T085 DS-HU-25 | Pruebas de cuadre — generar el Balance general y el Estado de resultados | P08: artefacto y registro enlazados; cierre del backlog confirmado. |

Observación de evidencia. Las consultas de caja muestran datos, con y sin anulados. Diario, Mayor, Balance y Estado de resultados están sin asientos debido al bloqueo del voucher informado. No se presentan sus vistas vacías como verificación de cuadre o impresión con movimientos contables.

Captura S07-C84 · Caja > Consultas de caja

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Consulta de movimientos de noviembre 2026 incluyendo anulados (3 movimientos, totales). Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C85 · Caja > Consultas de caja

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Misma consulta sin anulados (2 movimientos). Datos ficticios creados en la BD de pruebas. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C86 · Reportes > Estado de resultados

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Estado de resultados de noviembre 2026: utilidad 0.00. Datos ficticios creados en la BD de pruebas. Sin asientos. Vista sin asientos; no acredita validación de importes de un voucher registrado. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C87 · Reportes > Balance general

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Balance general al 05/11/2026: cuadra en 0.00. Datos ficticios creados en la BD de pruebas. Sin asientos. Vista sin asientos; no acredita validación de importes de un voucher registrado. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C88 · Contabilidad > Libro Diario y Libro Mayor

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Libro Mayor: pide elegir la cuenta. Datos ficticios creados en la BD de pruebas. Sin asientos porque no se pudo registrar un voucher. Vista sin asientos; no acredita validación de importes de un voucher registrado. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

Captura S07-C89 · Contabilidad > Libro Diario y Libro Mayor

Captura .NET aportada, fechada 05/11/2026; entorno de pruebas derramasoft_dev declarado en el CSV. Libro Diario de noviembre 2026: 'No hay asientos en el periodo'. Datos ficticios creados en la BD de pruebas. Sin asientos porque no se pudo registrar un voucher. Vista sin asientos; no acredita validación de importes de un voucher registrado. Fuente: Paquete adicional; compilación local Release, sin SHA de ejecución consignado.

## Correcciones documentales V6

Las 39 correcciones conservan sus IDs y responsables de la línea documental original. Son adicionales a los ocho paquetes técnicos. Su cierre se informa al 100 % según confirmación del equipo; la evidencia de control es la hoja S07 Correcciones V6 y la trazabilidad del Product Backlog. No se presentan como funciones de la aplicación ni como pruebas de software ejecutadas.

| ID | Corrección y artefacto | Responsable |
|---|---|---|
| V6-03 | Documentar evolución del alcance. Cumple cuando: Separar portal consultivo, lanzamiento y escritorio .NET con mocks. Registrar las dos partes del sprint 7. Artefacto: Ejecución → Ingeniería del proyecto → Semestre_B → 00_Scrum_General_DerramaSoft: modificar Plan_General_Sprints_7_a_10_DerramaSoft y Product_Backlog_Semestre_B_NET_8_Paquetes_V2; vincular el backlog anterior como antecedente. Semestre_B → Sprint_7_Base_Escritorio_y_Aportes → 01_Sprint_Backlog: modificar este Sprint Backlog V2. Crear Registro_Cambio_Alcance_Sprint_7 en 04_Artefactos. Alcance: lanzamiento del portal e inicio .NET con mocks en S7; planificación de S8, S9 y S10. | Jherald Cáceres |
| V6-32 | Alinear documentación de sincronización S6. Cumple cuando: Backlog, catálogo, QA y manual comparten contrato decidido: INSERT/COPY, fuente financiera y capacidades pendientes. Artefacto: Ejecución → Ingeniería del proyecto → Semestre_B → Sprint_6_Sincronizacion_Backup_y_Pruebas → 01_Sprint_Backlog: modificar Sprint_Backlog_06. En 04_Artefactos del S6: alinear Catalogo_Casos_Prueba, Registro_Ejecucion_Pruebas e Informe_QA_Sprint_06_BORRADOR. Cierre del proyecto → 02_Manual_Tecnico: modificar manual vigente. Registrar la decisión de sincronización INSERT/COPY y fuente financiera en 04_Artefactos del S6; si se decide en S7, indicar ambas fechas. | Jherald Cáceres |
| V6-33 | Depurar cierre y entrega. Cumple cuando: Separar entrega de julio, lanzamiento del portal y cierre futuro. Firmas/aceptación solo cuando ocurran; formatos pendientes identificados. Artefacto: Cierre del proyecto: conservar 07_ACTA_DE_CONFORMIDAD_DE_ENTREGA.pdf como entrega histórica del Semestre A. Crear Acta_de_Entrega_Semestre_B_Sprint_7.docx para el lanzamiento del portal y, cuando corresponda, Acta_de_Cierre_del_Proyecto.docx. Actualizar los manuales de 01_Manual_de_Usuario, 02_Manual_Tecnico y 03_Manual_de_Instalacion_o_Despliegue según versión entregada. El cierre general de B, tras S8–S10, permanece pendiente hasta completarse. | Jherald Cáceres |
| V6-13 | Precisar aplicación metodológica. Cumple cuando: Explicar PMBOK, Scrum, módulos, contratos e integración progresiva. Distinguir decisiones originales y ajustes. Artefacto: Inicio y planificación → Planificación → Ingeniería de proyecto: modificar IP-01 Justificacion_de_Metodologia.docx con el método previsto para todo el proyecto. Registrar el ajuste de trabajo por módulos, contratos y mocks en Ejecución → Ingeniería → Semestre_B → Sprint 7 → 04_Artefactos, enlazado al Plan_General_Sprints_7_a_10_DerramaSoft. Identificar las decisiones originales de A y los ajustes de B sin reescribir su fecha histórica. | Daniel Marron |
| V6-14 | Completar plan de versionamiento. Cumple cuando: Identificar herramientas, motivos, elementos controlados, nomenclatura, ramas, commits y versiones previstas. Artefacto: Inicio y planificación → Planificación → Soporte de proyecto → 02_Gestion_de_la_configuracion: modificar la sección SP-01 de SP-01_SP-03_Derrama_UNSA.docx. Si se separa, crear Plan_de_Gestion_de_Configuracion.docx allí. Alcance: reglas generales de versionamiento para A, sprints 1–4, y B, sprints 5–10. Los commits/tags reales de cada sprint se registran mediante V6-31. | Daniel Marron |
| V6-15 | Explicar formato de solicitud de cambio. Cumple cuando: Describir campos, impacto, decisión, responsables, aprobación y seguimiento. Distinguir plantilla y solicitud real. Artefacto: Crear Formato_General_Solicitud_de_Cambio.docx en Inicio y planificación → Planificación → Soporte de proyecto → 02_Gestion_de_la_configuracion. Usar como referencia el formato de Ejecución → Soporte → Sprint 1 (Semestre A) → Configuración → Solicitudes de cambio. Es una plantilla general aplicable a A, S1–S4, y B, S5–S10; las solicitudes efectivamente registradas se tratan en V6-30. | Daniel Marron |
| V6-30 | Documentar solicitudes de cambio. Cumple cuando: Cada cambio formal tiene motivo, decisión, impacto y evidencia, o constancia verificable de ausencia. Artefacto: Ejecución → Soporte del proyecto → Sprint 1, 2, 3 y 4 (Semestre A) → 01_Gestion_de_la_configuracion → Solicitudes de cambio: completar los registros existentes y conservar Constancia_Sin_SC_Sprint_1.docx. Para B, Sprint 5, 6 y 7: crear/completar Registro_Solicitudes_Cambio_Sprint_N y SC-SN-XX en 04_Artefactos del sprint de Ingeniería, como respaldo de Soporte en el informe. B, S8–S10: plantillas previstas. Usar fecha real, decisión e impacto del cambio. | Daniel Marron |
| V6-31 | Completar versionamiento por sprint. Cumple cuando: Registrar ramas, commits/tags, integraciones, responsables y evidencia del corte. Sin versiones inventadas. Artefacto: Ejecución → Soporte del proyecto → Sprint 1, 2, 3 y 4 (Semestre A) → 01_Gestion_de_la_configuracion → Versionamiento: modificar/crear 01_Versionamiento_del_Codigo_Fuente_Sprint_N. Para B, Sprint 5, 6 y 7: crear/completar el registro equivalente en 04_Artefactos de Ingeniería del sprint. En S7 distinguir versión del portal y de .NET. B, S8–S10: formato preparado; commits/tags e integraciones se registran al ocurrir. | Daniel Marron |
| V6-37 | Documentar tecnologías y evidencia. Cumple cuando: Cada tecnología tiene uso real, sprint y enlace. .NET es previsto hasta contar con evidencia de implementación. Artefacto: Modificar Informe Final → Informe_Final_v6.docx, Anexo 03. Crear/completar Evidencias_Tecnologias_y_Estandares_Sprint_N en Ejecución → Ingeniería del proyecto → Semestre_A → Sprint 1, 2, 3 y 4 → 04_Artefactos, y Semestre_B → Sprint 5, 6 y 7 → 04_Artefactos. Registrar tecnología, uso, versión y evidencia de cada sprint. B, S8–S10: tecnologías previstas. En S7, .NET pasa a “utilizada” solo con evidencia del incremento. | Daniel Marron |
| V6-05 | Numerar subtítulos. Cumple cuando: Aplicar jerarquía continua a Gestión, Ingeniería, Soporte, Iniciación y Planificación. El índice coincide. Artefacto: Modificar Informe Final → Informe_Final_v6.docx: estilos de títulos, numeración multinivel e índice automático. Numerar Gestión, Ingeniería y Soporte en Inicio y planificación y dentro de cada sprint de Ejecución. Alcance: Semestre A, sprints 1–4; Semestre B, sprints 5–10, incluidos los apartados previstos. | Gersson Huichi |
| V6-06 | Normalizar tablas y figuras. Cumple cuando: Número y título de tabla arriba. Nota/fuente abajo. Figuras y referencias internas con formato uniforme. Artefacto: Modificar Informe Final → Informe_Final_v6.docx: títulos, números, notas, fuentes y referencias internas de tablas/figuras. Aplicar a Inicio y planificación, Ejecución del Semestre A (sprints 1–4) y B (sprints 5–10), Seguimiento, Cierre y anexos. Los documentos fuente permanecen como respaldo de cada evidencia. | Gersson Huichi |
| V6-07 | Seleccionar evidencia por apartado. Cumple cuando: Cada subtítulo final contiene como máximo una foto o tabla y un enlace al detalle. Artefacto: Modificar Informe Final → Informe_Final_v6.docx y seleccionar las capturas por apartado. Conservar el detalle en la carpeta real de cada documento de Inicio y planificación o de Ejecución: Semestre A, sprints 1–4; Semestre B, sprints 5–7. B, sprints 8–10: evidencias solo cuando existan. Cada evidencia debe llevar identificación de semestre, sprint y versión. | Gersson Huichi |
| V6-08 | Verificar capturas y enlaces. Cumple cuando: Cada captura corresponde al corte descrito. Los enlaces abren evidencia pertinente y se registran en la matriz. Artefacto: Modificar Informe Final → Informe_Final_v6.docx, capturas seleccionadas y Matriz_Tareas_y_Evidencias_V6.xlsx. Comprobar enlaces de Inicio y planificación (sus tres áreas), Ejecución (Semestre A: sprints 1, 2, 3 y 4. Semestre B: sprints 5, 6 y 7, con corte al elaborar V6), Seguimiento, Cierre y anexos. Recuperar capturas del periodo descrito. Semestre B: sprints 8, 9 y 10, previstos o pendientes de ejecución: enlazar planes o plantillas identificados como tales. | Gersson Huichi |
| V6-12 | Crear plan de prototipado. Cumple cuando: Definir referencias DerramaSoft, responsables, herramientas, etapas y validación. Sin pantallas ya diseñadas. Artefacto: Crear Plan_de_Prototipado_y_Validacion.docx en Inicio y planificación → Planificación → Ingeniería de proyecto, con etapas para A, S1–S4, y B, S5–S10. Conservar IP-03 Prototipado como resultado histórico. Referenciar sus pantallas en la carpeta de diseño del sprint identificado por fecha; para .NET, B → Sprint 7 → 02_Diseno_UI. A, S1–S4, y B, S5–S6, conservan sus diseños del portal. | Gersson Huichi |
| V6-01 | Inventariar evidencias. Cumple cuando: Cada evidencia identifica documento, semestre, sprint, fecha, versión, estado, enlace y apartado. Artefacto: Crear Matriz_Tareas_y_Evidencias_V6.xlsx en Informe Final. Inventariar los archivos de Inicio y planificación (Gestión, Ingeniería y Soporte), Ejecución (Semestre A: sprints 1, 2, 3 y 4. Semestre B: sprints 5, 6 y 7, con corte al elaborar V6), Seguimiento y control, Cierre y anexos. Registrar por evidencia su ruta real de Drive, semestre, sprint de origen y destino en V6. Semestre B: sprints 8, 9 y 10, previstos o pendientes de ejecución: identificar artefactos previstos, sin registrarlos como ejecutados. | Gabriel Vilca |
| V6-02 | Regularizar documentos fuente. Cumple cuando: Nombre, código, versión interna y estado coinciden. Se identifica la versión vigente y se conserva el historial. Artefacto: Inicio y planificación → Planificación → Ingeniería: regularizar el IP-02 inicial. Ejecución → Ingeniería del proyecto → Semestre_A → 00_Scrum_General: revisar IP-02_Requerimientos_Actualizados_V2.00.docx y V3.00.docx, indicando fecha y sprint de origen según historial. Inicio y planificación → Planificación → Soporte → 02_Gestion_de_la_configuracion: corregir códigos/versiones internos de SP-01_SP-03_Derrama_UNSA.docx. Revisar documentos de roles y RAM de Planificación → Gestión → Recursos humanos y sus actualizaciones de Ejecución. Registrar equivalencias en la matriz V6. | Gabriel Vilca |
| V6-04 | Concentrar referencias. Cumple cuando: Retirar referencias bibliográficas del cuerpo según la observación. Conservar bibliografía, enlaces de evidencia y notas de fuente. Artefacto: Modificar Informe Final → Informe_Final_v6.docx. Alcance transversal: capítulos 1–7, Inicio y planificación en sus tres áreas, y Ejecución del Semestre A (sprints 1–4) y B (sprints 5–10, con estado real o previsto). Concentrar la bibliografía en el capítulo 10. Mantener enlaces a documentos de evidencia y notas de fuente de tablas/figuras. | Gabriel Vilca |
| V6-11 | Crear plan de requerimientos. Cumple cuando: Definir fuentes, entrevistas, análisis, priorización, validación, aprobación y control de cambios para todo el proyecto. Artefacto: Crear Plan_de_Gestion_de_Requerimientos.docx en Inicio y planificación → Planificación → Ingeniería de proyecto. Definir el procedimiento para todo el proyecto: A, S1–S4; B, S5–S10. Mantener el IP-02 inicial como fuente y los IP-02 actualizados en Ejecución → Ingeniería → Semestre_A → 00_Scrum_General como evidencia de requisitos obtenidos/cambiados. Vincular cada versión a su fecha y sprint real en la matriz. | Gabriel Vilca |
| V6-36 | Ampliar glosario. Cumple cuando: Incluir términos efectivamente usados con definiciones claras y consistentes. Artefacto: Modificar Informe Final → Informe_Final_v6.docx, glosario general. Incorporar términos usados en Inicio y planificación (Gestión, Ingeniería y Soporte), Semestre A/S1–S4, Semestre B/S5–S7 y la planificación B/S8–S10. Definir .NET, mocks, contratos, QA, backlog, UAT y otros términos solo si aparecen en V6. No requiere glosario separado por sprint. | Gabriel Vilca |
| V6-19 | Completar costos por sprint. Cumple cuando: Conciliar S/192 y S/509.87. Registrar presupuesto, gasto, variación y corte por sprint. No extrapolar gasto cero del sprint 1. Artefacto: Ejecución → Gestión del proyecto → 03_Gestion_de_Costos: modificar GP-06_Cuadro_de_Costos_Actualizado.docx como archivo maestro. Incorporar registros separados para Semestre A: sprints 1, 2, 3 y 4. Semestre B: sprints 5, 6 y 7, con corte al elaborar V6: presupuesto, gasto acreditado, variación y explicación de cada corte. Semestre B: sprints 8, 9 y 10, previstos o pendientes de ejecución: dejar presupuesto estimado/pendiente, sin gastos ejecutados. Conservar la línea base de Inicio y planificación → Planificación → Gestión → Costos. | Yimy Charca |
| V6-21 | Completar riesgos por sprint. Cumple cuando: Registrar riesgos, acciones, responsables, resultado y estado. Distinguir riesgo e incidencia ocurrida. Artefacto: Ejecución → Gestión del proyecto → 02_Gestion_de_Riesgos: modificar GP-15_Matriz_Riesgos_Actualizada.docx como maestro. Añadir seguimiento individual para Semestre A: sprints 1, 2, 3 y 4. Semestre B: sprints 5, 6 y 7, con corte al elaborar V6: riesgo/incidencia, acción, responsable, resultado y estado. Semestre B: sprints 8, 9 y 10, previstos o pendientes de ejecución: riesgos anticipados y medidas previstas, con seguimiento pendiente. | Yimy Charca |
| V6-34 | Ampliar lecciones aprendidas. Cumple cuando: Cada lección identifica situación, decisión, resultado, mejora y sprint o semestre. Artefacto: Cierre del proyecto: modificar 06_Lecciones_Aprendidas_Derrama_Docente_UNSA.docx con bloques identificados por Semestre A (S1, S2, S3 y S4) y Semestre B (S5, S6 y S7 hasta el corte). Vincular cada lección con su situación, decisión y resultado real. B, S8, S9 y S10: reservar la estructura para lecciones posteriores, sin inventarlas. | Yimy Charca |
| V6-09 | Reescribir planificación de gestión. Cumple cuando: Explicar cómo se organizará/controlará el proyecto. Trasladar resultados y actualizaciones al sprint correspondiente. Artefacto: Inicio y planificación → Inicio: revisar GP-01 y conservar Acta_de_Constitucion_Firmada.pdf. Inicio y planificación → Planificación → Gestión del proyecto → Tiempo, Riesgos, Costos, Comunicaciones y Recursos humanos: revisar/completar GP-02 a GP-15 como planes iniciales. Identificar resultados posteriores y trasladar su exposición al sprint real: A, S1–S4; B, S5–S7. S8–S10 del B permanecen previstos. | Willy Huisa |
| V6-10 | Recuperar cronograma inicial. Cumple cuando: Identificar fecha y revisión de la línea base. Diferenciar planificación inicial y seguimiento posterior. Artefacto: Inicio y planificación → Planificación → Gestión del proyecto → 1_Gestion_de_tiempo: recuperar la revisión inicial de GP-04 Cronograma Gantt.xlsm. Crear GP-04_Cronograma_Linea_Base_Inicial.xlsm solo si hace falta separar el corte, indicando origen, fecha y revisión. Alcance: línea base original del proyecto, anterior a la ejecución; las revisiones de A, S1–S4, y B, S5–S10, se documentan en V6-20. | Willy Huisa |
| V6-20 | Completar tiempo por sprint. Cumple cuando: Registrar fechas, esfuerzo planificado/real, retrasos y ajustes. Conservar cortes históricos. Artefacto: Ejecución → Gestión del proyecto → 01_Gestion_de_Tiempo: modificar GP-04_Cronograma_Gantt_Actualizado.xlsm y GP-05_Hitos_del_Proyecto_Actualizado.docx como maestros, con cortes separados para Semestre A: sprints 1, 2, 3 y 4. Semestre B: sprints 5, 6 y 7, con corte al elaborar V6. Cada corte identifica fechas, esfuerzo y retrasos del sprint. Semestre B: sprints 8, 9 y 10, previstos o pendientes de ejecución: cronograma previsto, sin esfuerzo real inventado. Conservar revisiones para diferenciar línea base y seguimiento. | Willy Huisa |
| V6-22 | Identificar Product Backlog de cada corte. Cumple cuando: Enlazar versión correspondiente al sprint. Reconstrucciones históricas identificadas con fuentes; no inventar un corte. Artefacto: Ejecución → Ingeniería del proyecto → Semestre_A → 00_Scrum_General: revisar Product_Backlog.xlsx y sus cortes S1, S2, S3 y S4. Semestre_B → 00_Scrum_General y 00_Scrum_General_DerramaSoft: identificar los maestros del portal/escritorio y cortes S5, S6 y S7. Crear Product_Backlog_Corte_Sprint_N en 04_Artefactos del sprint respectivo cuando haya respaldo. B, S8–S10: mantener ítems previstos en el maestro; generar cortes cuando ocurran. | Willy Huisa |
| V6-23 | Completar Sprint Backlog. Cumple cuando: Registrar objetivo, trabajo comprometido, responsable, estado y pendientes del periodo. Artefacto: Ejecución → Ingeniería del proyecto → Semestre_A → Sprint 1, 2, 3 y 4 → 01_Sprint_Backlog: modificar el backlog propio de cada iteración. Semestre_B → Sprint 5 y Sprint 6 → 01_Sprint_Backlog: completar sus backlogs. Sprint 7 → 01_Sprint_Backlog: actualizar este Sprint_Backlog_07_8_Paquetes_Detallado_V2, identificando el backlog anterior como antecedente. B, Sprint 8, 9 y 10: conservar como propuestas/plantillas hasta su Planning. | Willy Huisa |
| V6-17 | Reorganizar ejecución. Cumple cuando: Semestre A contiene sprints 1–4. B contiene 5–10. Cada sprint tiene Gestión, Ingeniería y Soporte; futuros identificados como planificados. Artefacto: Modificar Informe Final → Informe_Final_v6.docx y Matriz_Tareas_y_Evidencias_V6.xlsx. Reorganizar la exposición de Ejecución para A, sprints 1, 2, 3 y 4; B, sprints 5, 6, 7, 8, 9 y 10. Incorporar Gestión, Ingeniería y Soporte dentro de cada sprint. Usar las carpetas actuales de Drive como fuentes; esta tarea modifica el informe y sus enlaces, sin requerir mover archivos. | Fidel Chávez |
| V6-18 | Retirar definiciones de ejecución. Cumple cuando: Sustituir Concepto breve por trabajo realizado, resultado y evidencia. No eliminar explicaciones de hechos. Artefacto: Modificar Informe Final → Informe_Final_v6.docx, capítulo de Ejecución. Alcance: A, sprints 1–4; B, sprints 5–7, en Gestión, Ingeniería y Soporte de cada uno. Sustituir “Concepto breve” por actividad realizada, resultado y evidencia. En B, sprints 8–10, redactar la actividad prevista y el estado pendiente de sus resultados. | Fidel Chávez |
| V6-24 | Completar Sprint Planning. Cumple cuando: Registrar selección, capacidad, estimaciones, dependencias y acuerdos respaldados. Artefacto: Ejecución → Ingeniería del proyecto → Semestre_A → Sprint 1, 2, 3 y 4 → 05_Sprint_Planning: completar cada acta/registro disponible. Semestre_B → Sprint 5, 6 y 7 → 05_Sprint_Planning: completar los documentos del periodo, conservando el estado de los borradores. B, Sprint 8, 9 y 10: preparar plantillas y registrar acuerdos solo cuando se realice cada Planning. | Fidel Chávez |
| V6-25 | Completar Daily Scrum. Cumple cuando: Registrar fechas, avances, impedimentos y decisiones. Identificar periodos sin registro, sin fabricar reuniones. Artefacto: Ejecución → Ingeniería del proyecto → Semestre_A → Sprint 1, 2, 3 y 4 → 07_Sprint_Daily: completar registros fechados del periodo. Semestre_B → Sprint 5, 6 y 7 → 07_Sprint_Daily: actualizar avances/impedimentos respaldados, incluido S7 hasta el corte. B, Sprint 8, 9 y 10: plantillas previstas. Identificar periodos sin registro histórico, sin fabricar reuniones. | Fidel Chávez |
| V6-26 | Completar Sprint Review. Cumple cuando: Identificar lo presentado, participantes, observaciones y acuerdos. Distinguir revisión docente y aceptación institucional. Artefacto: Ejecución → Ingeniería del proyecto → Semestre_A → Sprint 1, 2, 3 y 4 → 06_Sprint_Review: completar cada registro con evidencia disponible. Semestre_B → Sprint 5 y 6 → 06_Sprint_Review: completar sus revisiones. Sprint 7 → 06_Sprint_Review: preparar el registro y completarlo cuando ocurra la revisión. B, Sprint 8, 9 y 10: plantillas previstas. Separar revisión docente y aceptación institucional. | Fidel Chávez |
| V6-27 | Documentar retrospectivas. Cumple cuando: Registrar aprendizajes y acciones, o ausencia del registro histórico. Indicar fecha real de elaboración. Artefacto: Ejecución → Ingeniería del proyecto → Semestre_A → Sprint 1, 2, 3 y 4: completar la retrospectiva existente o crear Sprint_Retrospective_N.docx en 04_Artefactos, indicando si es reconstrucción posterior. Semestre_B → Sprint 5 y 6: mismo procedimiento. Sprint 7: preparar y completar la retrospectiva al cierre. B, Sprint 8, 9 y 10: plantillas previstas. Registrar fecha real de elaboración y fuentes históricas. | Fidel Chávez |
| V6-16 | Completar plan de calidad por sprint. Cumple cuando: Definir actividades antes/durante/cierre, responsables, mocks, pruebas y criterios de terminado. Artefacto: Inicio y planificación → Planificación → Soporte de proyecto: modificar la sección SP-03 de SP-01_SP-03_Derrama_UNSA.docx, actualmente en 02_Gestion_de_la_configuracion. Si se separa, crear Plan_de_Aseguramiento_de_Calidad.docx en 01_Aseguramiento_de_Calidad. Alcance: actividades previstas antes/durante/cierre de A, S1–S4, y B, S5–S10. Para el incremento .NET desde S7: mínimo 5 funcionales, 5 unitarias y 5 de integración por componente; resultados en V6-29. | Luis Yana |
| V6-28 | Ubicar entregables técnicos. Cumple cuando: Cada producto tiene fecha, sprint y evidencia. Se distingue diseño, implementación y validación. Artefacto: Ejecución → Ingeniería del proyecto → Semestre_A → Sprint 1, 2, 3 y 4, y Semestre_B → Sprint 5, 6 y 7: revisar 02_Diseno_UI, 03_Desarrollo, 04_Artefactos y, donde existan, 08_Arquitectura y 09_Base de Datos/09_Base_de_Datos. Completar entregables y capturas verificables de cada periodo. En S7 separar portal y escritorio .NET con mocks. B, S8–S10: listar productos previstos, sin presentarlos como entregados. | Luis Yana |
| V6-29 | Completar calidad por sprint. Cumple cuando: Identificar versión, ambiente, casos, resultados, defectos y pendientes. Separar 54 históricos, catálogo 128 y 78 regresiones locales reportadas. Artefacto: Ejecución → Soporte del proyecto → Sprint 1, 2, 3 y 4 (Semestre A) → 02_Aseguramiento_de_la_calidad: completar sus casos, ejecuciones, métricas y evidencias. Drive actual: Ejecución → Ingeniería del proyecto → Semestre_B → Sprint 5/Sprint 6 → 04_Artefactos: completar Informe_QA_Sprint_05/06_BORRADOR; en S6, Catalogo_Casos_Prueba y Registro_Ejecucion_Pruebas. En Sprint 7 → 04_Artefactos crear Informe_QA_Sprint_7 y registros, usando la hoja Pruebas de este backlog. B, S8–S10: plan/plantillas, resultados pendientes. | Luis Yana |
| V6-35 | Vaciar conclusiones y recomendaciones. Cumple cuando: Conservar únicamente el título, sin contenido ni subtítulos internos. Artefacto: Modificar Informe Final → Informe_Final_v6.docx, únicamente el capítulo 8. Alcance global del informe que comprende Semestre A y B; esta tarea no requiere archivos distintos ni resultados por sprint. | Luis Yana |
| V6-38 | Documentar estándares y evidencia. Cumple cuando: Explicar aplicación concreta y enlace. Distinguir normas, marcos y convenciones, sin afirmar certificación. Artefacto: Modificar Informe Final → Informe_Final_v6.docx, Anexo 04. Completar la sección de estándares de Evidencias_Tecnologias_y_Estandares_Sprint_N en Ingeniería → Semestre A/S1–S4 y Semestre B/S5–S7 → 04_Artefactos. Vincular la evidencia de calidad de Soporte/S1–S4 y los QA de B/S5–S7. Inicio y planificación → Planificación → Soporte → Calidad: revisar las reglas generales relacionadas. B/S8–S10: aplicación prevista, sin resultados afirmados. | Luis Yana |
| V6-39 | Verificar V6 completa. Cumple cuando: Comprobar índice, numeración, títulos/notas, enlaces, cifras, versiones y estados. Revisar visualmente la maquetación. Artefacto: Crear Lista_Verificacion_V6.xlsx en Informe Final y modificar el control documental de Informe_Final_v6.docx. Revisar Inicio y planificación → Gestión, Ingeniería y Soporte; Ejecución → A/S1–S4 y B/S5–S7 en las tres áreas; B/S8–S10 con su estado previsto; Seguimiento, Cierre, Glosario, Bibliografía y anexos. Registrar hallazgos y validación visual al corte de V6. | Luis Yana |

Plan y registro de pruebas del Sprint 07

Retrospectiva del Sprint 07

Evidencia visual del registro de cierre

Captura tomada en Word durante la verificación del Plan y registro de pruebas S07. Muestra el documento completado; no representa una ejecución nueva de la aplicación.
