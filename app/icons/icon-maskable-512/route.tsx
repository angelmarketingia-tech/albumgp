import { renderBrandIcon } from "@/lib/brand/icon-image";

export const runtime = "edge";

export function GET(): Response {
  return renderBrandIcon(512, true);
}
