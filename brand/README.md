# /brand — Identidad de marca GanaPlay

Esta carpeta es la **fuente de verdad** de la marca para este proyecto.
Aquí viven el Manual de Marca y los archivos originales del logo entregados
por el dueño.

> **El Manual de Marca (`MANUAL_DE_MARCA.pdf`) manda sobre cualquier otra
> fuente**, incluida la sección 2.2 de `AGENTS.md`. Si surge un conflicto
> entre lo documentado aquí, lo escrito en `AGENTS.md`, o lo definido en
> `tailwind.config.ts`, prevalece el Manual.

---

## Estructura

```
brand/
  MANUAL_DE_MARCA.pdf           # autoridad final de marca (version comprimida 2.9 MB, versionado en git)
  plantilla-fondo-historias.png # plantilla de fondo (recurso secundario, formato stories)
  logo/
    logo-blanco.png             # logo blanco con transparencia (uso principal sobre fondo verde)
    logo-principal.jpg          # logo completo sobre verde con tagline "Pronosticos deportivos"
    logo-solo-isotipo.jpg       # solo lockup "GanaPlay" sobre verde
```

### Inventario detallado

| Archivo | Formato | Dimensiones | Tamano | Uso recomendado |
| --- | --- | --- | --- | --- |
| `logo/logo-blanco.png` | PNG (alfa) | 853 x 170 | 17 KB | **Uso principal de la app.** Sobre el fondo `bg-gp-radial` de GanaPlay. Es el archivo que consume el componente `<Logo />` por defecto. |
| `logo/logo-principal.jpg` | JPG | 1080 x 1080 | 85 KB | Logo completo con tagline "Pronosticos deportivos". Referencia tipografica y de marca; no usar en UI por ser JPG sobre verde quemado. |
| `logo/logo-solo-isotipo.jpg` | JPG | 1080 x 1921 | 73 KB | Variante del lockup "GanaPlay" sobre verde. Referencia de proporciones. |
| `plantilla-fondo-historias.png` | PNG | 1080 x 1920 | 3.2 MB | Plantilla oficial para piezas formato stories. Recurso secundario, no se usa directamente en la web app. |
| `MANUAL_DE_MARCA.pdf` | PDF | -- | 2.9 MB | Autoridad final de marca. Version comprimida del Manual original (131 MB). Versionada en git. |

---

## Dualidad `/brand/` vs `/public/brand/`

Next.js solo sirve archivos de `/public/` al cliente. Por eso operamos con
dos rutas:

- **`/brand/`** — fuente de verdad. Aquí viven los originales tal cual los
  entrega el dueno. Esta carpeta **no se sirve** al cliente; existe para
  referencia, auditoria y herramientas de diseno.
- **`/public/brand/logo/`** — copia derivada que `next/image` sirve a
  produccion. El componente `components/brand/Logo.tsx` apunta aquí.

Si en algun momento se cambia un logo, hay que reemplazarlo en **ambas**
rutas (o regenerar `/public/brand/` desde `/brand/`). En una iteracion
futura se puede automatizar con un script de build; por ahora la copia es
manual y la documentamos para que no se desincronice.

---

## Tokens de marca en codigo

- Paleta: `tailwind.config.ts` -> objeto `colors.gp` (`green-core`, `green`,
  `green-deep`, `white`, `gold`).
- Fondo radial de marca: utilidad Tailwind `bg-gp-radial`.
- Tipografia: Poppins via `next/font/google`, expuesta como variable CSS
  `--font-gp-sans` y aplicada en `app/layout.tsx`.

Todos los tokens actuales son **placeholders aproximados** hasta confirmar
los oficiales contra el Manual. Ver bloqueante abajo.

---

## Pendientes de marca

El Manual de Marca ya esta versionado en `brand/MANUAL_DE_MARCA.pdf`
(version comprimida de 2.9 MB, derivada del PDF original de 131 MB).
Sin embargo, los siguientes puntos siguen marcados como
**`[CONFIRMAR_*]`** en el codigo: el lider tiene que leer el PDF
comprimido (o recibir screenshots de las paginas clave) para cerrarlos.
**No bloquean Fase 4**: avanzamos con placeholders y refinamos despues.

- **`[CONFIRMAR_HEX_OFICIALES]`** — los HEX en `tailwind.config.ts`
  (`#008745`, `#01783E`, `#00602F`, `#FFFFFF`, `#FFD600`) son aproximaciones
  derivadas del logo, no extracciones del Manual.
- **`[CONFIRMAR_TIPOGRAFIA_OFICIAL]`** — usamos **Poppins** (Google Fonts)
  como mejor match visual del tagline "Pronosticos deportivos" del logo
  principal: sans serif redondeada, geometrica, peso fuerte. Cuando llegue
  el Manual con la familia exacta, se reemplaza la carga en
  `app/layout.tsx`.
- **`[CONFIRMAR_AREA_PROTECCION]`** — area de proteccion del logo y tamano
  minimo en px / cm. Hoy no esta definido y el componente `<Logo />` no
  lo aplica.
- **`[CONFIRMAR_REGLAS_DE_USO]`** — fondos permitidos, fondos prohibidos,
  variantes sobre fondo claro vs oscuro, prohibiciones explicitas (no
  estirar, no recolorear, etc.).

El agente lider revisa el PDF comprimido (o pide screenshots al dueno)
para cerrar estos puntos antes de pulir Fase 4 de UI, pero el desarrollo
puede arrancar con los placeholders actuales.

---

## Reglas duras

- **Nunca recrear el logo en codigo** (ni con texto, ni con SVG inline). Se
  consume siempre desde `/public/brand/logo/` via el componente `<Logo />`.
- **Nunca estirar, rotar, recolorear ni deformar** el logo. Si una variante
  no existe, se pide al dueno; no se inventa.
- **Sobre fondo verde** -> `logo-blanco.png`. **Sobre fondo claro** -> aun
  no tenemos un archivo dedicado; solicitar al dueno.
- Los HEX y la tipografia son **placeholders** hasta confirmar contra el
  Manual. No tomarlos como definitivos para decisiones de marca.
