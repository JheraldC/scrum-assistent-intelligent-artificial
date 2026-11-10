# Feature Specification: Agente Inteligente para la Guía y Validación del Proceso Scrum

**Feature Branch**: `001-scrum-ai-agent-guide` (directorio de especificación; no se creó rama git)

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Desarrollar un prototipo web de agente inteligente que guíe y valide el trabajo de equipos novatos que utilizan Scrum, con flujo guiado, compuertas de validación y agente conversacional."

## Contexto y Problema

Los equipos novatos suelen omitir o ejecutar de forma incompleta los eventos y artefactos de Scrum: historias de usuario ambiguas, Sprints sin objetivo claro o retrospectivas sin acciones de mejora. Esto reduce la calidad y la previsibilidad del desarrollo.

**Alcance del producto**: este documento especifica únicamente el **producto de software**: una aplicación web siempre asistida por IA que orienta al equipo, valida criterios mínimos antes de avanzar y da retroalimentación. **El experimento comparativo (Scrum tradicional vs. Scrum con IA) se ejecuta manualmente fuera de la aplicación** por el equipo del proyecto. La aplicación no ofrece modo "sin IA", ni rúbrica de puntuación, ni panel comparativo; solo registra y exporta datos objetivos que luego sirven para ese análisis externo (Constitución, Principio VI).

**Usuarios**: integrantes de equipos novatos (Participante) y facilitador / Scrum Master del equipo (Facilitador).

**Referencia de proceso**: Scrum Guide 2020. Los criterios de validación se clasifican como *oficiales de Scrum* o *adicionales del prototipo* (Constitución, Principio III). Las compuertas son controles del prototipo, no reglas universales de Scrum.

## Clarifications

### Session 2026-11-09

- Q: ¿Cómo debe acceder el equipo a la aplicación durante una sesión? → A: Despliegue en internet con varios equipos simultáneos y datos centralizados.
- Q: ¿Cómo debe identificarse cada persona y asignársele su rol? → A: Cuentas con correo y contraseña para todos; el Facilitador (Scrum Master) puede gestionar varios proyectos y asigna roles de forma independiente en cada proyecto.
- Q: ¿Qué parte del experimento debe vivir en el software? → A: El experimento se hace manualmente fuera de la aplicación; el producto es siempre con IA (sin interruptor ni modo sin IA) y solo registra y exporta datos objetivos. Esto sustituye lo anterior sobre puntuación a ciegas y retención de datos de investigación, que quedan fuera de alcance (ver Funcionalidades Futuras).
- Q: ¿Quién puede crear un proyecto nuevo? → A: Cualquier persona con cuenta; quien lo crea queda como Facilitador de ese proyecto.
- Q: ¿Puede un proyecto tener varios Sprints dentro del MVP? → A: Sí, varios Sprints consecutivos con uno abierto a la vez; el Facilitador crea el siguiente al cerrar el anterior; sin métricas de velocidad.
- Q: ¿El registro es abierto o con invitación? → A: Registro abierto: cualquier persona puede crear una cuenta; el consumo de IA se acota con límites de uso.
- Q: ¿Qué decisiones se tomaron tras el análisis de coherencia (/speckit-analyze)? → A: Constitución enmendada a la v2.0.0 (comparación externa); SC-001 con máximo de 90 minutos; explicaciones de máximo 3 líneas; se acepta revelar si una cuenta existe; agregar por correo sin cuenta se rechaza; control de versión también en proyecto y acciones de retrospectiva; la retroalimentación de IA se pide bajo demanda.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cuentas, proyectos y flujo guiado (Priority: P1) 🎯 MVP

Una persona se registra con correo y contraseña e inicia sesión. Un Facilitador crea proyectos Scrum (nombre, descripción, objetivo del producto), puede tener varios, e invita o asigna personas con un rol independiente en cada proyecto. Quien entra a un proyecto ve un flujo visual con las etapas del Sprint (planificación, seguimiento, revisión, retrospectiva) y su estado: pendiente, en progreso, requiere corrección o validada.

**Why this priority**: Es la base; sin cuentas, proyectos y flujo no hay dónde registrar artefactos ni validar.

**Independent Test**: Registrarse, crear dos proyectos, asignar a otra persona un rol distinto en cada uno, y comprobar que cada persona solo ve sus proyectos, con las cuatro etapas en estado "pendiente".

