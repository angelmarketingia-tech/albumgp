# 📱 GanaPlay Álbum — Guía de publicación (Play Store + App Store)

App web Next.js envuelta con **Capacitor** en un WebView nativo. La app es
**server-rendered** (no se exporta estática): el shell nativo carga la web en
vivo desde **`https://album2026.ganaplay.lat`**.

---

## ✅ Lo que YA está hecho (en este repo)

- **Capacitor instalado** (`@capacitor/core`, `cli`, `android`, `ios` + plugins
  `app`, `splash-screen`, `status-bar`).
- **Proyecto Android nativo generado** en `android/` con:
  - `applicationId = com.ganaplay.album`, `versionCode 1`, `versionName 1.0`
  - nombre "GanaPlay Álbum"
  - `server.url = https://album2026.ganaplay.lat` ya inyectado
  - `allowNavigation` para `ganaplay.lat / .sv / .gt` (el login SSO no expulsa
    al usuario del WebView a mitad de canje)
- **Iconos + splash nativos** generados (74 assets, light + dark, todas las
  densidades) desde `assets/icon-only.png` y `assets/splash.png` (placeholder de
  marca: "GP" blanco sobre verde — reemplazables por arte final).
- **PWA completa** (manifest, theme-color, apple-touch-icon, iconos maskable).
- `capacitor.config.ts` con el dominio prod y el SplashScreen configurado.

## ⏳ Lo que falta (requiere TU acción — no se puede automatizar)

1. **Desplegar la web** en `https://album2026.ganaplay.lat` (HTTPS). Sin esto la
   app nativa muestra el shell de espera.
2. **Cuenta Google Play Console** (US$25, pago único) — ver §A.
3. **Generar tu keystore** y firmar el `.aab` — ver §C. (Debe hacerlo el dueño:
   quien tiene el keystore controla las actualizaciones futuras de la app.)
4. **Android Studio** instalado en alguna máquina para el build final — ver §B.
5. iOS: requiere una **Mac con Xcode** + **Apple Developer** (US$99/año). Apple
   no permite compilar iOS en Windows. Queda para después (ver §E).

---

## §A. Crear la cuenta de Google Play Console

1. Andá a <https://play.google.com/console/signup>.
2. Iniciá sesión con la cuenta Google de la empresa (no personal).
3. Elegí **"Organización"** (no "Personal") — pide datos de la empresa GanaPlay.
4. Pagá la cuota única de **US$25**.
5. Google verifica identidad (puede tardar 1–2 días; para cuentas de
   organización piden DUNS / documentación de la empresa).
6. Una vez aprobada: **Crear app** → nombre "GanaPlay Álbum", idioma español,
   tipo "App", gratis.

> ⚠️ **App de juego/apuestas**: en el formulario de Play, declará la categoría y
> completá el **cuestionario de contenido de apuestas reales**. Google exige
> aplicar a una licencia de gambling por país y geo-restringir. Si la app es
> **promocional** (no se apuesta dinero DENTRO de la app, solo se canjean
> códigos y se redirige a GanaPlay), suele clasificar distinto — **confirmalo
> con el equipo legal antes de enviar** (ver `AGENTS.md §12`).

---

## §B. Instalar Android Studio (la máquina de build)

Puede ser esta PC u otra Windows/Mac/Linux.

1. Descargá <https://developer.android.com/studio> e instalá.
2. En el primer arranque, el asistente instala el **Android SDK** (platform-tools,
   build-tools, platform Android 34). Aceptá las licencias.
3. Abrí el proyecto: **File → Open →** la carpeta `android/` de este repo.
4. Esperá el "Gradle sync" (descarga dependencias la primera vez).

> El proyecto ya está configurado y validado: el Gradle wrapper resuelve y
> `build.gradle` parsea correctamente. Solo necesita el SDK (que Android Studio
> instala) para compilar.

---

## §C. Generar el keystore (una sola vez, GUARDALO)

El `.aab` debe ir firmado. El keystore es tu identidad de publicación: **si lo
perdés, no podés volver a actualizar la app**. Guardalo en un lugar seguro (no
en el repo).

```bash
# Con el JDK (ya instalado en esta PC: Temurin 17), corré:
keytool -genkey -v -keystore ganaplay-album.keystore \
  -alias ganaplay-album -keyalg RSA -keysize 2048 -validity 10000
# Te pide una contraseña (anotala) y algunos datos (nombre, organización, país=SV/GT).
```

