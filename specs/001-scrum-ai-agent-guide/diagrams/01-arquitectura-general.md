# Arquitectura general

Vista de alto nivel: un navegador, un servicio (API + estáticos), una base de datos y un proveedor de
IA externo (Groq). Decisiones en [research.md](../research.md) (D-02, D-09, D-15).

```mermaid
flowchart LR
    U["Participante / Facilitador<br/>(navegador, escritorio o móvil)"]
    subgraph Host["Contenedor único en la plataforma de hosting (HTTPS)"]
        direction TB
        S["Servidor web Fastify<br/>sirve el frontend compilado (React)"]
        API["API REST /api/v1<br/>módulos de dominio"]
        S --- API
    end
    DB[("PostgreSQL gestionado<br/>datos persistentes")]
    LLM["Groq (API compatible con OpenAI)<br/>plan gratuito, cupo diario compartido"]

    U -- "HTTPS: páginas y /api<br/>cookie de sesión + CSRF" --> S
    API -- "SQL (Prisma)<br/>transacciones" --> DB
    API -- "HTTPS, tiempo límite 20 s<br/>solo texto estructurado" --> LLM
```

**Lectura**: el navegador solo habla con un origen. La IA nunca se invoca desde el navegador (la clave
vive solo en el servidor) y nunca escribe en la base de datos: sus respuestas se validan, se guardan
como interacción y se muestran como recomendaciones.
