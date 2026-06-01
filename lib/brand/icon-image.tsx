// Programmatic PWA icon generator via next/og (Satori). Renders the white
// brand isotipo centered on the brand-green radial — a real PNG at any size,
// with no external image tooling (sharp/imagemagick) needed.
//
// `padding` carves the maskable safe zone: Android adaptive icons crop to a
// circle/squircle, so maskable variants keep the mark within the inner ~80%.

import { ImageResponse } from "next/og";
import { ISOTIPO_WHITE_DATA_URI } from "./isotipo-data-uri";

export function renderBrandIcon(size: number, maskable = false): ImageResponse {
  // Maskable: shrink the mark to the safe zone (~62% of the canvas) so cropping
  // never clips it. Non-maskable ("any"): a tighter, fuller mark.
  const markRatio = maskable ? 0.62 : 0.72;
  const markSize = Math.round(size * markRatio);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Brand radial (gp-radial): #00783E core → #034419 edge.
          backgroundImage:
            "radial-gradient(circle at 50% 45%, #00783E 0%, #034419 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ISOTIPO_WHITE_DATA_URI}
          width={markSize}
          height={markSize}
          alt=""
        />
      </div>
    ),
    { width: size, height: size },
  );
}
