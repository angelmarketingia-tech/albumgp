// Constantes oficiales de marca extraídas del Manual de Marca
// (brand/MANUAL_DE_MARCA.pdf). Fuente única para que la UI no hardcodee
// estos valores en múltiples lugares.

/**
 * Slogan oficial — página "SLOGAN" del Manual.
 * Reemplaza al "Pronósticos deportivos" del tagline anterior, que sigue
 * existiendo en el logotipo combinado pero NO como slogan de la app.
 */
export const GANAPLAY_SLOGAN = "Ganar es una pasión";

/**
 * URLs externas oficiales de depósito por país.
 * Fuente: AGENTS.md §4. La pantalla de "Depósitos" redirige a estas URLs
 * según el país del código que el usuario abrió.
 */
export const DEPOSIT_URLS: Readonly<Record<"SV" | "GT", string>> = Object.freeze({
  SV: "https://ganaplay.sv/landing/depositos",
  GT: "https://ganaplay.gt/landing/depositos",
});

/**
 * URLs externas oficiales de inicio de sesión por país (plataforma
 * principal de GanaPlay). El botón "Canjear premios" lleva al usuario a
 * esta URL para que se loguee con sus credenciales reales de GanaPlay
 * (no las del mock interno).
 *
 * [CONFIRMAR_SIGNIN_PATH] — `/iniciar-sesion` es el path en español más
 * natural y los sitios responden 200 ahí. Si el path oficial es otro
 * (`/login`, `/entrar`, etc.), reemplazar acá y propagarlo a producción.
 */
export const SIGNIN_URLS: Readonly<Record<"SV" | "GT", string>> = Object.freeze({
  SV: "https://ganaplay.sv/iniciar-sesion",
  GT: "https://ganaplay.gt/iniciar-sesion",
});

/**
 * Avisos legales obligatorios — AGENTS.md §12. Deben aparecer en la UI.
 */
export const LEGAL_NOTICES = Object.freeze({
  ageGate: "Solo mayores de 18 años",
  responsibleGaming: "Juega responsablemente",
});

/**
 * Nombre comercial oficial. Mantener exactamente esta capitalización
 * (Manual, página "MANEJO DE LOGO": prohibido alterar el wordmark).
 */
export const BRAND_NAME = "GanaPlay";
