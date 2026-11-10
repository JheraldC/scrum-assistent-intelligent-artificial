# Despliegue

Guía para publicar el prototipo en internet con datos centralizados. Estado: **la imagen y esta guía
están escritas, pero el despliegue real (T147) y la prueba de restauración aún no se han ejecutado**;
cada resultado se anotará en la sección «Registro de despliegue» al hacerlo.

## Arquitectura de despliegue

- **Un contenedor** (ver [`Dockerfile`](../Dockerfile)) con la API Fastify y la interfaz compilada, mismo origen.
- **PostgreSQL gestionado** (cualquier proveedor con copias automáticas y TLS).
- **HTTPS** delante del contenedor (lo ofrece el hosting); la aplicación confía en `X-Forwarded-*` (`trustProxy`).
- El arranque del contenedor ejecuta `prisma migrate deploy` y luego el servidor.

> La imagen no se ha podido construir en el equipo de desarrollo (no tiene Docker). Primera comprobación
> pendiente: `docker build -t scrum-assistant .` y arrancarla contra una base vacía.

## Variables de entorno (secretos en el panel del hosting, nunca en el repositorio)

| Variable | Valor en producción |
|----------|---------------------|
| `NODE_ENV` | `production` (la imagen ya lo fija) |
| `DATABASE_URL` | Cadena de conexión del PostgreSQL gestionado, con `sslmode=require` si el proveedor lo exige |
| `SESSION_SECRET` | Aleatoria de ≥ 32 caracteres (`node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`) |
| `LLM_PROVIDER` | `openai-compatible` (`fake` hace fallar el arranque en producción) |
| `LLM_BASE_URL` | `https://api.groq.com/openai/v1` |
| `LLM_MODEL`, `LLM_API_KEY` | Modelo elegido en el piloto (T108) y clave de la cuenta de Groq |
| `AI_DAILY_TOKEN_BUDGET_GLOBAL` | Por debajo del cupo diario gratuito real de la cuenta (consultar la consola de Groq) |
| `AI_DAILY_TOKEN_BUDGET_PER_PROJECT`, `AI_USER_RATE_PER_MINUTE` | Ajustar tras el piloto |
| `CORS_ALLOWED_ORIGINS` | Vacío (mismo origen) |

Los precios y límites del hosting y del plan gratuito de Groq cambian con frecuencia: **verifíquelos en
sus páginas oficiales el día del despliegue** y anótelos en el registro (U-03, U-07). Los límites de uso
configurados en la aplicación son una barrera propia; los del proveedor mandan.

## Archivos y copias de seguridad

Los documentos del proyecto y los adjuntos de evidencia se guardan **dentro de PostgreSQL** (`bytea`; hasta 2 MB por
documento, 30 por proyecto, y 5 MB por adjunto). Por eso el `pg_dump` incluye los archivos y el tamaño de la base y de las
copias crece con ellos; revise la cuota de almacenamiento del PostgreSQL gestionado. Los archivos no son públicos: solo se
sirven a miembros autenticados del proyecto, como descarga. Las solicitudes `multipart/form-data` pasan por la misma
protección CSRF y los límites de tamaño de la aplicación (si usa un proxy, permita cuerpos de al menos 6 MB).

## Pasos

1. Crear la base PostgreSQL y un usuario con permisos sobre ella.
2. Construir y publicar la imagen (o conectar el repositorio al hosting con el `Dockerfile`).
3. Definir los secretos de la tabla anterior.
4. Arrancar el contenedor: aplica las migraciones y sirve en el puerto `PORT` (3000 por defecto).
5. Comprobar `GET https://<dominio>/api/v1/health` → `{"status":"ok"}` y que `http://` redirige a HTTPS.
6. Registrar una cuenta, crear un proyecto y recorrer los escenarios V1 y V5 de
   [`quickstart.md`](../specs/001-scrum-ai-agent-guide/quickstart.md) desde otro dispositivo.
7. No ejecutar `npm run db:seed` en producción (crea datos de ejemplo solo para desarrollo).

## Copias de seguridad y restauración

Copia (cifrada con una frase que no se guarda en el repositorio):

```bash
pg_dump --format=custom --no-owner "$DATABASE_URL" | gpg --symmetric --cipher-algo AES256 -o scrum-$(date +%F).dump.gpg
```

Prueba de restauración en una base **vacía distinta** (hacerla antes de dar por buena la copia):

```bash
gpg --decrypt scrum-AAAA-MM-DD.dump.gpg | pg_restore --no-owner --dbname "$RESTORE_DATABASE_URL"
psql "$RESTORE_DATABASE_URL" -c "SELECT count(*) FROM project;"
```

Los archivos `*.dump` están en `.gitignore`. Conserve las copias fuera del hosting y bórrelas al terminar el curso
si contienen cuentas reales.

## Actualizaciones

Nueva versión = nueva imagen. Las migraciones se aplican solas al arrancar; son aditivas. Antes de una migración
que borre o transforme datos, hacer una copia.

## Registro de despliegue

| Fecha | Qué se hizo | Resultado |
|-------|-------------|-----------|
| — | Construcción de la imagen | pendiente |
| — | Despliegue y `GET /health` por HTTPS | pendiente |
| — | Escenarios V1 y V5 en producción | pendiente |
| — | Prueba de restauración de `pg_dump` | pendiente |