Guardá `ganaplay-album.keystore` + la contraseña fuera del repo (gestor de
secretos / caja fuerte del dueño).

---

## §D. Generar el `.aab` para subir a Play

### Opción 1 — Android Studio (recomendada, visual)

1. **Build → Generate Signed Bundle / APK → Android App Bundle**.
2. Seleccioná tu `ganaplay-album.keystore`, alias y contraseña.
3. Variant **release**. Genera `android/app/release/app-release.aab`.

### Opción 2 — Línea de comandos (si el SDK está configurado)

```bash
# Configurá las variables (ajustá rutas):
export JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.19.10-hotspot"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
# Firma vía gradle.properties o -P flags. Luego:
cd android
./gradlew.bat bundleRelease
# Salida: android/app/build/outputs/bundle/release/app-release.aab
```

Para firmar por CLI, agregá a `android/app/build.gradle` un bloque
`signingConfigs` que lea las credenciales de variables de entorno (NO hardcodear
la contraseña). Android Studio (Opción 1) lo hace sin tocar archivos.

### Subir a Play

1. Play Console → tu app → **Producción → Crear nueva versión**.
2. Subí el `.aab`. Completá notas de la versión.
3. Play genera las claves de firma de la app (App Signing) y distribuye.

---

## §E. iOS (cuando tengas Mac + Apple Developer)

1. Cuenta **Apple Developer** (<https://developer.apple.com>, US$99/año).
2. En una **Mac**: `npm install && npx cap add ios && npx cap sync ios`.
3. Generá iconos iOS: `npx capacitor-assets generate --ios`.
4. `npx cap open ios` → Xcode → Signing & Capabilities con tu Team → **Product →
   Archive → Distribute App → App Store Connect**.
5. Mismas consideraciones de gambling/edad que Android.

---

## §F. Metadata de tienda (preparar antes de enviar)

| Activo | Play (Android) | App Store (iOS) |
| --- | --- | --- |
| Nombre | GanaPlay Álbum | GanaPlay Álbum |
| Descripción corta / larga | ✅ (usar copy de marca) | ✅ |
| Capturas | teléfono + tablet 7"/10" | 6.7" + 5.5" |
| Ícono | 512×512 (lo genera el build) | 1024×1024 (`assets/icon-only.png`) |
| **Privacy Policy URL** | `…/privacidad` ✅ ya existe | `…/privacidad` ✅ |
| **Terms URL** | `…/terminos` ✅ ya existe | `…/terminos` ✅ |
| Clasificación de edad | cuestionario IARC → 18+ | 17+/18+ (gambling) |
| Categoría | Entretenimiento | Entretenimiento |

Para las **capturas**, abrí `https://album2026.ganaplay.lat` en Chrome (F12 →
modo iPhone/Android) y capturá: entrada de código, sobre cerrado, reveal, álbum.

---

## §G. Checklist final antes de enviar

- [ ] Web desplegada y funcional en `https://album2026.ganaplay.lat` (HTTPS).
- [ ] Env de prod: `DATABASE_URL` **pooled**, `AUTH_SECRET`, `UPSTASH_*`,
      `NEXT_PUBLIC_SITE_URL=https://album2026.ganaplay.lat` (el boot valida).
- [ ] Probado el flujo completo en el dominio real: código → sobre → canjear →
      rebote a `ganaplay.sv|gt/iniciar-sesion`.
- [ ] Probado DENTRO del WebView (instalá el `.aab` por "internal testing" de
      Play y verificá que el login de GanaPlay abre bien).
- [ ] Privacidad + Términos revisados por legal (hoy son plantillas — ver los
      `[CONFIRMAR_*]` en `app/privacidad/page.tsx` y `app/terminos/page.tsx`).
- [ ] Textos legales de premios revisados (`[CONFIRMAR_TEXTO_LEGAL]` en
      `prisma/seed.ts`).
- [ ] Keystore generado y guardado de forma segura.
- [ ] Clasificación de edad y políticas de gambling confirmadas con la tienda.
- [ ] (Opcional) Iconos/splash de arte final reemplazando los placeholders en
      `assets/` + `npx capacitor-assets generate --android`.

---

## Comandos útiles (ya en package.json)

```bash
npm run cap:sync          # aplica capacitor.config + plugins al proyecto nativo
npm run cap:open:android  # abre Android Studio
npm run cap:add:ios       # (en Mac) genera el proyecto iOS
```

Tras cualquier cambio en `capacitor.config.ts` o en la web, corré
`npm run cap:sync` antes de recompilar.
