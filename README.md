# AlbumGP — operación

README operativo. El detalle de producto vive en `AGENTS.md`.

## Requisitos

- Node.js 20+ (probado en 24.x)
- npm 10+
- Postgres accesible (Neon en prod; local: Docker o Neon dev branch)

## Instalación

```
npm install
```

Copia `.env.example` a `.env` y rellena los valores (al menos `DATABASE_URL` y `DIRECT_DATABASE_URL`).

## Dev server

```
npm run dev
```

## Type-check / lint / tests

```
npm run typecheck
npm run lint
npm run test
```

## Base de datos

Generar el cliente Prisma:

```
npm run db:generate
```

Crear/aplicar migración (requiere `DIRECT_DATABASE_URL` apuntando a un Postgres real):

```
npm run db:migrate -- --name init
```

Si no podés correr Postgres localmente, crear la migración sin aplicar:

```
npx prisma migrate dev --name init --create-only
```

Sembrar prize_sets (1 SV + 1 GT con placeholders):

```
npm run db:seed
```

## Import de códigos

Acepta CSV o JSON pre-generado por la central. Formatos en `scripts/import-parser.ts`.

```
npm run codes:import -- --file ./codigos.csv
npm run codes:import -- --file ./codigos.json
```

Idempotente: re-correr el mismo archivo inserta 0 filas.

## Postgres local con Docker (opcional)

```
docker run --name albumgp-pg -e POSTGRES_PASSWORD=albumgp -e POSTGRES_DB=albumgp -p 5432:5432 -d postgres:16
```

Luego en `.env`:

```
DATABASE_URL="postgresql://postgres:albumgp@localhost:5432/albumgp"
DIRECT_DATABASE_URL="postgresql://postgres:albumgp@localhost:5432/albumgp"
```

## Build de producción

```
npm run build
```

El build requiere las siguientes env vars seteadas (aunque sea con valores placeholder, porque Auth.js los lee en top-level al recolectar page data):

- `AUTH_SECRET` (obligatorio en `NODE_ENV=production` — generar con `openssl rand -hex 32`)
- `MOCK_AUTH_PASSWORD` (sólo dev — el provider mock se inhabilita en prod)
- `DATABASE_URL` y `DIRECT_DATABASE_URL`
- `WEBHOOK_CENTRAL_SECRET` (sólo si vas a usar webhook real; en dry-run no se valida)
- `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` (obligatorias en prod — el fallback in-memory tira en `NODE_ENV=production`)

Ver `.env.example` para la lista canónica.

## Deploy MVP (Vercel)

1. Crear proyecto en Vercel apuntando al repo.
2. Setear env vars del paso anterior en **Project Settings → Environment Variables**.
   - `AUTH_SECRET` real (`openssl rand -hex 32`).
   - `DATABASE_URL` apuntando a Neon (con pooler).
   - `DIRECT_DATABASE_URL` apuntando a Neon directo (para migraciones).
   - Upstash creds (URL + TOKEN del REST API).
   - `WEBHOOK_CENTRAL_URL` vacío hasta que la central tenga endpoint receptor (sender hace dry-run).
3. Antes del primer deploy, correr migración contra Neon: `npx prisma migrate deploy` (con `DIRECT_DATABASE_URL`).
4. Sembrar prize_sets una vez: `npm run db:seed`.
5. Cargar lote de códigos: `npm run codes:import -- --file <ruta>`.

### Checklist pre-launch

- [ ] `AUTH_SECRET` rotado, NO compartido entre staging y prod.
- [ ] `MOCK_AUTH_PASSWORD` **no** seteado en prod (el provider mock tira en prod por diseño).
- [ ] Headers de seguridad activos (verificar con `curl -I` al dominio prod: CSP, HSTS, X-Frame-Options).
- [ ] Migración aplicada y `prize_sets` SV+GT presentes.
- [ ] Códigos importados (al menos un lote de prueba).
- [ ] Test manual: ingresar código → ver pack → login → canjear → ver en álbum.
- [ ] Rate-limit verificado (intentar 11+ requests a `/api/open` desde la misma IP → 429).
- [ ] Avisos legales 18+ y "Juega responsablemente" visibles en todas las páginas principales.
- [ ] Pendientes post-MVP documentados en `brand/README.md` (HEX dorado oficial, tipografías licenciadas, copy legal definitivo).
