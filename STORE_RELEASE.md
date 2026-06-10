# 📱 GanaPlay Álbum — Guía de publicación (Play Store + App Store)

App web Next.js envuelta con **Capacitor** en un WebView nativo. La app es
**server-rendered** (no se exporta estática): el shell nativo carga la web en
vivo desde **`https://albumgp.vercel.app`**.

> ⚠️ **Dominio temporal**: la app apunta a `albumgp.vercel.app` (el dominio que
> hoy resuelve y sirve la web). El dominio propio `album2026.ganaplay.lat` tiene
> el **DNS sin configurar** (no resuelve). Cuando lo configures en Vercel y
> resuelva por HTTPS, cambiá `PROD_URL` en `capacitor.config.ts`, corré
> `npm run cap:sync` y re-compilá el `.aab`.

---

## ✅ Lo que YA está hecho (en este repo)

- **Capacitor instalado** (`@capacitor/core`, `cli`, `android`, `ios` + plugins
  `app`, `splash-screen`, `status-bar`).
- **Proyecto Android nativo generado** en `android/` con:
  - `applicationId = com.ganaplay.album`, `versionCode 1`, `versionName 1.0`
  - nombre "GanaPlay Álbum"
  - `server.url = https://albumgp.vercel.app` ya inyectado
  - `allowNavigation` para `ganaplay.lat / .sv / .gt` (el login SSO no expulsa
    al usuario del WebView a mitad de canje)
- **Iconos + splash nativos** generados (74 assets, light + dark, todas las
  densidades) desde `assets/icon-only.png` y `assets/splash.png` (placeholder de
  marca: "GP" blanco sobre verde — reemplazables por arte final).
- **PWA completa** (manifest, theme-color, apple-touch-icon, iconos maskable).
- `capacitor.config.ts` con el dominio prod y el SplashScreen configurado.
- **Toolchain Android instalado en esta PC**: JDK 17 + Android SDK (platform-34,
  build-tools 34.0.0, platform-tools) + `local.properties`.
- **`.aab` de release COMPILA** ✅ — `./gradlew bundleRelease` → BUILD SUCCESSFUL,
  `app-release.aab` (3.95 MB) generado y verificado. Sale SIN firmar porque el
  keystore lo creás vos (§C); con tu `keystore.properties` sale firmado y listo.
- **Firma de release configurada de forma segura**: `app/build.gradle` lee las
  credenciales de `android/keystore.properties` (gitignoreado) o de variables de
  entorno — nunca hardcodeadas. Plantilla en `keystore.properties.example`.

## ⏳ Lo que falta (requiere TU acción — no se puede automatizar)

El proyecto YA compila un `.aab`. Lo único entre vos y Play Store es:

1. **Generar tu keystore + `keystore.properties`** (§C) y re-compilar para tener
   el `.aab` **firmado**. Solo vos debés tener el keystore (controla las
   actualizaciones de la app). Comando: `cd android && ./gradlew.bat bundleRelease`.
2. **Desplegar la web** en `https://albumgp.vercel.app` (HTTPS) — ✅ ya está
   desplegada y funcionando. Sin esto la app nativa muestra el shell de espera.
3. **Cuenta Google Play Console** (US$25, pago único) — ver §A.
4. Subir el `.aab` firmado a Play (§D) + completar metadata (§F) y clasificación
   de edad/gambling.
5. iOS: requiere una **Mac con Xcode** + **Apple Developer** (US$99/año). Apple
   no permite compilar iOS en Windows. Queda para después (ver §E).

> Android Studio es opcional: con el toolchain de esta PC (JDK + SDK ya
> instalados) el `.aab` se genera por línea de comandos (§D Opción 2).

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

## §C. Generar el keystore y configurar la firma (una sola vez)

El `.aab` debe ir firmado. El keystore es tu identidad de publicación: **si lo
perdés, no podés volver a actualizar la app**. Guardalo seguro (NO en el repo).

> 🔐 **Por qué lo generás vos y no el repo**: quien tiene el keystore controla
> todas las actualizaciones de la app. Por eso `android/keystore.properties` y
> `*.keystore` están **gitignoreados** — las credenciales nunca se commitean.

**1) Generá el keystore** (el JDK ya está instalado: Temurin 17):

```bash
keytool -genkeypair -v \
  -keystore ganaplay-album-release.keystore \
  -alias ganaplay-album -keyalg RSA -keysize 2048 -validity 10000
# Pide una contraseña (anotala) y datos (organización GanaPlay, país SV/GT).
```

Guardá `ganaplay-album-release.keystore` + la contraseña en la caja fuerte del
dueño.

**2) Conectá las credenciales al build.** El `android/app/build.gradle` ya tiene
el `signingConfig` que lee de `android/keystore.properties` (o de variables de
entorno). Copiá la plantilla y completá:

```bash
cd android
cp keystore.properties.example keystore.properties
# Editá keystore.properties con la ruta del .keystore y las contraseñas.
```

`keystore.properties` está gitignoreado. Con eso, `bundleRelease` firma solo.
(Alternativa CI: en vez del archivo, exportá `ANDROID_KEYSTORE_PATH`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.)

---

## §D. Generar el `.aab` para subir a Play

### Opción 1 — Android Studio (recomendada, visual)

1. **Build → Generate Signed Bundle / APK → Android App Bundle**.
2. Seleccioná tu `ganaplay-album.keystore`, alias y contraseña.
3. Variant **release**. Genera `android/app/release/app-release.aab`.

### Opción 2 — Línea de comandos (el SDK ya está instalado en esta PC)

El toolchain ya está listo en esta máquina: **JDK 17** (Temurin) + **Android SDK**
(platform-34, build-tools 34.0.0, platform-tools) + `android/local.properties`
apuntando al SDK. Con tu `keystore.properties` creado (§C):

```bash
export JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-17.0.19.10-hotspot"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
cd android
./gradlew.bat bundleRelease
# Salida FIRMADA: android/app/build/outputs/bundle/release/app-release.aab
```

El `signingConfig` en `app/build.gradle` ya lee tus credenciales de
`keystore.properties` — no hay que tocar el build. **Sin** `keystore.properties`
el `.aab` sale SIN firmar (sirve para validar que compila, pero Play lo rechaza
hasta firmarlo).

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

Para las **capturas**, abrí `https://albumgp.vercel.app` en Chrome (F12 →
modo iPhone/Android) y capturá: entrada de código, sobre cerrado, reveal, álbum.

---

## §G. Checklist final antes de enviar

- [x] Web desplegada y funcional en `https://albumgp.vercel.app` (HTTPS).
- [ ] Env de prod: `DATABASE_URL` **pooled**, `AUTH_SECRET`, `UPSTASH_*`,
      `NEXT_PUBLIC_SITE_URL=https://albumgp.vercel.app` (el boot valida).
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
