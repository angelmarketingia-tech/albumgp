# AGENTS.md — GanaPlay Álbum de Sobres

Documento de arranque para Claude Code. Define qué construimos, cómo, y qué reglas no se rompen. Lee este archivo completo antes de generar cualquier código.

---

## 1\. Qué es esto

Una **web app de canje de códigos** que entrega premios coleccionables ("cartas / fichas") mediante una mecánica de apertura de sobre animada. Es un producto de **activación / fidelización** para una plataforma de apuestas (GanaPlay, El Salvador 🇸🇻 y Guatemala 🇬🇹).

El usuario llega ya registrado desde la plataforma central, redirigido con un **código de un solo uso**. Pone el código, **abre el sobre y ve sus premios sin login**. Para **canjear** (que los premios se le acrediten de verdad) debe **iniciar sesión con su cuenta de la plataforma central (SSO)**.

### Prototipo de referencia

Existe un prototipo HTML de una sola página (`AlbumGanaPlay_v3_FINAL.html`) que representa **la visión visual e idea**, NO la arquitectura final. Úsalo solo como referencia de mecánica (tiers, rareza, reveal) y espíritu visual. **No copies su arquitectura** (todo-en-un-archivo, estado en memoria, sin backend). Eso se reemplaza por completo. **Tampoco copies su paleta:** los colores de marca reales están en la sección 2\.

---

## 2\. IDENTIDAD DE MARCA (OBLIGATORIO — leer antes de tocar UI)

Todo lo visual DEBE seguir la línea gráfica oficial de GanaPlay. No improvisar estilos.

### 2.1 Fuentes de verdad de la marca

- **`/brand/logo/`** — carpeta con TODAS las versiones del logo. El agente usa SIEMPRE estos archivos; nunca recrea, deforma ni recolorea el logo.  
- **`/brand/MANUAL_DE_MARCA.pdf`** — el **Manual de Marca**, autoridad final sobre colores, tipografía, usos y espaciado. **Si algo en este AGENTS.md contradice el Manual, manda el Manual.** Leerlo antes de construir componentes visuales.

### 2.2 Colores oficiales (extraídos del logo real)

El verde de marca es **oscuro y saturado** (NO el verde claro del prototipo). Fondo en gradiente radial sutil, como el logo.

\--gp-green-core   \#008745   /\* centro del gradiente, verde vivo \*/

\--gp-green        \#01783E   /\* verde de marca principal \*/

\--gp-green-deep   \#00602F   /\* sombra / variante oscura \*/

\--gp-white        \#FFFFFF   /\* texto del logo \*/

\--gp-gold         \#FFD600   /\* dorado de acento para premios destacados \*/

Fondo de referencia: `radial-gradient(circle at 50% 45%, #008745 0%, #01783E 70%, #00602F 100%)`

### 2.3 Tipografía

El logo usa una **sans-serif redondeada, geométrica y de peso fuerte** (estilo Poppins/Nunito), con tagline "Pronósticos deportivos". Usar esa familia para títulos/UI. Confirmar la fuente exacta en el Manual de Marca. No usar las condensadas del prototipo salvo que el Manual lo permita.

### 2.4 Reglas de uso del logo

Usar solo archivos de `/brand/logo/`. Nunca estirar, rotar, recolorear ni recrear con texto. Respetar área de protección y tamaño mínimo del Manual. Sobre verde → versión blanca.

---

## 3\. Flujo del usuario

1. Usuario se registra en la **plataforma central** (externa) → recibe un código → es **redirigido** a esta app.  
2. **Pantalla de entrada: input de código.** Sin login todavía.  
3. Pone el código → backend valida (existe \+ activo \+ no usado).  
4. Si es válido: se dispara la **animación del sobre** y se revelan las cartas (experiencia visual, aún sin canjear):  
   - **3 cartas premio GARANTIZADAS** (varían según el país del código).  
   - **2 cartas variables al azar** (pueden ser "No ganaste" u otros ítems).  
   - **Total: 5 cartas por sobre.** Las 3 garantizadas SIEMPRE salen.  
