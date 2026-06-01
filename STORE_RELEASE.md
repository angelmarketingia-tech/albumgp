# 📱 GanaPlay Álbum — Guía de publicación en App Store + Play Store

Esta guía lleva la web app (Next.js) a binarios nativos iOS/Android usando
**Capacitor**, que envuelve la app desplegada en un WebView nativo. La app es
**server-rendered** (Prisma, SSO, Redis), por lo que **NO** se exporta estática:
el shell nativo carga la app en vivo desde tu URL de producción.

---

## 0. Prerrequisitos

| Necesitás | Para |
| --- | --- |
| App desplegada en HTTPS (ej. Vercel) en `https://album.ganaplay.com` | El WebView carga de ahí |
| Cuenta **Apple Developer** ($99/año) + Mac con Xcode | Build + firma iOS |
| Cuenta **Google Play Console** ($25 único) | Build + firma Android |
| Node 18+, `npm i` | Tooling Capacitor |

---

## 1. Desplegar la web app (bloqueante)

Antes de empaquetar, la web debe estar **en producción y funcional**, incluyendo
el **SSO real** (ver §"Bloqueantes" abajo). Verificá:

- [ ] `npm run build` pasa (ya verificado en CI).
- [ ] Variables de entorno de prod configuradas (`DATABASE_URL` **pooled**,
      `AUTH_SECRET`, `UPSTASH_*`, `WEBHOOK_*`). El boot falla si falta algo
      (ver `lib/env/validate.ts`).
- [ ] `https://album.ganaplay.com/manifest.webmanifest` responde 200.
- [ ] `https://album.ganaplay.com/icons/icon-512` devuelve un PNG 512×512.

---

## 2. Instalar Capacitor y agregar plataformas

```bash
npm install            # instala @capacitor/* (ya en devDependencies)
export CAP_SERVER_URL=https://album.ganaplay.com   # PowerShell: $env:CAP_SERVER_URL="..."
npm run cap:add:ios        # crea ios/  (solo en Mac)
npm run cap:add:android    # crea android/
npm run cap:sync           # aplica capacitor.config.ts a ambas
```

`capacitor.config.ts` ya define `appId = com.ganaplay.album`, nombre, colores de
marca y `server.url` desde `CAP_SERVER_URL`.

---

## 3. Iconos y splash nativos

Los iconos del WebView/PWA se generan solos (`/icons/*`). Para los iconos
**nativos** del launcher y splash screens, usá la herramienta oficial:

```bash
npx @capacitor/assets generate --iconBackgroundColor "#034419" --splashBackgroundColor "#034419"
```

Colocá un `assets/icon.png` (1024×1024, isotipo blanco sobre verde `#00783E`) y
`assets/splash.png` (2732×2732) antes de correrlo. **[PENDIENTE: arte final del
dueño]** — mientras tanto se puede derivar del isotipo en `public/brand/logo/`.

---

## 4. Build de release

**iOS** (`npm run cap:open:ios` → Xcode):
- [ ] Signing & Capabilities → tu Team.
- [ ] Bump `CFBundleShortVersionString` / build number.
- [ ] Product → Archive → Distribute App → App Store Connect.

**Android** (`npm run cap:open:android` → Android Studio):
- [ ] `Build → Generate Signed Bundle / APK → Android App Bundle (.aab)`.
- [ ] Firmá con tu keystore (guardalo seguro; lo necesitás para cada update).
- [ ] Subí el `.aab` a Play Console.

---

## 5. Metadata de tienda (preparar antes de enviar)

| Activo | Apple | Google |
| --- | --- | --- |
| Nombre | GanaPlay Álbum | GanaPlay Álbum |
| Descripción corta/larga | ✅ usar copy de marca | ✅ |
| Capturas (teléfono) | 6.7" + 5.5" | teléfono + tablet |
| Icono 1024×1024 | ✅ | ✅ (512×512) |
| **Privacy Policy URL** | `…/privacidad` ✅ | `…/privacidad` ✅ |
| **Terms URL** | `…/terminos` ✅ | `…/terminos` ✅ |
| Clasificación por edad | **17+/18+** (gambling) | cuestionario IARC → 18+ |
| Categoría | Entertainment | Entertainment |

> ⚠️ **Apps de juego/apuestas**: ambas tiendas tienen políticas específicas.
> Apple exige que apps de "real money gambling" las publique una entidad
> registrada y geo-restringidas; Google pide aplicación de licencia de gambling
> por país. Si la app es **promocional** (no se apuesta dinero dentro de la
> app), suele clasificar distinto — **confirmá con el equipo legal del dueño
> antes de enviar** (AGENTS.md §12).

---

## 6. Bloqueantes antes de un lanzamiento real

Estos NO son del empaquetado sino del producto, y son **lanzamiento-bloqueantes**:

1. **SSO real (OIDC) — CRÍTICO.** Hoy `lib/auth/identity.ts` lanza
   `auth_config_invalid` en producción a propósito (no hay proveedor OIDC). El
   login mock es solo dev. Sin el OIDC real de GanaPlay, **canjear no funciona en
   prod**. Implementar el `IdentityProvider` OIDC y cambiar `signIn("mock")` por
   el proveedor real en `app/auth/signin/page.tsx`. Ver AGENTS.md §6, §14.
2. **Textos legales de premios** `[CONFIRMAR_TEXTO_LEGAL]` (prisma/seed.ts).
3. **Revisión legal** de `/privacidad` y `/terminos` + datos del responsable.
4. **Tipografía/colores oficiales** (post-MVP, no bloqueante) — ver brand/README.

---

## 7. Checklist final de envío

- [ ] SSO real funcionando en prod (canje E2E probado con una cuenta real).
- [ ] DB con `DATABASE_URL` **pooled** (el boot lo valida).
- [ ] Privacy + Terms revisados por legal y publicados.
- [ ] Iconos/splash nativos con arte final.
- [ ] Clasificación de edad y políticas de gambling confirmadas por tienda.
- [ ] Probar el deep-link de entrada (código → `/sobre/<code>`) dentro del WebView.
- [ ] Probar el rebote SSO dentro del WebView (login → vuelve a `/canjear`).
