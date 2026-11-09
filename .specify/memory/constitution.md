<!--
Sync Impact Report
- Version change: (plantilla sin ratificar) → 1.0.0
- Principios modificados: ninguno renombrado (se definieron los 8 principios iniciales)
- Secciones añadidas: Principios Fundamentales (I–VIII), Alcance y Restricciones del
  Prototipo, Flujo de Desarrollo y Puertas de Calidad, Gobernanza
- Secciones eliminadas: ninguna
- TODOs diferidos: ninguno
-->
# Constitución del Agente Inteligente para la Guía y Validación del Proceso Scrum

## Principios Fundamentales

### I. Calidad y Mantenibilidad
El código MUST aplicar SOLID, DRY, KISS y separación de responsabilidades.
- Los componentes MUST ser modulares, reutilizables y verificables de forma aislada.
- Los nombres MUST ser descriptivos y seguir una convención consistente en todo el proyecto.
- MUST NOT añadirse dependencias, abstracciones ni funcionalidades que el prototipo no necesite.
- Las decisiones técnicas importantes MUST documentarse con su justificación.

Justificación: un prototipo académico debe poder entenderse, probarse y defenderse con facilidad.

### II. Desarrollo Guiado por Especificaciones
Todo requisito MUST ser verificable mediante criterios de aceptación explícitos.
- MUST existir trazabilidad entre requisito, implementación y prueba.
- MUST NOT implementarse funcionalidad fuera del alcance sin justificación escrita.
- Los cambios MUST entregarse en incrementos pequeños, funcionales y demostrables.

Justificación: la trazabilidad permite demostrar qué se construyó y que cumple lo pedido.

### III. Calidad de las Validaciones Scrum
La referencia oficial MUST ser la Scrum Guide 2020.
- MUST distinguirse entre elementos oficiales de Scrum y criterios adicionales definidos
  para el experimento, y cada regla MUST indicar a cuál pertenece.
- Las reglas críticas de validación MUST ser explícitas, deterministas y reproducibles.
- La IA MUST complementar las reglas deterministas y MUST NOT sustituirlas silenciosamente.
- Cada validación MUST producir: resultado, criterios evaluados, observaciones y recomendaciones.
- Los bloqueos entre etapas MUST presentarse como controles experimentales del prototipo, no
  como reglas universales de Scrum, y MUST NOT bloquear el trabajo de forma arbitraria.

Justificación: la validez del experimento depende de reglas claras y de no atribuir a Scrum
restricciones que no son suyas.

### IV. Inteligencia Artificial Responsable
- Las respuestas generadas MUST NOT presentarse como verdades garantizadas.
- El formato de las respuestas del modelo MUST validarse antes de usarse.
- MUST gestionarse errores, tiempos de espera y respuestas inválidas con un comportamiento
  definido (por ejemplo, recurrir a la validación determinista e informar al usuario).
- Las claves API MUST mantenerse fuera del repositorio (variables de entorno) y los datos de
  los usuarios MUST protegerse.
- MUST registrarse la versión del modelo y la configuración relevante de cada evaluación.

Justificación: la reproducibilidad y la confianza exigen controlar la incertidumbre del modelo.

### V. Testing (NO NEGOCIABLE en reglas y compuertas)
- MUST haber pruebas unitarias, de integración y funcionales.
- MUST probarse escenarios válidos, inválidos y casos límite.
- Las reglas y compuertas de validación MUST tener cobertura prioritaria.
- Los resultados simulados MUST NOT usarse como evidencia experimental real.
- Todo defecto crítico MUST corregirse antes de declarar funcional el prototipo.

Justificación: las compuertas son el núcleo del experimento; un error en ellas invalida los datos.

### VI. Rigor Experimental
- El sistema MUST permitir comparar Scrum sin agente IA y Scrum asistido por IA.
- MUST registrarse datos objetivos, medibles y exportables.
- Las condiciones de evaluación MUST ser comparables entre ambos grupos.
- Los datos de demostración MUST estar separados de los datos experimentales.
- MUST NOT inventarse participantes, mediciones, resultados ni conclusiones.
- Los participantes MUST identificarse únicamente con identificadores seudónimos.

Justificación: las conclusiones solo son defendibles si los datos son reales, comparables y éticos.

### VII. Usabilidad
- La interfaz MUST ser intuitiva, moderna y completamente en español.
- MUST ofrecer orientación clara para equipos sin experiencia en Scrum.
- MUST mostrar visualmente las etapas, los criterios cumplidos, los errores y las recomendaciones.
- La accesibilidad, la retroalimentación inmediata y la claridad MUST priorizarse.

Justificación: el público objetivo son equipos novatos que necesitan guía comprensible.

### VIII. Documentación y Reproducibilidad
- El README MUST incluir instalación, configuración y ejecución.
- MUST documentarse arquitectura, endpoints, estructura de datos y decisiones principales.
- MUST haber instrucciones reproducibles para ejecutar las pruebas.
- Los datos de ejemplo MUST estar claramente identificados como tales.
- MUST prepararse evidencias útiles para el Hito 2 de Tópicos Avanzados en Ingeniería de Software.

Justificación: un tercero debe poder ejecutar, verificar y evaluar el trabajo sin ayuda.

## Alcance y Restricciones del Prototipo

- Se prioriza un prototipo académico funcional, comprobable y mantenible sobre una solución
  excesivamente compleja.
- El alcance cubre: orientar a equipos novatos en un flujo Scrum, validar criterios mínimos de
  eventos y artefactos, dar retroalimentación y controlar el avance entre etapas.
- Cualquier funcionalidad fuera de ese alcance MUST justificarse conforme al Principio II.
- Secretos y datos personales MUST NOT versionarse en el repositorio.

## Flujo de Desarrollo y Puertas de Calidad

- El trabajo sigue el flujo de Spec Kit: constitución, especificación, plan, tareas e
  implementación.
- Toda funcionalidad MUST tener criterios de aceptación y pruebas asociadas antes de darse por
  terminada.
- Una funcionalidad MUST NOT darse por completa con pruebas fallando o defectos críticos abiertos.
- Los cambios MUST integrarse en incrementos pequeños y demostrables, con mensajes de commit claros.
- Las revisiones MUST verificar el cumplimiento de esta constitución.

## Gobernanza

Esta constitución prevalece sobre otras prácticas del proyecto.
- **Enmiendas**: MUST proponerse por escrito, justificarse y registrarse actualizando este
  documento, su versión y la fecha de última enmienda.
- **Versionado** (semántico): MAJOR por eliminación o redefinición incompatible de principios;
  MINOR por principios o secciones nuevas o ampliación sustancial; PATCH por aclaraciones y
  correcciones de redacción.
- **Cumplimiento**: cada especificación, plan y revisión MUST comprobar el cumplimiento de los
  principios; toda complejidad adicional MUST justificarse.

**Version**: 1.0.0 | **Ratified**: 2026-11-09 | **Last Amended**: 2026-11-09