5. Para **canjear/reclamar** los premios → el usuario **inicia sesión vía SSO con la plataforma central**.  
6. Al canjear, el **código se marca como usado** (un código \= un canje). El canje es contra el código.  
7. Secciones de la app:  
   - **Abrir Sobre** (lo recién abierto / estado).  
   - **Mi Álbum** — ver las fichas/premios obtenidos (requiere sesión).  
   - **Depósitos** — botón que **redirige a la URL externa según el país** (ver sección 4).

### El país sale del código, no de la IP

Cada código nace en la BD marcado como `SV` o `GT`. El país determina premios, moneda, juego de giros y URL de depósitos. **Una sola app, una sola URL de entrada.** No detectar país por IP.

### Separación ABRIR vs CANJEAR (importante)

- **Abrir** \= experiencia visual, sin login, muestra qué tocó. No acredita nada.  
- **Canjear** \= tras SSO, acredita los premios y consume el código (un solo uso).  
- El código se marca `redeemed` **en el canje**, de forma atómica. Abrir no consume el código, pero el resultado del sobre debe quedar fijado a ese código (no re-aleatorizar en cada apertura).

---

## 4\. Premios y destinos por país

Estas 3 cartas SIEMPRE aparecen. Texto exacto legal/marketing: `[CONFIRMAR_TEXTO_LEGAL]`.

### El Salvador 🇸🇻 (USD)

1. **$10 USD** para pronosticar en eventos deportivos.  
2. **200 giros gratis** en casino — juego: **Clover Super Pot**.  
3. **Triplicamos tu primer depósito \+ giros gratis.**  
- URL de depósitos: `https://ganaplay.sv/landing/depositos`

### Guatemala 🇬🇹 (GTQ)

1. **Q100** para pronosticar en eventos deportivos.  
2. **200 giros gratis** en casino — juego: **Super Tiki Strike**.  
3. **Triplicamos tu primer depósito.**  
- URL de depósitos: `https://ganaplay.gt/landing/depositos`

### Cartas variables (2 por sobre)

- Pool configurable por país. Puede incluir cartas "No ganaste".  
- Composición y pesos del pool variable \= **configuración de datos**, NO hardcode. Cambiable sin redeploy.

---

## 5\. Modelo de códigos (núcleo del producto)

- **Los códigos los tenemos nosotros de antemano** (pre-generados en lote, ej. **5.000**) y el mismo set lo conoce la plataforma central. A medida que se usan, se descartan.  
- **Un solo uso.** Una vez canjeado, inutilizado para siempre.  
- Pueden tener **distinto valor / distintos ítems**. El diseño de datos lo soporta desde el día uno.

### Estados de un código

`active` → `redeemed` | `disabled` | `expired` (vencimiento: `[CONFIRMAR_SI_VENCEN]`).

### Reglas de canje

- Canje **atómico**: validar \+ marcar usado en una sola transacción a prueba de concurrencia.  
- Lock a nivel BD (`SELECT ... FOR UPDATE` o update condicional `WHERE status='active'` verificando filas afectadas). Nunca check-then-write en la app.  
- El canje requiere **sesión SSO activa** (ver sección 6).  
- Rate limiting por IP y por código contra fuerza bruta.  
- Códigos **largos y aleatorios** (no secuenciales, no adivinables).

---

## 6\. Autenticación (SSO con la plataforma central)

- El login para canjear se hace **con la cuenta de la plataforma central vía SSO** (OAuth2 / OIDC `[CONFIRMAR_PROVEEDOR_SSO]`). No se crean cuentas nuevas en esta app.  
- Abrir el sobre NO requiere sesión; canjear SÍ.  
- La sesión SSO identifica al usuario para "Mi Álbum" y para acreditar premios.  
- Tokens/secretos del SSO solo en el servidor; nunca en el bundle del cliente.  
- Tras canjear, ligar en auditoría: código ↔ cuenta de la plataforma ↔ premios entregados.

