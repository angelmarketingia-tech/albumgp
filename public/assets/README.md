# /public/assets — Recursos del producto

Contenido publico que Next.js sirve directamente como estaticos al cliente.
Esta carpeta es la **frontera derecha** entre los originales de marca (en
`/brand/`) y lo que el navegador descarga.

## Estructura

```
public/assets/
  sobre/         # frames / animacion del sobre por pais (vacio en Fase 0)
  cartas/        # disenos de cartas premio por pais (vacio en Fase 0)
  referencias/   # imagenes de referencia visual (no son assets finales)
```

### `/sobre/`

Frames de la animacion de apertura del sobre. **Vacia en Fase 0.**

Cuando lleguen los assets del dueno, seguir la convencion de
`AGENTS.md` seccion 9:

- Secuencia de imagenes: `frame_001.png ... frame_0NN.png`, mismo tamano,
  fondo transparente, exportados a 2x para retina. Documentar FPS objetivo.
- Alternativas validas: Lottie (`.json`), sprite sheet o video con alfa
  (WebM / HEVC). El formato lo elige el dueno; el agente respeta.
- Si el sobre cambia entre paises, separar en `/sobre/sv/` y `/sobre/gt/`.

### `/cartas/`

Plantillas de las cartas premio. **Vacia en Fase 0.**

Convencion al integrar:

- Un diseno por carta: las 3 garantizadas por pais, las variables, y
  "No ganaste".
- Formato preferido **SVG** (escala perfecta) o **PNG 2x**.
- Texto del monto/condicion idealmente como capa de texto sobre la
  plantilla, no quemado en la imagen.
- Nombrado por pais y tipo, p. ej.: `sv-premio-10usd.svg`,
  `gt-premio-100gtq.svg`, `no-ganaste.svg`.

### `/referencias/`

Material **no productivo**. Imagenes que orientan la direccion visual pero
no se renderizan al usuario final.

| Archivo | Origen | Uso |
| --- | --- | --- |
| `sobre-direccion-visual.png` | Render entregado por el dueno (1024 x 1536, ~2.4 MB) | Referencia de la estetica del sobre: trading card premium, pajaro / aguila verde con balon, texto "GanaPlay ALBUM OFICIAL 2026", tres iconos al pie ("Cada jugada suma", "Tu pasion te lleva", "Tu coleccion tu historia"), verdes saturados con acentos naranjas dinamicos. **Es referencia de direccion, no el asset final del producto.** |

> Esta carpeta no se debe usar como fuente de assets finales. Si una pieza
> de `/referencias/` empieza a usarse en la UI productiva, hay que pedir al
> dueno el asset oficial y moverlo a la carpeta que corresponda
> (`/sobre/`, `/cartas/`, o `/public/brand/`).
