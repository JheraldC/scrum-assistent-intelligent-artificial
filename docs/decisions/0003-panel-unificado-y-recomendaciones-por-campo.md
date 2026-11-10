# 0003. Panel unificado de evaluaciones y recomendaciones por campo

- **Fecha**: 2026-11-10
- **Estado**: aceptada
- **Contexto**: la evaluación por reglas y la recomendación de IA se mostraban bajo el formulario, duplicando resultados
  extensos, y la IA respondía en texto libre que la persona debía interpretar. Se pidió un solo lugar de conversación,
  recomendaciones por campo y aplicación explícita con control de versión.
- **Decisión**:
  1. La conversación del panel vive en el estado del proyecto (`AssistantProvider`): las pantallas le envían evaluaciones y
     solicitudes; solo la evaluación y la recomendación más recientes se muestran completas.
  2. **Evaluar** sigue siendo determinista y no llama a la IA. **Pedir recomendación de IA** llama a `POST …/agent/recommend`
     con el artefacto (no con un prompt escrito por la persona).
  3. La IA responde con un esquema estricto por campo (`CHANGE` / `NO_CHANGE` / `UNSURE`); el servidor completa los campos
     omitidos como `NO_RESPONSE`, descarta campos desconocidos, convierte un `CHANGE` sin valor en `UNSURE` y uno idéntico al actual en
     `NO_CHANGE`, y **calcula** la base (reglas / documento / inferencia) contra los datos reales en lugar de confiar en el modelo.
  4. Aplicar una propuesta reutiliza los servicios de edición existentes dentro de una transacción (`joinTransaction`), de modo
     que rigen las mismas validaciones y el mismo control de versión; después se reevalúa con las reglas.
  5. Los artefactos sin campos editables (seguimiento) reciben solo análisis asesor, rotulado como tal.
  6. `ensureRetro`/`ensureReview` usan `INSERT … ON CONFLICT DO NOTHING`: el `upsert` de Prisma no era atómico y dos solicitudes
     simultáneas producían un 500.
  7. Las pruebas e2e usan puertos propios (5273/3100) y no reutilizan un servidor abierto: una corrida anterior había
     alcanzado el servidor de desarrollo (IA real y base de desarrollo).
- **Alternativas consideradas**: dejar el resultado bajo el formulario y solo copiar al panel (duplica); pedir a la IA un
  parche genérico del artefacto (difícil de validar y de aplicar con versiones); confiar en la base que declara el modelo.
- **Consecuencias**: cada «Pedir recomendación» consume presupuesto de IA; las propuestas viven en `ai_suggestion` hasta que una
  persona las resuelve; el esquema de campos editables es un registro explícito que hay que ampliar al añadir artefactos.
- **Requisitos relacionados**: FR-050 … FR-055.