---

## 7\. Stack técnico

- **Framework:** Next.js (App Router) \+ TypeScript.  
- **UI:** React \+ Tailwind CSS. Animaciones con Framer Motion y/o CSS/SVG nativo.  
- **Base de datos:** PostgreSQL. **ORM:** Prisma (o Drizzle).  
- **Caché / rate limiting / locks:** Redis.  
- **Auth:** SSO/OIDC contra la plataforma central (Auth.js/NextAuth como capa si encaja).  
- **Hosting:** Vercel o contenedor con autoescalado; Postgres administrado (Supabase/Neon/RDS), Redis administrado (Upstash).  
- **Validación:** Zod en cada endpoint.

Cambios de stack ya decidido: el agente **propone y espera confirmación** antes de cambiarlos.

---

## 8\. Requisitos no negociables

### Alto tráfico

- Página de entrada estática/edge-cacheable y ligerísima.  
- Punto caliente \= endpoint de canje → rápido y a prueba de concurrencia.  
- Índice de BD en la columna de código (nunca scan).  
- Connection pooling en Postgres.  
- Assets por CDN, optimizados y precargados.  
- Animación fluida en móviles de gama media; nada de trabajo pesado en el cliente.

### Seguridad

- Validación de código y resolución de premios **en el servidor**. El cliente nunca decide premios ni validez.  
- Nunca exponer listado de códigos ni probabilidades sensibles al cliente.  
- Rate limiting estricto en canje. Headers de seguridad (CSP, HSTS). Sin secretos en el cliente.  
- Sanitizar/validar todo input. Logs sin datos sensibles.

### Optimización

- Objetivo Core Web Vitals (LCP rápido, sin layout shift en la animación). Lazy-load fuera del fold.

---

## 9\. Assets — condiciones de las carpetas

Los assets finales los sube el dueño. Reglas para que el agente los integre sin romper nada:

### `/brand/logo/`

- Versiones esperadas: principal (sobre verde, blanco), versión sobre fondo claro, isotipo/símbolo solo, y horizontal si existe. Formatos: **SVG** (preferido) y **PNG con transparencia** de respaldo.  
- Nombrado claro y estable, p. ej. `logo-principal.svg`, `logo-claro.svg`, `isotipo.svg`.

### `/public/assets/sobre/`

- **Frames del sobre** (la animación de apertura). Si vienen como secuencia de imágenes: nombrarlos en orden con cero a la izquierda (`frame_001.png … frame_0NN.png`), mismo tamaño, fondo transparente, exportados a 2× para retina. Indicar **FPS** objetivo de la secuencia.  
- Alternativas válidas: **Lottie (`.json`)**, **sprite sheet** o **video con alfa (WebM/HEVC)**. El dueño indica cuál usa; el agente respeta ese formato.  
- Un set de frames por país si el sobre cambia entre SV/GT (`/sobre/sv/`, `/sobre/gt/`).

### `/public/assets/cartas/`

- Un diseño por tipo de carta: las 3 garantizadas por país, las variables, y la de **"No ganaste"**.  
- Formato **SVG** preferido (escala perfecta) o **PNG 2×**. Proporción de carta única y consistente (definir ratio, p. ej. 2:3). Texto del premio editable: idealmente el monto/condición va como capa de texto sobre la plantilla, no quemado en la imagen, para poder cambiarlo sin re-exportar.  
- Nombrado por país y tipo: `sv-premio-10usd.svg`, `gt-premio-100gtq.svg`, `no-ganaste.svg`, etc.

### Reglas generales de assets

- Todo asset optimizado (SVGO para SVG, compresión para PNG) y servido por CDN.  
- Nada de arte AI genérico definitivo. Hasta tener finales, placeholders marcados como temporales.  
- Documentar en un `assets/README.md` qué es cada archivo y su formato.

---

