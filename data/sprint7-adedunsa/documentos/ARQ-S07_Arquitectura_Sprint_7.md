UNIVERSIDAD NACIONAL DE SAN AGUSTÍN DE AREQUIPA

Facultad de Ingeniería de Producción y Servicios · Escuela Profesional de Ingeniería de Sistemas

ARQ-S07

Arquitectura del Sprint 7

Base de escritorio, seguridad, socios, caja y contabilidad

| Proyecto | Aplicativo Web para la Derrama de Docentes de la UNSA |
|---|---|
| Código | ARQ-S07 |
| Versión | 1.0 |
| Fecha de emisión | 08/11/2026 |
| Elaborado por | Equipo G9 |
| Revisado por | Pendiente |
| Aprobado por | Pendiente |
| Clasificación | Documento de ejecución: registra lo realizado en el sprint y la evidencia que lo respalda |

1. Propósito y alcance

Este documento deja por escrito la arquitectura del incremento del Sprint 7 («Base de escritorio, seguridad, socios, caja y contabilidad», 26/10/2026 al 06/11/2026). Se elaboró el 08/11/2026 como regularización documental de la carpeta del sprint, que no tenía este documento. Toda la información proviene de los documentos que ya existen en el Drive (entregable, backlog, artefactos e informes de QA); lo que esas fuentes no registran se indica como pendiente y no se completa por inferencia. Las fechas de los sprints son las del Entregable de Sprint (reconstruidas a partir de los registros).

2. Componentes del sprint

| Componente | Qué contiene | Tareas |
|---|---|---|
| Núcleo (DerramaSoft.Core) | Dominio (Socio, Usuario, Rol, Bitácora, Parámetro), contratos y catálogo del menú | S07-T002 |
| Infraestructura (DerramaSoft.Infrastructure) | EF Core 10 con Npgsql, migración Inicial, lectura de la cadena de conexión desde .env; variante Infrastructure.Mock con implementaciones en memoria | S07-T002, S07-T004 |
| Escritorio (DerramaSoft.Desktop) | WPF con patrón MVVM: ventana principal, menú de 7 módulos (Aporte, Operaciones, Caja, Contabilidad, Reportes, Mantenimiento, Sistema), barra de estado y plantilla de ventana de trabajo VentanaTrabajo | S07-T024, S07-T025 |
| Pruebas | UnitTests (29), IntegrationTests (1) y Desktop.Tests (29) en el paquete P01; las suites de los otros paquetes suman 1177 pruebas en el corte del 02/11/2026 | S07-T005 |
| Integración continua | GitHub Actions: compilar y probar en Windows; aplicar migraciones en PostgreSQL 18 y verificar tablas, roles y triggers | S07-T005 |
| Paquetes P02 a P08 | Acceso y roles, usuarios y bitácora, padrón de socios, estados/parámetros/tasas, caja, contabilidad base y consultas/reportes, cada uno sobre la plantilla de ventana común | P02–P08 |

3. Decisiones de arquitectura

- El producto cambia de portal web (Next.js) a aplicación de escritorio .NET 10 con WPF sobre PostgreSQL, tal como fija el Acta de Constitución GP-01 (octubre de 2026). El cambio se formaliza en la solicitud SC-04.

- Cada pantalla nueva hereda de VentanaTrabajoViewModel<T> y se registra con el código de su opción de menú (por ejemplo CAJA.CHEQUES).

- La bitácora es de solo inserción: dos triggers rechazan UPDATE, DELETE y TRUNCATE.

4. Limitaciones y pendientes

- No existe aún un diagrama gráfico de arquitectura del Sprint 7; el Acta lo lista como entregable clave. Hay que dibujarlo (propuesta: diagrama de capas con los cuatro proyectos de src/ y la base PostgreSQL).

- El portal web de consulta del socio y la sincronización forman parte del alcance del Acta, pero no tienen tareas en el Sprint 7.

5. Fuentes

S07-P01_Evidencias_Base_Tecnica, Entregable de Sprint 07, Acta de constitución GP-01, Sprint Backlog 07.

6. Control de cambios

| Versión | Fecha | Descripción | Responsable |
|---|---|---|---|
| 1.0 | 08/11/2026 | Emisión inicial por regularización documental de la carpeta 08_Arquitectura. | Equipo G9 |
