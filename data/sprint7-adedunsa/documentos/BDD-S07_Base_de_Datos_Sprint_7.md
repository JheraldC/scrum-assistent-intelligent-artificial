UNIVERSIDAD NACIONAL DE SAN AGUSTÍN DE AREQUIPA

Facultad de Ingeniería de Producción y Servicios · Escuela Profesional de Ingeniería de Sistemas

BDD-S07

Base de datos del Sprint 7

Base de escritorio, seguridad, socios, caja y contabilidad

| Proyecto | Aplicativo Web para la Derrama de Docentes de la UNSA |
|---|---|
| Código | BDD-S07 |
| Versión | 1.0 |
| Fecha de emisión | 08/11/2026 |
| Elaborado por | Equipo G9 |
| Revisado por | Pendiente |
| Aprobado por | Pendiente |
| Clasificación | Documento de ejecución: registra lo realizado en el sprint y la evidencia que lo respalda |

1. Propósito y alcance

Este documento deja por escrito el modelo de datos del Sprint 7 («Base de escritorio, seguridad, socios, caja y contabilidad», 26/10/2026 al 06/11/2026). Se elaboró el 08/11/2026 como regularización documental de la carpeta del sprint, que no tenía este documento. Toda la información proviene de los documentos que ya existen en el Drive (entregable, backlog, artefactos e informes de QA); lo que esas fuentes no registran se indica como pendiente y no se completa por inferencia. Las fechas de los sprints son las del Entregable de Sprint (reconstruidas a partir de los registros).

2. Descripción general

Modelo inicial de la aplicación de escritorio DerramaSoft sobre PostgreSQL 18, creado con EF Core. Responsable del paquete P01: Jherald (tareas S07-T003 y S07-T004).

3. Contenido

| Tabla | Contenido y reglas | Restricciones |
|---|---|---|
| socio | Tipo de documento (D, P, M) y número (hasta 15), número de inscripción, fecha de retiro y estado (A, V, O) | CHECK: ck_socio_estado, ck_socio_fecha_retiro, ck_socio_tipo_documento; par documento único |
| usuario | Cuenta del sistema con código legado opcional y único, intentos fallidos, rol | CHECK: ck_usuario_intentos_fallidos |
| rol | Semilla: 1 Administrador, 2 Cajero, 3 Contable | — |
| bitacora | usuario_id opcional, usuario_nombre obligatorio, tabla opcional, jsonb; solo inserción | Triggers tr_bitacora_solo_insercion y tr_bitacora_sin_truncate |
| parametro | Clave, valor y vigencia | CHECK: ck_parametro_vigencia |

Migración 20261022064446_Inicial aplicada con EF Core sobre una base PostgreSQL vacía en Neon (PostgreSQL 18.6, base derramasoft_dev) y reaplicada el 23/10/2026 en un proyecto Neon dedicado (commit 87e1c55). El script idempotente se reejecutó con código de salida 0. La prueba de solo inserción rechazó UPDATE y DELETE sobre la bitácora («La bitacora solo admite inserciones»). Convenciones: snake_case, llaves primarias simples, índices únicos explícitos, timestamptz y jsonb.

Decisiones del modelo (Anexo A del documento de evidencias)

- Se usa tipo y número de documento en lugar de un char(8): la base actual tiene documentos que no son DNI.

- Se regeneró la migración Inicial en lugar de añadir una segunda porque aún no se había aplicado; desde ahora cada cambio va en una migración nueva.

- Las tasas por monto y plazo irán en una tabla posterior; los permisos los define el paquete P02.

4. Artefactos disponibles

03_Desarrollo: S07-P01_Evidencias_Base_Tecnica.docx. Repositorio: github.com/AriettaaS/derramasoft-net (migraciones en src/DerramaSoft.Infrastructure).

5. Pendientes para cerrar la carpeta

No hay diagrama entidad-relación del Sprint 7 en la carpeta. Hay que generarlo desde el modelo de EF Core o en dbdiagram.io. Además, las tablas que añaden los paquetes P02 a P08 (acceso, padrón, parámetros, caja, contabilidad) constan en docs/P02…P08 del repositorio, que este documento no revisó.

6. Control de cambios

| Versión | Fecha | Descripción | Responsable |
|---|---|---|---|
| 1.0 | 08/11/2026 | Emisión inicial por regularización documental de la carpeta 09_Base_de_Datos. | Equipo G9 |