## 10\. Estructura sugerida del repo

/app

  /(entry)        \# pantalla de input de código (única entrada)

  /album          \# Mi Álbum (requiere sesión SSO)

  /api

    /redeem       \# POST: canjear código (atómico, requiere SSO)

    /open         \# POST: validar y revelar sobre (sin SSO, no consume)

    /codes        \# admin: generación de lotes (protegido)

    /auth         \# callbacks SSO

/brand

  /logo           \# versiones del logo (las sube el dueño)

  MANUAL\_DE\_MARCA.pdf

/components       \# UI: sobre, carta, animaciones, toasts

/lib

  /db             \# cliente Prisma/Drizzle

  /redis          \# rate limit, locks

  /prizes         \# resolución de premios por país (server-only)

  /auth           \# SSO/OIDC

/prisma           \# schema \+ migraciones

/public/assets

  /sobre          \# frames/animación del sobre (por país)

  /cartas         \# diseños de cartas

  README.md

/scripts          \# generación de códigos en lote, seeds

---

## 11\. Esquema de datos (borrador)

codes

  id              uuid pk

  code            text unique  (indexado, largo, aleatorio)

  country         enum('SV','GT')

  prize\_set\_id    fk \-\> prize\_sets

  status          enum('active','redeemed','disabled','expired')

  pack\_result     jsonb null    \# cartas fijadas al abrir (no re-aleatorizar)

  opened\_at       timestamptz null

  redeemed\_at     timestamptz null

  redeemed\_by     text null      \# id de cuenta de la plataforma (SSO)

  redeemed\_ip     text null

  created\_at      timestamptz

prize\_sets

  id              uuid pk

  country         enum('SV','GT')

  guaranteed      jsonb   \# las 3 cartas garantizadas

  variable\_pool   jsonb   \# pool variable \+ pesos (2 por sobre)

  cards\_per\_pack  int     \# \= 5

redemptions       \# auditoría inmutable

  id              uuid pk

  code\_id         fk \-\> codes

  account\_id      text    \# cuenta SSO de la plataforma

  result          jsonb   \# snapshot de cartas entregadas

  created\_at      timestamptz

---

## 12\. Cumplimiento y límites (LEER)

- Avisos visibles: **"Solo mayores de 18 años"** y **"Juega responsablemente"**.  
- No ocultar probabilidades de forma engañosa ni presionar al gasto más allá de lo definido por el dueño.  
- Auditoría de cada canje (`redemptions`).  
- Regulación de juego SV/GT, verificación de edad y términos legales \= responsabilidad del dueño; el agente **señala** dónde se necesita revisión legal, no la asume.  
- Ante conflicto con seguridad o estos límites, **detenerse y consultar**.

---

## 13\. Cómo debe trabajar el agente (Claude Code)

- **Antes de UI:** leer el Manual de Marca y la sección 2\.  
- Orden: esquema BD → endpoint de canje atómico \+ SSO → pantalla de código → animación pulida.  
- TypeScript tipado; Zod en todo input.  
- Tests de canje: válido, usado, inexistente, doble canje concurrente, canje sin sesión.  
- Commits pequeños y descriptivos.  
- Ante `[CONFIRMAR_*]`, **preguntar** en vez de inventar. No meter dependencias pesadas sin justificar.

---

## 14\. Pendientes por confirmar

- `[CONFIRMAR_TEXTO_LEGAL]` — redacción exacta de cada carta premio (marketing \+ legal).  
- `[CONFIRMAR_SI_VENCEN]` — ¿los códigos tienen fecha de expiración?  
- `[CONFIRMAR_PROVEEDOR_SSO]` — proveedor/endpoints OIDC de la plataforma central.  
- Detalle del pool de cartas variables por país (qué ítems, qué pesos, cuántas "No ganaste").  
- Formato definitivo de los assets del sobre (frames vs Lottie vs video) y si difiere por país.  
- Tipografía oficial exacta y HEX definitivos (del Manual de Marca).

