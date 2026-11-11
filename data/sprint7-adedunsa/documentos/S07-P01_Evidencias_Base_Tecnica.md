Proyectos de Ingeniería de Sistemas
DerramaSoft .NET

Evidencias de la base técnica
e interfaz principal

| Campo | Valor |
|---|---|
| Sprint | Sprint 7 |
| Paquete | P01 – Base técnica e interfaz principal |
| Responsable | Jherald |
| Historias de usuario | DS-HU-01, DS-HU-07 |
| Tareas cubiertas | S07-T001, S07-T002, S07-T003, S07-T004, S07-T005, S07-T024, S07-T025 |
| Repositorio | github.com/AriettaaS/derramasoft-net |
| Fecha | 22/10/2026 |

## 1. Resumen

Este documento reúne la evidencia de las tareas del paquete P01 del Sprint 7. El resultado es una solución .NET 10 en capas con su modelo de datos inicial en PostgreSQL, integración continua en GitHub Actions y la ventana principal de escritorio con el menú de 7 módulos y una plantilla común de ventana de trabajo. En la rama dev la compilación Release no tiene advertencias y pasan las 59 pruebas automatizadas.

## 2. S07-T001 – Repositorio, ramas y flujo de PR

Se creó el repositorio github.com/AriettaaS/derramasoft-net con dos ramas permanentes: main (estable) y dev (integración). Cada entregable se trabajó en una rama feature/S7-P01-… y se integró a dev mediante pull request, con revisión y CI en verde antes del merge.

Ramas remotas: main, dev, chore/s7-inicializacion, feature/S7-P01-base-net, feature/S7-P01-modelo-datos, feature/S7-P01-menu-principal, feature/S7-P01-ci-readme.

| PR | Título | Estado | Fecha |
|---|---|---|---|
| #1 | chore: preparar esqueleto de carpetas para S7 | Merged | 15/10/2026 |
| #2 | Feature/s7 p01 base net (E1: solución .NET en capas) | Merged | 22/10/2026 |
| #3 | feat(P01): modelo de datos inicial y migraciones (E2) | Merged | 22/10/2026 |
| #4 | feat(P01): leer la cadena de conexión desde un archivo .env | Merged | 23/10/2026 |
| #5 | feat(P01): ventana principal, menú de 7 módulos y plantilla de ventana (E3) | Merged | 23/10/2026 |
| #6 | ci(P01): pipeline, README clonar-compilar-migrar y acta (E4) | Merged | 23/10/2026 |

## 3. S07-T002 – Solución en capas

La solución DerramaSoft.sln (.NET 10) separa dominio, infraestructura y presentación, con proyectos de prueba para cada capa:

| Proyecto | Contenido |
|---|---|
| src/DerramaSoft.Core | Dominio (Socio, Usuario, Rol, Bitacora, Parametro), contratos y catálogo del menú |
| src/DerramaSoft.Infrastructure | EF Core 10 + Npgsql, migración Inicial, lectura de .env |
| src/DerramaSoft.Infrastructure.Mock | Implementaciones ficticias en memoria |
| src/DerramaSoft.Desktop | WPF (MVVM): ventana principal, menú de 7 módulos, plantilla VentanaTrabajo |
| tests/DerramaSoft.UnitTests | 29 pruebas (modelo de datos, lector .env) |
| tests/DerramaSoft.IntegrationTests | 1 prueba |
| tests/DerramaSoft.Desktop.Tests | 29 pruebas (menú, navegación, plantilla) |

## 4. S07-T003 / S07-T004 – Modelo de datos y migración inicial

El modelo inicial tiene 5 tablas: socio, usuario, rol, bitacora y parametro. Se revisó contra la estructura de la base actual (sin datos personales); las decisiones se resumen en el Anexo A. La migración 20261022064446_Inicial se aplicó con EF Core sobre una base PostgreSQL vacía en Neon, y se generó además un script idempotente (scripts/db/0001_inicial.sql).

| Verificación | Resultado |
|---|---|
| Entorno | Neon, ep-***.us-east-2.aws.neon.tech, base derramasoft_dev, PostgreSQL 18.6 (credenciales omitidas) |
| Herramientas | .NET SDK 10.0.402, dotnet-ef 10.0.13, psql 18.4 |
| Tablas antes de migrar | 0 |
| dotnet ef database update | Applying migration '20261022064446_Inicial'. Done. |
| Script idempotente reejecutado | Código de salida 0, no reaplica cambios |
| Tablas en public | __EFMigrationsHistory, bitacora, parametro, rol, socio, usuario |
| Semilla de roles | 1 Administrador, 2 Cajero, 3 Contable |
| Triggers de bitácora | tr_bitacora_sin_truncate, tr_bitacora_solo_insercion |
| Restricciones CHECK | ck_parametro_vigencia, ck_socio_estado, ck_socio_fecha_retiro, ck_socio_tipo_documento, ck_usuario_intentos_fallidos |
| Prueba de solo inserción | UPDATE y DELETE rechazados: «La bitacora solo admite inserciones»; transacción revertida, 0 filas |
| Reaplicación (23/10/2026) | Proyecto Neon dedicado (ep-***.c-6.us-east-2.aws.neon.tech), rama dev, commit 87e1c55; cadena leída de .env local excluido de Git; mismas tablas, roles e historial |