**Acceptance Scenarios**:

1. **Given** una persona sin cuenta, **When** se registra con correo y contraseña válidos, **Then** puede iniciar sesión.
2. **Given** una persona autenticada, **When** crea un proyecto con nombre, descripción y objetivo del producto válidos, **Then** aparece en su lista y puede seleccionarlo; puede crear más proyectos.
3. **Given** un Facilitador con dos proyectos, **When** asigna a una persona el rol Participante en uno y Facilitador en otro, **Then** cada rol se aplica solo en su proyecto.
4. **Given** una persona sin rol en un proyecto, **When** intenta acceder a él, **Then** el acceso se rechaza.
5. **Given** un formulario de proyecto con nombre vacío, **When** se envía, **Then** se muestra un error en español y no se crea.
6. **Given** un proyecto con actividad, **When** se consulta el historial, **Then** se ven actividades y artefactos en orden cronológico.

---

### User Story 2 - Redactar historias de usuario y recibir evaluación (Priority: P1) 🎯 MVP

El Participante crea, modifica y consulta elementos del Product Backlog, incluidas historias de usuario con criterios de aceptación. El sistema evalúa claridad, coherencia, completitud y verificabilidad, identifica historias ambiguas y propone mejoras concretas.

**Why this priority**: Las historias ambiguas son el primer problema citado y el primer artefacto del flujo.

**Independent Test**: Registrar una historia ambigua (sin criterios de aceptación, texto vago) y una bien formada; la primera muestra criterios incumplidos y sugerencias, la segunda cumple.

**Acceptance Scenarios**:

1. **Given** un proyecto, **When** el Participante crea una historia con rol, necesidad, beneficio y criterios de aceptación, **Then** se guarda y aparece en el Product Backlog.
2. **Given** una historia sin criterios de aceptación, **When** se evalúa, **Then** el criterio de completitud se marca "no cumplido" con explicación y sugerencia concreta.
3. **Given** una historia con términos vagos (p. ej. "rápido", "fácil"), **When** se evalúa, **Then** el criterio de verificabilidad se marca "no cumplido" indicando los términos detectados.
4. **Given** una historia existente, **When** se modifica, **Then** el cambio se guarda y la evaluación anterior se conserva en el historial.

---

### User Story 3 - Planificar el Sprint con compuerta de validación (Priority: P1) 🎯 MVP

El Participante define el Sprint Goal, selecciona elementos del Product Backlog y registra el plan de trabajo. Una compuerta evalúa criterios verificables (existencia y comprensibilidad del objetivo; coherencia entre objetivo, trabajo seleccionado y plan) y muestra cada criterio como cumplido o no. El avance solo se habilita si la compuerta se supera; se puede corregir y reevaluar.

**Why this priority**: Es el mecanismo central de control de la herramienta.

**Independent Test**: Intentar avanzar con un Sprint Goal vacío (bloqueado, con criterios fallidos); corregir y reevaluar hasta superar la compuerta y avanzar.

**Acceptance Scenarios**:

1. **Given** un Sprint sin Sprint Goal, **When** se evalúa la compuerta, **Then** el avance queda bloqueado y se muestra qué criterios fallan y por qué.
2. **Given** una compuerta fallida, **When** se corrigen los artefactos y se reevalúa, **Then** los resultados se actualizan y, si los criterios obligatorios se cumplen, se habilita el avance.
3. **Given** cualquier evaluación de compuerta, **When** termina, **Then** se registran fecha, estado y resultado por criterio.
4. **Given** una compuerta fallida, **When** el Facilitador del proyecto autoriza una excepción con justificación, **Then** el avance se habilita y la excepción queda registrada con autor, fecha y motivo.

---

### User Story 4 - Asistente conversacional y retroalimentación con IA (Priority: P1) 🎯 MVP

El Participante conversa con un asistente que conoce el contexto del proyecto: responde dudas sobre el flujo y los criterios, analiza los artefactos, detecta omisiones, explica criterios incumplidos y sugiere correcciones sin modificarlos automáticamente. La interfaz distingue claramente las recomendaciones de IA de las comprobaciones basadas en reglas.

**Why this priority**: Es la intervención de IA que justifica el producto.

**Independent Test**: Con artefactos incompletos, preguntar al asistente por qué falla un criterio y verificar que explica, sugiere y no altera datos; verificar el etiquetado IA vs. regla.

