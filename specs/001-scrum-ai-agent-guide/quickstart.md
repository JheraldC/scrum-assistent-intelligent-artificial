# Quickstart: instalación, ejecución y validación

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

> **Estado**: esta guía describe cómo se instalará, ejecutará y validará el producto **una vez
> implementado**. Hoy el repositorio solo contiene la especificación y el diseño; los comandos
> `npm run ...` y los archivos de configuración aún no existen. Los nombres de scripts son el
> objetivo de diseño y se confirman al implementar (`/speckit-tasks`). El README del repositorio
> (Principio VIII) debe reproducir esta guía con los comandos reales.

## 1. Requisitos previos

- Node.js LTS (≥ 22) y npm.
- Docker (para PostgreSQL local y de pruebas).
- Git.
- Una cuenta gratuita de Groq y su clave de API (solo para pruebas manuales con IA real; las
  pruebas automáticas usan IA simulada y no la necesitan). Consulte en su consola los límites reales
  de la cuenta (U-02).

## 2. Instalación

```bash
git clone https://github.com/JheraldC/scrum-assistent-intelligent-artificial.git
cd scrum-assistent-intelligent-artificial
npm install
cp .env.example .env
```

Edite `.env` (nunca se versiona). Variables principales (ver [plan.md](plan.md#agente-inteligente)):

| Variable | Desarrollo | Descripción |
|----------|-----------|-------------|
| `DATABASE_URL` | `postgresql://…@localhost:5432/scrum_dev` | Base de desarrollo |
| `TEST_DATABASE_URL` | `postgresql://…@localhost:5433/scrum_test` | Base independiente para pruebas |
| `SESSION_SECRET` | cadena aleatoria larga | Firma/derivación de sesión |
| `LLM_PROVIDER` | `fake` (por defecto en desarrollo) u `openai-compatible` (Groq) | `fake` está prohibido en producción |
| `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL` | vacío con `fake`; con Groq: modelo del piloto, su clave y su endpoint compatible | Proveedor real (opcional en desarrollo) |
| `LLM_TIMEOUT_MS`, `LLM_MAX_OUTPUT_TOKENS`, `LLM_TEMPERATURE` | valores por defecto | Configuración registrada en cada interacción |
| `AI_USER_RATE_PER_MINUTE`, `AI_DAILY_TOKEN_BUDGET_GLOBAL`, `AI_DAILY_TOKEN_BUDGET_PER_PROJECT` | valores por defecto | Límites de consumo; el global debe quedar por debajo del cupo diario gratuito de la cuenta de Groq |

## 3. Base de datos y arranque en desarrollo

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

- `db:seed` crea solo el **proyecto de ejemplo** (`is_sample`) y cuentas de demostración (solo en desarrollo).
- Interfaz: `http://localhost:5173` (Vite con proxy a `/api`); API: `http://localhost:3000/api/v1`.
- Comprobación: `GET http://localhost:3000/api/v1/health` responde `{"status":"ok"}`.

## 4. Pruebas

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
```

- Las pruebas de integración usan PostgreSQL real (`TEST_DATABASE_URL`) y `LLM_PROVIDER=fake`.
- Playwright levanta el servidor con IA simulada. Los datos simulados **no** son evidencia experimental.
- Prueba opcional con el proveedor real (sin CI): `LLM_LIVE_TESTS=1 npm run test:integration -- llm-live`.

## 5. Escenarios de validación (aceptación manual guiada)

Cada escenario indica el criterio de éxito de la spec que comprueba. Con la IA simulada o real.

| # | Escenario | Resultado esperado | SC |
|---|-----------|--------------------|----|
| V1 | Registrarse, crear un proyecto y recorrer historias → Sprint Goal → evaluación → corrección → seguimiento → review → retrospectiva, sin ayuda técnica | El recorrido se completa en una sesión; las cuatro etapas llegan a *Validada* | SC-001 |
| V2 | Evaluar historias, un Sprint Goal y una retrospectiva con defectos conocidos (casos del catálogo) | Cada incumplimiento definido se marca *No cumplido* con explicación y recomendación | SC-002 |
| V3 | Intentar iniciar el seguimiento con la planificación sin aprobar; luego corregir y reevaluar | Primero se rechaza; tras corregir se habilita; hay un intento por evaluación | SC-003 |
| V4 | Cerrar sesión, volver a entrar desde otro dispositivo y revisar los datos | Proyectos, artefactos, evaluaciones e interacciones siguen disponibles | SC-004 |
| V5 | Con dos cuentas, intentar abrir el proyecto de la otra o ejecutar acciones de Facilitador siendo Participante | 404 / 403; no se muestra ningún dato ajeno | SC-005 |
| V6 | Exportar JSON y cada CSV; comparar con la pantalla *Historial* y buscar los correos de las cuentas | Los datos coinciden; no aparece ningún correo; vacíos sin rellenar | SC-006, SC-007 |
| V7 | Consultar el historial de interacciones del asistente | Cada una muestra modelo, versión de prompt y estado | SC-008 |
| V8 | Detener o invalidar el proveedor de IA (clave errónea, guion de fallo del fake) y agotar el presupuesto diario (valor bajo en `.env`), y evaluar una compuerta | La compuerta se evalúa con reglas; la interfaz avisa que la IA no está disponible o que se agotó el cupo, con la hora de restablecimiento | SC-009 |
| V9 | Recorrer las pantallas con ancho de 375 px | Sin desplazamiento horizontal; todo utilizable | SC-010 |
| V10 | Seguir esta guía desde cero en otra máquina | El producto y sus pruebas se ejecutan solo con la documentación | SC-011 |

## 6. Construcción de producción y despliegue (resumen)

1. `docker build` crea la imagen (frontend compilado + backend).
2. Variables en el panel del proveedor: `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV=production`,
   `LLM_*`, límites de IA. **No** definir `LLM_PROVIDER=fake`.
3. Antes de cada despliegue con migraciones: copia de seguridad con `pg_dump` cifrada.
4. El servicio ejecuta `prisma migrate deploy` y luego arranca el servidor.
5. Verificar `GET /api/v1/health` y repetir los escenarios V1 y V5 en producción.

Detalle y justificación del hosting: [research.md](research.md) D-15/D-16 (precios por verificar).

## 7. Copia de seguridad y restauración (prueba mínima)

```bash
pg_dump --format=custom --file=backup.dump "$DATABASE_URL"
createdb scrum_restore_test
pg_restore --dbname=scrum_restore_test backup.dump
```

Guardar el volcado cifrado fuera del repositorio (contiene correos) y eliminarlo al cerrar el
experimento. Registrar la fecha de la prueba de restauración.

## 8. Referencias

- Contratos: [contracts/openapi.yaml](contracts/openapi.yaml), [contracts/export-format.md](contracts/export-format.md), [contracts/ai-response.schema.json](contracts/ai-response.schema.json).
- Modelo de datos: [data-model.md](data-model.md). Criterios: [rules-catalog.md](rules-catalog.md).
- Diagramas: carpeta [diagrams/](diagrams/).
