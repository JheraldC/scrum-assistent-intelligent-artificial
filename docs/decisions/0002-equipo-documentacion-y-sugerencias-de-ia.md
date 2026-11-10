# 0002. Responsabilidades Scrum, documentación permanente y sugerencias de IA revisables

- **Fecha**: 2026-11-10
- **Estado**: aceptada
- **Contexto**: el producto debía servir a todo el equipo Scrum (no solo al Facilitador), permitir documentación
  permanente opcional como contexto de la IA, adjuntos opcionales como evidencia y un asistente que proponga cambios
  sin poder aplicarlos. El prototipo se despliega con un único contenedor y una base PostgreSQL gestionada, sin
  almacenamiento de objetos.
- **Decisión**:
  1. **Responsabilidades Scrum** (`SCRUM_MASTER`, `PRODUCT_OWNER`, `DEVELOPER`) se guardan por miembro y por proyecto
     (`project_member.responsibilities`, lista) y son **independientes** de los permisos técnicos Facilitador/Participante.
     Solo orientan qué vista se muestra primero. Las vistas son de solo lectura y visibles para todo el equipo
     (transparencia). Configurarlas es acción del Facilitador.
  2. **Archivos** (documentación y adjuntos de evidencia) se guardan como `bytea` en PostgreSQL: privados, con copia de
     seguridad junto con el resto de los datos y sin depender de un disco local efímero. Límites: 2 MB por documento
     (30 por proyecto) y 5 MB por adjunto. Lista cerrada de extensiones, comprobación de contenido (firma o UTF-8),
     descarga siempre como adjunto con tipo fijo y `nosniff`.
  3. **Contexto de IA a partir de documentos** solo con texto (`.md`, `.txt`), fragmentado por encabezado, «Página n» o
     «Fragmento n», y filtrado por pertinencia con la pregunta. Los PDF se conservan como referencia pero **no se lee
     su texto** (no hay dependencia de extracción). Las citas del modelo se validan contra los fragmentos realmente
     enviados; una cita que no coincide se descarta y la respuesta se marca como inferencia.
  4. **Solo el Facilitador sube, reemplaza o marca documentos**, porque su contenido puede enviarse al proveedor externo
     de IA. Cualquier miembro los consulta y descarga.
  5. **Sugerencias de IA** (`ai_suggestion`) son propuestas pendientes; únicamente `POST …/resolve` con `confirm: true`
     de una persona las aplica, dentro de una transacción, con el control de versión de cada artefacto. Aceptar un
     cambio del backlog dispara una reevaluación `GATE-STORY` **por reglas**, a nombre de quien aceptó. La IA no puede
     fijar estados de compuerta ni excepciones ni asignar personas (el esquema de salida rechaza campos extra).
  6. **Prompts v2** (la carpeta v1 se conserva para reproducir interacciones anteriores). El presupuesto de contexto
     sube de 2 500 a 3 500 tokens para admitir DoD, backlog, decisiones y fragmentos.
- **Alternativas consideradas**: disco local o almacenamiento de objetos (requiere infraestructura que el hosting
  elegido no garantiza); extraer texto de PDF (nueva dependencia y superficie de ataque); permitir que cualquier
  miembro suba documentos (amplía lo que se envía al proveedor); aplicar sugerencias automáticamente (contradice que la
  IA solo recomienda).
- **Consecuencias**: la base crece con los archivos (las copias `pg_dump` también); los PDF no alimentan a la IA;
  cambiar de proveedor de almacenamiento exigiría una migración de datos.
- **Requisitos relacionados**: FR-040 … FR-049 (ver spec.md, «Mejora 2026-11»).