**Acceptance Scenarios**:

1. **Given** una historia incompleta, **When** el Participante pregunta qué le falta, **Then** el asistente enumera omisiones y propone correcciones etiquetadas como "Recomendación de IA".
2. **Given** una respuesta del asistente, **When** se muestra, **Then** incluye el aviso de que es una sugerencia no garantizada, y los resultados de reglas llevan la etiqueta "Comprobación por reglas".
3. **Given** una sugerencia del asistente, **When** el Participante no la aplica, **Then** los artefactos no cambian.
4. **Given** que el servicio de IA falla, expira o devuelve una respuesta inválida, **When** el Participante pide ayuda, **Then** ve un mensaje claro, las comprobaciones por reglas siguen funcionando y el incidente queda registrado.
5. **Given** cualquier interacción con el agente, **When** se completa, **Then** se registra con la versión del modelo y su configuración.

---

### User Story 5 - Retrospectiva con validación de acciones de mejora (Priority: P2)

El Participante registra aspectos positivos, problemas y oportunidades de mejora, y define acciones concretas con responsable. El sistema evalúa claridad de las acciones, presencia de responsables y seguimiento cuando corresponda, y retroalimenta sobre la calidad de los acuerdos.

**Why this priority**: Cierra el flujo y atiende el problema de retrospectivas sin acciones.

**Independent Test**: Registrar una retrospectiva sin acciones (falla) y otra con acciones concretas y responsables (cumple).

**Acceptance Scenarios**:

1. **Given** una retrospectiva sin acciones, **When** se evalúa, **Then** el criterio correspondiente se marca "no cumplido" con una sugerencia.
2. **Given** una acción sin responsable, **When** se evalúa, **Then** se señala la falta de responsable.
3. **Given** acciones de un Sprint anterior, **When** se registra la nueva retrospectiva, **Then** se solicita registrar el estado de seguimiento de esas acciones.

---

### User Story 6 - Registro de actividad y exportación de datos (Priority: P2)

El Facilitador exporta, en CSV o JSON, los datos objetivos de un proyecto para analizarlos fuera de la aplicación (por ejemplo, para comparar con el trabajo Scrum tradicional): fechas y duraciones de actividades y etapas, resultados de cada evaluación de compuerta por criterio, número de reintentos hasta superar cada compuerta, excepciones y uso del asistente de IA. Las personas aparecen solo con seudónimo.

**Why this priority**: Es la única conexión del producto con el experimento manual; sin ella los datos no se pueden verificar.

**Independent Test**: Trabajar un escenario completo, exportar y comprobar que cada dato exportado coincide con lo visible en la aplicación y que no hay correos ni nombres.

**Acceptance Scenarios**:

1. **Given** un proyecto con actividad, **When** el Facilitador exporta, **Then** obtiene un CSV o JSON con fechas, duraciones, resultados por criterio, reintentos, excepciones e interacciones de IA.
2. **Given** una exportación, **When** se revisa, **Then** las personas aparecen solo con seudónimo, sin correo, nombre real ni credenciales.
3. **Given** una medida sin registro, **When** se exporta, **Then** aparece vacía; el sistema nunca inventa valores.
4. **Given** un Participante, **When** intenta exportar, **Then** se rechaza.
5. **Given** datos de ejemplo (demostración), **When** se exporta, **Then** están marcados como tales y excluidos por defecto.

---

### User Story 7 - Seguimiento del Sprint y Sprint Review simplificados (Priority: P3)

El Participante registra avances, impedimentos, observaciones y notas de Daily Scrum, actualiza el plan de trabajo, y en la Sprint Review registra resultados, incrementos y retroalimentación, relacionándolos con el Sprint Goal. El sistema señala información incompleta y propone mejoras; el progreso se muestra sin reemplazar decisiones del equipo.

**Why this priority**: Completa el flujo Scrum, pero puede ser simple en el MVP.

**Independent Test**: Registrar avances e impedimentos; completar la Review vinculada al Sprint Goal y comprobar el aviso cuando falta información.

**Acceptance Scenarios**:

1. **Given** un Sprint en curso, **When** se registra un impedimento o avance, **Then** queda guardado con fecha y visible en el seguimiento.
2. **Given** una Review sin relación con el Sprint Goal, **When** se evalúa, **Then** se señala la omisión y se sugiere cómo completarla.

