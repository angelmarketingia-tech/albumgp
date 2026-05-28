# /brand — Identidad de marca GanaPlay

Esta carpeta es la **fuente de verdad** de la marca para este proyecto.
Aquí viven el Manual de Marca y los archivos originales del logo
entregados por el dueño.

> **El Manual de Marca (`MANUAL_DE_MARCA.pdf`) manda sobre cualquier otra
> fuente**, incluida la sección 2.2 de `AGENTS.md`. Si surge un conflicto
> entre lo documentado aquí, lo escrito en `AGENTS.md`, o lo definido en
> `tailwind.config.ts`, prevalece el Manual.

---

## Estructura

```
brand/
  MANUAL_DE_MARCA.pdf           # autoridad final de marca (2.9 MB, versionado en git)
  plantilla-fondo-historias.png # plantilla de fondo (recurso secundario)
  logo/
    logo-blanco.png             # logo blanco con transparencia
    logo-principal.jpg          # logo completo sobre verde con tagline
    logo-solo-isotipo.jpg       # lockup "GanaPlay" sobre verde
```

### Inventario detallado

| Archivo | Formato | Dimensiones | Tamaño | Uso recomendado |
| --- | --- | --- | --- | --- |
| `logo/logo-blanco.png` | PNG (alfa) | 853 x 170 | 17 KB | **Uso principal de la app.** Sobre fondo verde `bg-gp-radial`. Consumido por `<Logo />` por defecto. |
| `logo/logo-principal.jpg` | JPG | 1080 x 1080 | 85 KB | Logo completo con tagline "Pronósticos deportivos". Referencia tipográfica; no usar en UI por JPG sobre verde quemado. |
| `logo/logo-solo-isotipo.jpg` | JPG | 1080 x 1921 | 73 KB | Lockup "GanaPlay" sobre verde. Referencia de proporciones. |
| `plantilla-fondo-historias.png` | PNG | 1080 x 1920 | 3.2 MB | Plantilla para piezas formato stories. No se usa directamente en la web app. |
| `MANUAL_DE_MARCA.pdf` | PDF | -- | 2.9 MB | Autoridad final. Versión comprimida del Manual original (131 MB). |

---

## Paleta oficial (Manual de Marca — página "PALETA DE COLOR")

### Primarios

| Token Tailwind | HEX | RGB | CMYK | Uso |
| --- | --- | --- | --- | --- |
| `gp.green` | `#00783E` | 0, 120, 62 | 88, 27, 93, 14 | **Color de marca dominante.** Fondo principal, logo sobre claro. |
| `gp.white` | `#FFFFFF` | 255, 255, 255 | 0, 0, 0, 0 | Texto sobre verde, fondos claros, logo sobre oscuro. |

### Secundarios

| Token Tailwind | HEX | RGB | CMYK | Uso |
| --- | --- | --- | --- | --- |
| `gp.green-deep` | `#034419` | 3, 68, 20 | 100, 44, 100, 54 | Variante oscura del verde. Sombras del gradiente de marca. |
| `gp.gray-dark-1` | `#6D6E71` | 109, 110, 113 | 55, 44, 41, 27 | Texto secundario. |
| `gp.gray-dark-2` | `#333333` | 51, 51, 51 | 70, 60, 56, 68 | Cuerpos de texto sobre fondo claro. |
| `gp.gray-light` | `#A7A9AC` | 167, 169, 172 | 37, 28, 27, 6 | Separadores, bordes sutiles. |

> Los secundarios **nunca** pueden ser más prominentes que el verde
> principal (Manual, sección "COLORES SECUNDARIOS").

### Gradientes

- **Gradiente verde de marca** — utilidad Tailwind `bg-gp-radial`. El
  Manual lo define como "no lineal"; aproximamos con radial-gradient de
  `#00783E` a `#034419`.
- **Gradiente dorado libre** — utilidad Tailwind `bg-gp-gold-gradient`.
  Referencia del Manual; el HEX exacto no está estandarizado.

### `[CONFIRMAR_DORADO_OFICIAL]`

