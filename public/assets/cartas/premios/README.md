# Imágenes promocionales de las cartas garantizadas

Guardá acá las imágenes de las **3 cartas garantizadas por país** (free bet,
giros, depósito). Si una imagen existe, la carta la muestra a pantalla completa;
si falta, la carta cae al diseño genérico (no rompe nada).

## Nombres EXACTOS que espera el código

### 🇸🇻 El Salvador
| Carta | Archivo |
|---|---|
| Free bet $10 en apuestas | `sv-freebet-10.png` |
| 200 giros gratis | `sv-giros-200.png` |
| 3× tu primer depósito | `sv-deposito-3x.png` |

### 🇬🇹 Guatemala
| Carta | Archivo |
|---|---|
| Free bet Q100 en apuestas | `gt-freebet-100.png` |
| 200 giros gratis | `gt-giros-200.png` |
| 3× tu primer depósito | `gt-deposito-3x.png` |

## Recomendaciones de la imagen

- **Formato:** `.webp` (ideal) o `.png`/`.jpg`. Si usás otro formato, cambiá la
  extensión en `lib/open/simulate-open.ts` y `prisma/seed.ts`.
- **Proporción:** vertical, tipo carta (~2:3). La carta recorta con `object-cover`,
  así que centrá lo importante.
- **Tamaño sugerido:** ~600×900 px. Pesá la imagen (comprimila) para que cargue rápido.
- El nombre debe coincidir **exactamente** (minúsculas, guiones).

Tras guardar las imágenes: `git add`, commit y `vercel --prod` para verlas en vivo.