---

### Edge Cases

- Entradas vacías, muy largas o con caracteres especiales en cualquier formulario: se validan con mensajes claros.
- Intento de avanzar sin superar la compuerta ni tener excepción: se rechaza.
- Excepción sin justificación o hecha por un no Facilitador: se rechaza.
- Modificar un artefacto ya validado: la etapa pasa a "requiere corrección" o exige reevaluar; el historial conserva ambas versiones.
- Dos personas editan a la vez el mismo artefacto: se avisa del conflicto sin perder cambios en silencio.
- Servicio de IA con tiempo agotado, respuesta con formato inválido o sin credenciales: se muestra error, las reglas siguen operando y se registra el incidente.
- Credenciales incorrectas, correo ya registrado o contraseña débil: mensajes claros; el inicio de sesión no distingue entre correo inexistente y contraseña errónea.
- Agregar a un proyecto un correo sin cuenta registrada: se rechaza con el mensaje «La persona debe registrarse primero»; no se envían invitaciones.
- Uso excesivo del asistente (por una persona o un proyecto): se rechaza con mensaje claro al superar el límite; las reglas siguen operativas.
- Persona eliminada de un proyecto: pierde el acceso; los artefactos que creó se conservan.
- Exportar un proyecto sin datos o solo con datos de ejemplo: se informa y no se genera un archivo engañoso.
- Pantallas pequeñas (móvil): el flujo sigue siendo utilizable.

## Requirements *(mandatory)*

### Functional Requirements — Esenciales del MVP

**Cuentas, proyectos y roles**
- **FR-001**: El sistema MUST permitir registrarse e iniciar sesión con correo y contraseña, y MUST rechazar el acceso a proyectos en los que la persona no tiene un rol.
- **FR-002**: Cualquier persona con cuenta MUST poder crear proyectos con nombre, descripción y objetivo del producto, validando campos obligatorios, y queda como Facilitador de cada proyecto que crea; un Facilitador MUST poder gestionar varios proyectos y MUST poder asignar en cada proyecto un rol independiente (Participante o Facilitador) a cada persona; una misma persona MUST poder tener roles distintos en proyectos distintos.
- **FR-003**: Las funciones restringidas por rol (autorizar excepciones, gestionar miembros, exportar) MUST aplicarse según el rol de la persona en ese proyecto y MUST rechazarse en caso contrario.
- **FR-004**: El sistema MUST mostrar el estado de cada proyecto y un historial cronológico de actividades y artefactos.

**Flujo guiado**
- **FR-005**: El sistema MUST presentar un flujo visual con las etapas de planificación, seguimiento, revisión y retrospectiva, cada una con estado: pendiente, en progreso, requiere corrección o validada.
- **FR-006**: El sistema MUST permitir registrar la evidencia asociada a cada actividad.
- **FR-007**: La interfaz MUST orientar a equipos sin experiencia en Scrum con una explicación de cada etapa y de cada criterio de máximo 3 líneas, sin sustituir las responsabilidades del equipo.

**Product Backlog e historias**
- **FR-008**: El sistema MUST permitir crear, modificar y consultar elementos del Product Backlog, incluidas historias de usuario con criterios de aceptación.
- **FR-009**: El sistema MUST evaluar cada historia según claridad, coherencia, completitud y verificabilidad mediante reglas explícitas y MUST producir resultado, criterios evaluados, observaciones y recomendaciones.
- **FR-010**: El sistema MUST identificar historias ambiguas o insuficientemente definidas y proponer mejoras concretas.

**Sprint Planning y compuertas**
- **FR-011**: El sistema MUST permitir definir el Sprint Goal, seleccionar elementos del Product Backlog y registrar el plan de trabajo; un proyecto MUST poder tener varios Sprints consecutivos con un solo Sprint abierto a la vez, y solo un Facilitador MUST poder crear el siguiente cuando el anterior esté cerrado.
- **FR-012**: El sistema MUST evaluar la compuerta de planificación (existencia y comprensibilidad del objetivo, y coherencia entre objetivo, trabajo seleccionado y plan) y mostrar el resultado individual de cada criterio.
- **FR-013**: El sistema MUST impedir el avance entre etapas con compuerta mientras sus criterios obligatorios no se cumplan, salvo excepción manual registrada.
- **FR-014**: El sistema MUST permitir corregir artefactos y reevaluar cualquier compuerta tantas veces como sea necesario.
- **FR-015**: El sistema MUST registrar por cada evaluación la fecha, el estado y el resultado por criterio.
- **FR-016**: Solo un Facilitador del proyecto MUST poder autorizar una excepción manual, con justificación obligatoria; la excepción MUST registrar autor, fecha y motivo.
- **FR-017**: Cada criterio MUST indicarse como "oficial de Scrum" (Scrum Guide 2020) o "adicional del prototipo".