Extracto de la salida de la migración:

> dotnet ef database update -p src/DerramaSoft.Infrastructure -s src/DerramaSoft.Infrastructure
Build succeeded.
Acquiring an exclusive lock for migration application.
Applying migration '20261022064446_Inicial'.
Done.

## 5. S07-T005 – Integración continua

El workflow .github/workflows/ci.yml se ejecuta en push y pull request hacia dev y main, y de forma manual. Tiene dos jobs:

- Compilar y probar (windows-latest): restore, build Release y pruebas, con los resultados .trx como artefacto.

- Aplicar migraciones en PostgreSQL (ubuntu-latest, servicio postgres:18): dotnet ef database update y verificación de las 6 tablas, los 3 roles, los triggers de solo inserción y la reejecución del script idempotente.

| Run | Origen | Resultado | Detalle |
|---|---|---|---|
| 39887583005 | PR #6 | Fallido | Faltaba restore antes de dotnet ef en el runner limpio |
| 39887806171 | PR #6 | Correcto | Se agregó el restore de Infrastructure |
| 39889587607 | PR #6 | Correcto | Compilar y probar 1m18s; migraciones 52s |
| 39889850091 | Push a dev (merge del PR #6) | Correcto | 23/10/2026 02:29–02:30 UTC, 1 min 21 s |

Página de ejecuciones: github.com/AriettaaS/derramasoft-net/actions/workflows/ci.yml

## 6. S07-T024 / S07-T025 – Ventana principal, menú y plantilla

La aplicación WPF abre con la ventana principal, un menú superior con los 7 módulos (Aporte, Operaciones, Caja, Contabilidad, Reportes, Mantenimiento y Sistema) y una barra de estado con el usuario y la fecha de operación. Cada opción prevista para el Sprint 7 abre una hoja en blanco en una pestaña con su título y su referencia (tarea, HU y paquete); Aporte y Operaciones indican que no tienen opciones en este sprint. Las pestañas no se duplican.

La plantilla VentanaTrabajo (ViewModel genérico VentanaTrabajoViewModel<T> y control VentanaTrabajo.xaml) fija el patrón común de búsqueda, resultados, detalle, mensajes en español y acciones (Nuevo, Guardar, Anular, Imprimir, Cerrar). Su uso se resume en el Anexo B. Las 29 pruebas de DerramaSoft.Desktop.Tests cubren el menú, la navegación y la plantilla.

Figura 1. Ventana principal al iniciar la aplicación.

Figura 2. Menú del módulo Mantenimiento desplegado.

Figura 3. Hoja en blanco de una opción con su título y referencia.

Figura 4. Módulo sin pantallas en el Sprint 7.

## Anexo A. Decisiones del modelo de datos

| Tema | Decisión | Motivo |
|---|---|---|
| Documento del socio | tipo_documento (D, P, M) + numero_documento (hasta 15), únicos como par | La base actual tiene documentos que no son DNI de 8 dígitos; un char(8) habría rechazado registros reales |
| Estado del socio | numero_inscripcion, fecha_retiro y estado (A, V, O) con CHECK; se retira activo | El sistema distingue pasivo voluntario y obligatorio, lo que afecta aportes y liquidaciones |
| Bitácora | usuario_id opcional, usuario_nombre obligatorio, tabla opcional; triggers de solo inserción | Permite importar el historial actual, registrado con usuarios de base de datos |
| Usuario | codigo_legado opcional y único | Enlaza cada cuenta nueva con su historial; contraseña, rol y bloqueo son propios del sistema nuevo |
| Rol y parámetro | Semilla Administrador, Cajero, Contable; parámetro con clave, valor y vigencia | P02 definirá permisos; las tasas por monto y plazo irán en una tabla posterior |
| Migración | Se regeneró Inicial en lugar de añadir una segunda | Aún no se había aplicado en ninguna base; desde ahora cada cambio va en una migración nueva |

Convenciones: snake_case, llaves primarias simples, índices únicos explícitos, timestamptz y jsonb en la bitácora.

## Anexo B. Uso de la plantilla de ventana de trabajo

Toda pantalla sigue el orden: encabezado (módulo, título, referencia), búsqueda, resultados a la izquierda, detalle a la derecha, mensajes (verde para información, rojo para errores) y acciones.

Reglas incluidas:

- Buscar exige al menos 2 caracteres («Ingrese al menos 2 caracteres para buscar.»).

- Informa «Se encontraron N registros.» o «No se encontraron registros para "…".»

- Nuevo depende de PermiteNuevo; Guardar, Anular e Imprimir requieren su permiso y un registro seleccionado. Por defecto, deshabilitados.

- Cerrar cierra la pestaña.

Pasos para reemplazar una hoja en blanco por la pantalla real (paquetes P02–P08):

- Crear el ViewModel heredando de VentanaTrabajoViewModel<T> e implementar EjecutarBusqueda y las acciones permitidas.

- Crear la vista con el control VentanaTrabajo, aportando la tabla de resultados y el detalle.

- Asociar la vista al ViewModel con un DataTemplate en MainWindow.xaml.

- Registrar la ventana en App.xaml.cs con el código de su opción del catálogo (por ejemplo, CAJA.CHEQUES).

- Añadir pruebas del ViewModel siguiendo VentanaTrabajoViewModelTests.cs.
