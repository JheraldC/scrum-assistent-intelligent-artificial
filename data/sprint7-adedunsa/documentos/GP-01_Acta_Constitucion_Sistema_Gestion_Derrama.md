| ACTA DE CONSTITUCIÓN DEL PROYECTO |
|---|

| Título del proyecto: Nuevo Sistema de Gestión de la Derrama (reemplazo de DerramaSoft) - Derrama UNSA | Título del proyecto: Nuevo Sistema de Gestión de la Derrama (reemplazo de DerramaSoft) - Derrama UNSA |
|---|---|
| Patrocinador: Derrama de Docentes UNSA (ADEDUNSA) | Fecha de elaboración: Octubre de 2026 |
| Gestor del proyecto: Jherald Huren Cáceres Apaza | Cliente del proyecto: Dra. Janeth Amparo Esquivel Las Heras |
| Scrum Master: Ariel Dicson Taco Huaman | Marco de trabajo: Scrum, sprints de 2 semanas |

Propósito del proyecto:

| Reemplazar DerramaSoft por un sistema moderno y seguro que conserve los módulos y el lenguaje que el personal ya conoce, elimine procesos manuales, incorpore la contabilidad completa y permita al socio consultar su información en línea. |
|---|

Descripción de alto nivel del proyecto:

| Aplicación de escritorio .NET (C# + WPF) con base de datos PostgreSQL en la red local de la oficina, con 7 módulos: Aporte, Operaciones (planilla, créditos, mora y multas), Caja, Contabilidad, Reportes, Mantenimiento y Sistema. Incluye un portal web de consulta para el socio, alimentado cada 15 minutos por un servicio de sincronización seguro (HTTPS con token), y la migración de los datos de DerramaSoft. |
|---|

Límites del proyecto:

| Incluye: los 7 módulos de escritorio, contabilidad completa (voucher, Diario, Mayor, libros auxiliares y estados financieros), portal de consulta del socio (solo lectura), sincronización, migración con histórico desde 2010, pruebas, manuales y capacitación. No incluye: pagos en línea desde el portal, lectura automática de boletas, generación de la carta de garantía o del oficio a la UNSA, integración automática con los sistemas de la UNSA (el intercambio sigue siendo por archivo), registro de firmantes de cheques ni aplicación móvil. |
|---|

Entregables clave:

| Acta de constitución, documento de requerimientos y Product Backlog, diagrama de arquitectura y modelo de datos, aplicación de escritorio con los 7 módulos, portal web del socio y servicio de sincronización, migración con acta de cuadre, informe de pruebas, manuales de usuario por rol, capacitación e informe final. |
|---|

Requisitos de alto nivel:

| Acceso seguro con contraseñas cifradas, roles (Administrador, Cajero, Contable) y bitácora; aportes por caja y por planilla con un recibo por cuota; planilla mensual en dos Excel para la UNSA y cierre de mes; créditos con sistema francés, primera cuota por días y garante único; mora según tasa SUNAT e IGV; multas; caja con cheques, devoluciones y saldo negativo; subsidios y liquidaciones; contabilidad con IGV y registros en formato SUNAT; reportes en Excel; búsqueda de socio en menos de 2 segundos. |
|---|

Riesgo general del proyecto:

| Riesgo alto: alcance amplio para un periodo académico corto (4 sprints hasta diciembre), datos financieros sensibles, migración de 411,831 movimientos, decisiones pendientes de la Derrama (aporte de pasivos, fórmula de la bolsa, matriz de asientos contables) y disponibilidad limitada del personal para validar. |
|---|

| Objetivos del proyecto | Criterios de éxito |
|---|---|

Alcance:

| Implementar los 7 módulos, el portal del socio y la migración definidos en el Product Backlog (88 historias de usuario). | Historias aceptadas por el usuario de cada rol en las revisiones de sprint y requerimientos de prioridad alta funcionando. |
|---|---|

Tiempo:

| Ejecutar el proyecto en 4 sprints de 2 semanas, del 26/10/2026 al 18/12/2026, dentro del periodo académico. | Objetivo de cada sprint cumplido en su revisión y entrega final el 18/12/2026. |
|---|---|

Costo:

| Mantener el proyecto dentro del presupuesto operativo preliminar definido. | Uso de software sin costo de licencia (.NET y PostgreSQL) y de la infraestructura de la oficina; los únicos gastos recurrentes previstos son el hosting del portal y la emisión de comprobantes electrónicos, sujetos a cotización y aprobación. |
|---|---|

Otros:

| Proteger la confidencialidad, integridad y trazabilidad de la información financiera de los socios. | Pruebas de seguridad por rol aprobadas, bitácora activa y migración cuadrada (socios, saldos y préstamos) con acta firmada. |
|---|---|

| Hitos resumidos | Fecha estimada |
|---|---|
| H-01 Acta de constitución aprobada | 23/10/2026 |
| H-02 Requerimientos, Product Backlog y arquitectura validados | 23/10/2026 |
| H-03 Sprint 1: seguridad, socios, caja y contabilidad base | 06/11/2026 |
| H-04 Sprint 2: aportes, planilla mensual y conciliación | 20/11/2026 |
| H-05 Sprint 3: créditos, mora, multas y portal del socio | 04/12/2026 |
| H-06 Sprint 4: beneficios, contabilidad integrada y migración | 18/12/2026 |
| H-07 Pruebas, operación en paralelo, entrega final y cierre | 18/12/2026 |

Recursos financieros preaprobados:

| Por aprobar. El desarrollo lo realiza el equipo PIS G9 como proyecto académico. Gastos recurrentes previstos, sujetos a cotización final, IGV y aprobación institucional: hosting del portal de consulta (como referencia, la propuesta anterior estimó entre S/ 400 y S/ 900 anuales) y el servicio de emisión de comprobantes electrónicos, si la Derrama no cuenta con uno. La base de datos y la aplicación de escritorio se instalan en los equipos de la oficina. |
|---|

| Interesado(s) | Rol |
|---|---|
| Dra. Janeth Amparo Esquivel Las Heras | Presidenta del Consejo de Administración / patrocinadora del proyecto |
| Consejo de Administración de la ADEDUNSA | Aprueba reglas, reglamentos y refinanciamientos excepcionales |
| Señora Rosa | Responsable del área de préstamos |
| Señor Andrés | Responsable del área de aportes y beneficios |
| Señora Socorro | Responsable de caja y secretaría |
| Señor Percy | Responsable de contabilidad |
| Docentes asociados de la Derrama | Usuarios finales del portal de consulta |
| Ariel Dicson Taco Huaman | Scrum Master del equipo PIS G9 |
| Equipo del proyecto PIS G9 y asesor académico | Análisis, desarrollo, pruebas, documentación y supervisión |

Criterios de salida del proyecto:

| Cierre con el sistema de escritorio y el portal en funcionamiento, migración cuadrada con acta firmada, evidencias de pruebas, manuales por rol, capacitación e informe final al 18/12/2026. También podrá cerrarse por cancelación institucional, falta de acceso a la información o a los datos de DerramaSoft, o falta de validación mínima. |
|---|

Nivel de autoridad del gestor del proyecto:

Decisiones sobre el equipo:

| El gestor y el Scrum Master coordinan al equipo, facilitan las ceremonias Scrum (planificación, reunión diaria, revisión y retrospectiva), distribuyen tareas, levantan impedimentos y solicitan evidencias de avance. |
|---|

Gestión del presupuesto y variaciones:

| Controla el presupuesto y comunica a la patrocinadora las variaciones relevantes; no compromete gastos sin aprobación institucional. |
|---|

Decisiones técnicas:

| Coordina las decisiones de arquitectura, base de datos, sincronización, QA y despliegue, priorizando la seguridad, la integridad de la información y la usabilidad. |
|---|

Resolución de conflictos:

| Los conflictos se tratan en las reuniones del equipo. Si afectan el alcance, el cronograma o la validación, se escalan al asesor académico o a la patrocinadora. |
|---|

Autoridad del patrocinador:

| Aprueba el inicio, valida los entregables en las revisiones de sprint, prioriza el Product Backlog con el equipo, autoriza cambios relevantes y facilita el acceso a la información, a los documentos y al personal de la Derrama. |
|---|

Aprobaciones:

| Presidenta del Consejo de Administración de la ADEDUNSA Nombre: ESQUIVEL LAS HERAS, JANETH AMPARO DNI: ____________________ | Scrum Master - Representante del equipo de desarrollo PIS G9 Nombre: ARIEL DICSON TACO HUAMAN DNI: 76952859 |
|---|---|