**Retrospectiva**
- **FR-018**: El sistema MUST permitir registrar aspectos positivos, problemas y oportunidades de mejora, y definir acciones con responsable.
- **FR-019**: El sistema MUST evaluar la claridad de las acciones, la presencia de responsables y, cuando existan acciones previas, su seguimiento, y MUST dar retroalimentación sobre la calidad de los acuerdos.

**Agente inteligente**
- **FR-020**: El sistema MUST incluir siempre un asistente conversacional con el contexto del proyecto, que responda dudas del flujo y de los criterios, analice artefactos, detecte omisiones y explique criterios incumplidos.
- **FR-021**: El asistente MUST sugerir correcciones sin modificar nunca los artefactos automáticamente.
- **FR-022**: El sistema MUST distinguir visualmente las recomendaciones de IA de las comprobaciones basadas en reglas, y MUST advertir que las recomendaciones de IA no son verdades garantizadas.
- **FR-023**: La IA MUST complementar y no sustituir las reglas deterministas: el resultado de una compuerta MUST depender solo de reglas explícitas.
- **FR-024**: El sistema MUST validar el formato de las respuestas del modelo y gestionar errores, tiempos de espera y respuestas inválidas sin interrumpir las comprobaciones por reglas.
- **FR-024a**: Dado que el registro es abierto, el sistema MUST limitar el uso del asistente (por persona en el tiempo y por proyecto por día); al alcanzar un límite MUST informarlo con un mensaje claro y las comprobaciones por reglas MUST seguir funcionando.
- **FR-025**: El sistema MUST registrar cada interacción del agente con la versión del modelo y la configuración relevante.

**Registro y exportación**
- **FR-026**: El sistema MUST registrar fechas, duraciones y resultados de actividades, etapas y evaluaciones, el número de reintentos hasta superar cada compuerta, las excepciones y el uso del asistente.
- **FR-027**: El Facilitador MUST poder exportar esos registros por proyecto en CSV o JSON.
- **FR-028**: Las exportaciones MUST identificar a las personas solo con un seudónimo y MUST NOT incluir correo, nombre real ni credenciales.
- **FR-029**: El sistema MUST NOT inventar, estimar ni rellenar valores ausentes en registros o exportaciones.
- **FR-030**: Los datos de ejemplo MUST estar claramente marcados como tales y excluidos de las exportaciones por defecto.

**Transversales**
- **FR-031**: Toda la interfaz y los mensajes MUST estar en español.
- **FR-032**: La interfaz MUST ser utilizable en escritorio y en móvil.
- **FR-033**: El sistema MUST validar todas las entradas y mostrar mensajes de error comprensibles.
- **FR-034**: Los datos MUST persistir de forma centralizada y estar disponibles desde cualquier dispositivo con acceso a la aplicación en internet.
- **FR-035**: El sistema MUST soportar varios equipos simultáneos sin que los datos de un proyecto sean visibles en otro al que la persona no pertenece.
- **FR-036**: Cuando dos personas editen a la vez el mismo artefacto, los datos del proyecto o una acción de retrospectiva, el sistema MUST evitar la pérdida silenciosa de cambios (p. ej. avisando del conflicto antes de sobrescribir).
- **FR-037**: Las credenciales del servicio de IA y las contraseñas MUST protegerse y no exponerse en la interfaz, registros ni exportaciones.

### Funcionalidades Simplificadas en el MVP

- **FR-038**: Seguimiento del Sprint: registrar avances, impedimentos, observaciones y notas de Daily Scrum, y actualizar el plan de trabajo (formulario simple con historial; sin gráficos).
- **FR-039**: Sprint Review: registrar resultados, incrementos y retroalimentación, relacionarlos con el Sprint Goal y señalar información incompleta.

### Funcionalidades Futuras (fuera del MVP)

