import Image from "next/image";

/**
 * Variantes del logo de GanaPlay disponibles en /public/brand/logo/.
 *
 * - `blanco`    -> logo blanco con transparencia, uso PRINCIPAL sobre el
 *                  fondo verde `bg-gp-radial` de la app.
 * - `principal` -> logo completo a color con tagline "Pronosticos
 *                  deportivos". Referencia de marca; preferir `blanco`
 *                  para UI productiva.
 * - `isotipo`   -> variante lockup solo "GanaPlay" sobre verde.
 *
 * La fuente de verdad de cada archivo vive en `/brand/logo/`. Aqui
 * apuntamos a la copia derivada en `/public/brand/logo/` que es la que
 * Next.js sirve al cliente. Ver `brand/README.md`.
 */
export type LogoVariant = "principal" | "isotipo" | "blanco";

type LogoAsset = {
  src: string;
  width: number;
  height: number;
};

const LOGO_ASSETS: Record<LogoVariant, LogoAsset> = {
  blanco: {
    src: "/brand/logo/logo-blanco.png",
    width: 853,
    height: 170,
  },
  principal: {
    src: "/brand/logo/logo-principal.jpg",
    width: 1080,
    height: 1080,
  },
  isotipo: {
    src: "/brand/logo/logo-solo-isotipo.jpg",
    width: 1080,
    height: 1921,
  },
};

export interface LogoProps {
  variant?: LogoVariant;
  /** Ancho renderizado en px. Default 200. La altura se calcula manteniendo proporcion. */
  width?: number;
  /** Texto alternativo accesible. Default "GanaPlay". */
  alt?: string;
  className?: string;
  /** Marcar como prioritario para LCP (p. ej. hero del entry). */
  priority?: boolean;
}

export function Logo({
  variant = "blanco",
  width = 200,
  alt = "GanaPlay",
  className,
  priority = false,
}: LogoProps): JSX.Element {
  const asset = LOGO_ASSETS[variant];
  const height = Math.round((asset.height / asset.width) * width);

  return (
    <Image
      src={asset.src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      sizes={`${width}px`}
      fetchPriority={priority ? 'high' : 'auto'}
    />
  );
}

export default Logo;
