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