- Modo experimental dentro de la aplicación: condición sin IA, escenarios predefinidos y asignación de condición.
- Rúbrica de puntuación en la aplicación, evaluación a ciegas y rol Evaluador.
- Panel de resultados y comparación entre condiciones.
- Retención y borrado de datos de investigación a nivel de aplicación.
- Métricas de velocidad entre Sprints; burndown/burnup.
- Recuperación de contraseña, verificación de correo e inicio de sesión con proveedores externos.
- Integración con Jira, Trello o GitHub; notificaciones y edición colaborativa en tiempo real.
- Idiomas distintos al español.

### Key Entities

- **Usuario y Rol en proyecto**: cuenta (correo, contraseña) con seudónimo y su rol (Participante o Facilitador) en cada proyecto.
- **Proyecto**: iniciativa Scrum con nombre, descripción, objetivo del producto, estado y miembros.
- **Elemento del Product Backlog / Historia de usuario**: rol, necesidad, beneficio, criterios de aceptación, prioridad y estado; tiene evaluaciones.
- **Sprint**: iteración con Sprint Goal, elementos seleccionados, plan de trabajo y etapas.
- **Etapa**: planificación, seguimiento, revisión o retrospectiva, con estado, evidencia y tiempos.
- **Registro de seguimiento**: avance, impedimento, observación o nota de Daily Scrum con fecha.
- **Review y Retrospectiva**: resultados, incrementos, retroalimentación, aspectos positivos, problemas y acciones con responsable y estado.
- **Compuerta y Criterio**: transición controlada; cada criterio con descripción, origen (oficial o adicional), obligatoriedad y resultado.
- **Evaluación de validación**: ejecución de una compuerta con fecha, estado, resultado por criterio y número de intento.
- **Excepción manual**: autorización justificada de avance con autor, fecha y motivo.
- **Interacción del agente**: pregunta, respuesta, tipo (recomendación IA), versión de modelo, configuración, fecha y resultado (éxito/error).
- **Exportación**: conjunto de registros de un proyecto en CSV o JSON, solo con seudónimos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un Participante nuevo completa el recorrido (crear proyecto, historias, Sprint Goal, validación, corrección y retrospectiva) en una sola sesión de máximo 90 minutos sin asistencia técnica.
- **SC-002**: En un conjunto de casos de prueba con defectos conocidos (historias, Sprint Goals y retrospectivas), el 100 % de los incumplimientos definidos en las reglas se detecta y se explica.
- **SC-003**: El 100 % de los intentos de avanzar con criterios obligatorios incumplidos y sin excepción es rechazado, y el 100 % de las compuertas puede reevaluarse tras corregir.
- **SC-004**: El 100 % de los proyectos, artefactos, validaciones e interacciones creados sigue disponible tras cerrar sesión y volver a entrar desde otro dispositivo.
- **SC-005**: El 100 % de los intentos de acceder a un proyecto sin rol, o de usar una función restringida sin el rol requerido, es rechazado.
- **SC-006**: El 100 % de los datos exportados coincide con lo visible en la aplicación, y las exportaciones contienen 0 correos, nombres reales o credenciales.
- **SC-007**: 0 valores se generan sin un registro real; los datos de ejemplo nunca aparecen en exportaciones por defecto.
- **SC-008**: El 100 % de las interacciones del agente queda registrado con versión de modelo y configuración.
- **SC-009**: Con el servicio de IA no disponible, el 100 % de las comprobaciones por reglas y de las compuertas sigue funcionando.
- **SC-010**: Cada pantalla del flujo MVP es utilizable en un ancho de móvil de 375 px sin desplazamiento horizontal.
- **SC-011**: Una persona puede ejecutar el producto y sus pruebas siguiendo solo la documentación del proyecto.

## Assumptions

