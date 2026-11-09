# Despliegue

Entornos separados: desarrollo local (Docker Compose solo para PostgreSQL; Vite con proxy) y
producción (contenedor único + PostgreSQL gestionado). Decisión de hosting y alternativas en
[research.md](../research.md) D-15; los precios y límites están **por verificar** antes de contratar.

```mermaid
flowchart TB
    subgraph DEV["Desarrollo local"]
        direction TB
        VITE["Vite dev server :5173<br/>proxy /api → :3000"]
        BEDEV["Backend Fastify :3000<br/>tsx watch"]
        PGDEV[("PostgreSQL en Docker :5432<br/>+ BD de pruebas aparte")]
        VITE --> BEDEV --> PGDEV
        ENVDEV[".env local (no versionado)<br/>LLM_PROVIDER=fake o clave de desarrollo"]
        ENVDEV -.-> BEDEV
    end

    subgraph CI["Integración continua (GitHub Actions)"]
        direction TB
        TESTS["lint · typecheck · Vitest unit/integración<br/>(servicio PostgreSQL) · Playwright e2e<br/>LLM_PROVIDER=fake"]
        BUILD["Construcción de imagen Docker"]
        TESTS --> BUILD
    end

    subgraph PROD["Producción (internet)"]
        direction TB
        USER["Navegadores"] -- "HTTPS (TLS en la plataforma)" --> WEB
        subgraph PLAT["Plataforma de hosting (p. ej. Render)"]
            WEB["Servicio web: contenedor único<br/>Fastify = API + estáticos de React<br/>arranque: prisma migrate deploy → servidor"]
            SEC["Secretos del panel:<br/>DATABASE_URL, SESSION_SECRET,<br/>LLM_API_KEY, LLM_*"]
            SEC -.-> WEB
        end
        subgraph DBH["Base de datos gestionada (p. ej. Neon)"]
            PGPROD[("PostgreSQL persistente<br/>conexión TLS")]
        end
        WEB -- "SQL sobre TLS" --> PGPROD
        WEB -- "HTTPS" --> LLMP["Groq (plan gratuito)"]
        BK["Copias: restauración del proveedor + pg_dump cifrado<br/>antes de sesiones y migraciones"] -.-> PGPROD
    end

    REPO["Repositorio GitHub (main)"] --> CI
    BUILD -- "despliegue automático desde main<br/>(tras CI verde)" --> WEB
```

Notas:

- CORS cerrado por defecto (mismo origen); `CORS_ALLOWED_ORIGINS` solo si se separa el frontend.
- `NODE_ENV=production` activa cookies `Secure`, `helmet` y logs JSON sin datos personales.
- Los datos de demostración y las cuentas de ejemplo solo se siembran en desarrollo.
