# Registro de decisiones técnicas (ADR)

Cada decisión técnica nueva tomada durante la implementación (Principio I de la Constitución) se
registra aquí como `NNNN-titulo-corto.md` con esta plantilla.

```markdown
# NNNN. Título

- **Fecha**: AAAA-MM-DD
- **Estado**: propuesta | aceptada | reemplazada por NNNN
- **Contexto**: qué problema o limitación motivó la decisión.
- **Decisión**: qué se decidió.
- **Alternativas consideradas**: qué otras opciones se evaluaron y por qué se descartaron.
- **Consecuencias**: efectos positivos, negativos y riesgos.
- **Requisitos relacionados**: FR-xxx, SC-xxx.
```

Las decisiones de diseño previas a la implementación están en
`specs/001-scrum-ai-agent-guide/research.md`.

## Decisiones tomadas durante la implementación

- **0002 – Equipo, documentación y sugerencias de IA**: ver [0002](0002-equipo-documentacion-y-sugerencias-de-ia.md).

- **0001 – Versiones fijas**: Prisma 7.10.1 (la etiqueta `latest` de npm apunta a una versión
  candidata 8.0.0-rc, que no se usa en el prototipo) con el adaptador `@prisma/adapter-pg`; ESLint 9
  (`eslint-plugin-jsx-a11y` aún no declara compatibilidad con ESLint 10).