- La aplicación se despliega en internet y varios equipos la usan a la vez con datos centralizados; la edición colaborativa en tiempo real queda fuera del MVP, pero se evita la pérdida silenciosa de cambios.
- Por ser un prototipo de uso académico, se acepta que el registro con un correo ya existente y la acción de agregar miembros por correo revelen si una cuenta existe.
- Todas las personas usan una cuenta con correo y contraseña; el Facilitador (Scrum Master) asigna los roles por proyecto. Cada cuenta tiene un seudónimo generado automáticamente que se usa en las exportaciones.
- El producto siempre incluye el agente de IA; el experimento (Scrum tradicional vs. con IA) y la rúbrica se gestionan manualmente fuera de la aplicación con los datos exportados.
- Las compuertas por reglas están siempre activas; las excepciones manuales solo las autoriza el Facilitador del proyecto.
- Se dispone de un servicio de IA externo con credenciales gestionadas fuera del código; sin credenciales, el sistema sigue funcionando con reglas.
- El servicio de IA se usa con un plan gratuito de cupo diario pequeño y compartido entre todos los equipos; cuando el cupo se agota el asistente no está disponible hasta su restablecimiento, y las comprobaciones por reglas no se ven afectadas.
- La interfaz y el contenido están solo en español; los datos de ejemplo se cargan de forma explícita y se marcan como tales.
- El Facilitador y los Participantes de un proyecto ya acuerdan fuera de la aplicación quién es el Facilitador; el sistema no impone la composición del equipo Scrum.

## Mejora 2026-11: asistente práctico para todo el equipo Scrum

Requisitos añadidos después del MVP. La IA recomienda; las personas deciden; las reglas deterministas siguen siendo las únicas que aprueban o bloquean compuertas.

- **FR-040**: Cada proyecto permite configurar **responsabilidades Scrum** (Scrum Master, Product Owner, Developers) por persona; una persona puede tener varias o ninguna, y no cambian los permisos Facilitador/Participante.
- **FR-041**: Existen **vistas** de solo lectura para Scrum Master (Sprint Goal, estado, impedimentos abiertos, acciones de retrospectiva pendientes, asuntos que requieren atención calculados por reglas), Product Owner (Product Goal, DoD, Product Backlog ordenado, elementos por aclarar, comentarios de la Review) y Developers (Sprint Goal, elementos seleccionados, tareas opcionales, impedimentos). Ninguna puntúa ni compara a personas.
- **FR-042**: El **Product Goal** es visible y editable (Facilitador) y cada proyecto tiene una **Definition of Done** compartida y opcional; los proyectos existentes quedan con DoD vacía sin bloquear nada.
- **FR-043**: El Sprint puede desglosarse, de forma **opcional**, en **tareas** con estado y responsable opcional; no son requisito para planificar ni avanzar. No se exige tener todo el producto definido antes del Sprint 1.
- **FR-044**: Cada proyecto tiene **documentación permanente opcional** (cargar, consultar, reemplazar con versiones, marcar como desactualizada, incluir o excluir del contexto de IA), separada de la evidencia de las etapas. Sin documentos, el producto y el asistente funcionan con el contexto disponible.
- **FR-045**: Las **evidencias de etapa** admiten, además de texto o enlace, un **archivo adjunto opcional** (almacenamiento privado) que muestra autor, fecha y etapa y deja claro que la aplicación no verifica su contenido.
- **FR-046**: El contexto de la IA crece con los datos reales del proyecto (descripción y Product Goal, DoD, Product Backlog, Sprint activo, Sprint Goal, tareas, decisiones, asuntos detectados y fragmentos pertinentes de documentos), nunca de otros proyectos, y cada respuesta indica qué contexto se usó, cita documento y sección cuando se apoya en uno y distingue lo que dice un documento de lo que infiere la IA. La interfaz informa que ese contenido puede enviarse al proveedor externo de IA.
- **FR-047**: El asistente es un **panel lateral persistente** en escritorio (contraíble y redimensionable) y un **cajón** accesible en móvil.
- **FR-048**: La IA puede **proponer** historias, criterios de aceptación, tareas, riesgos, dependencias y preguntas. Toda salida es una propuesta: se muestra el cambio y su efecto y la persona puede **aceptar, editar o descartar**, con confirmación; se registra quién lo aplicó y su origen; se respeta el control de versión (sin sobrescribir cambios concurrentes) y se reevalúa con las reglas. La IA no cambia el estado de una compuerta, no autoriza excepciones, no crea compromisos del equipo ni asigna personas.
- **FR-049**: Existe un **registro de decisiones y acuerdos** (texto, fecha y autor, solo inserción) visible para el equipo y usado como contexto de IA; las acciones de retrospectiva pendientes se siguen con las funciones existentes. Hay ayudas breves y opcionales para Planning, Daily Scrum, Review y Retrospective.

**Fuera de alcance de esta mejora**: notificaciones, calendario, integraciones con Jira/Trello/GitHub, métricas individuales o comparativas.