El token `gp.gold` (`#D4A017`) es **propuesta del líder**, no extraído
del Manual. El Manual define un "gradiente dorado libre" pero no un HEX
puntual para acentos sólidos. Uso permitido: acentos puntuales de
premios destacados / CTA secundarios. **Pendiente de aprobación del
dueño.** Si se rechaza, se elimina y los acentos usan el gradiente.

---

## Tipografía oficial (Manual de Marca — página "TIPOGRAFÍA")

| Familia oficial | Rol | Pesos |
| --- | --- | --- |
| **Stage Grotesk** | Principal — títulos (Bold) y cuerpo (Regular). Itálica solo para citas. | Bold + Regular |
| **Qartella** | Secundaria — display decorativa. | Regular + Bold |

Interlínea **1:1**, interletra **0**.

### `[CONFIRMAR_TIPOGRAFIA_OFICIAL]`

Stage Grotesk y Qartella son fuentes **comerciales** (no Google Fonts).
Hasta que el dueño provea archivos `.woff2` con licencia, usamos
**near-matches gratuitas** de Google Fonts vía `next/font/google` en
`app/layout.tsx`:

| Oficial | Near-match gratuita | Token Tailwind | CSS var |
| --- | --- | --- | --- |
| Stage Grotesk | **DM Sans** | `font-sans` | `--font-gp-sans` |
| Qartella | **Fraunces** | `font-display` | `--font-gp-display` |

El swap a las fuentes oficiales reemplaza únicamente las dos cargas en
`app/layout.tsx`. El resto del código (que consume `font-sans` /
`font-display` o las CSS vars) **no cambia**.

---

## Reglas duras del logo (Manual — "MANEJO DE LOGO" + "ESPACIO DE SEGURIDAD")

### Único color permitido

- Sobre fondo claro → **verde principal `#00783E`**.
- Sobre fondo verde / oscuro → **blanco `#FFFFFF`** (negativo).

### Prohibido (extracto del Manual, sección "DON'T")

- ❌ Itálica del wordmark.
- ❌ Recolor a verde claro / verde menta / negro / gris.
- ❌ Estirar, distorsionar, sesgar.
- ❌ Outline o stroke.
- ❌ Recortar el wordmark.

### Área de protección

Definida en el Manual como **la altura del trazo vertical de la "G" del
logotipo** (token "G"). Es el espacio libre mínimo alrededor del logo en
cualquier composición.

### Reglas de implementación

- **Nunca recrear el logo en código** (texto / SVG inline). Siempre vía
  `components/brand/Logo.tsx`, que apunta a `/public/brand/logo/*`.
- **Sobre fondo verde** → `variant="blanco"` (default).
- **Sobre fondo claro** → todavía no hay archivo dedicado de logo verde;
  pedirlo al dueño cuando se necesite (UI tiene mayormente fondo verde
  según el Manual, así que blanco cubre el 90% de casos).

---

## Slogan oficial (Manual — página "SLOGAN")

> **"Ganar es una pasión"**

Exportado en `lib/brand/constants.ts > GANAPLAY_SLOGAN`. Reemplaza al
"Pronósticos deportivos" del tagline del logotipo combinado (que sigue
existiendo dentro del archivo del logo).

---

## Dualidad `/brand/` vs `/public/brand/`

Next.js solo sirve archivos de `/public/` al cliente. Por eso operamos
con dos rutas:

- **`/brand/`** — fuente de verdad. Originales tal cual los entrega el
  dueño. **No se sirve** al cliente; existe para referencia y
  herramientas de diseño.
- **`/public/brand/logo/`** — copia derivada que `next/image` sirve. El
  componente `<Logo />` apunta aquí.

Si en algún momento se cambia un logo, hay que reemplazarlo en **ambas**
rutas (o regenerar `/public/brand/` desde `/brand/`).

---

## Pendientes de marca

- `[CONFIRMAR_DORADO_OFICIAL]` — el dorado `#D4A017` es propuesta nuestra
  (el Manual no estandariza un HEX dorado sólido).
- `[CONFIRMAR_TIPOGRAFIA_OFICIAL]` — DM Sans + Fraunces son near-matches
  gratuitas. Cuando llegue licencia de Stage Grotesk + Qartella, swap.
- `[CONFIRMAR_TEXTO_LEGAL]` — copy provisional de las 3 cartas garantizadas
  por país, sujeta a revisión legal del dueño.
