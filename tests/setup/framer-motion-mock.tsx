// Minimal framer-motion stub used by component tests. Renders the
// requested element synchronously, stripping motion-only props that would
// otherwise be forwarded to the DOM (and trigger React warnings).
//
// Component tests `vi.mock("framer-motion", ...)` against this helper.

import { createElement, type ReactNode } from "react";

type AnyProps = Record<string, unknown>;

const MOTION_ONLY_PROPS = new Set([
  "initial",
  "animate",
  "exit",
  "whileHover",
  "whileTap",
  "whileFocus",
  "whileDrag",
  "whileInView",
  "transition",
  "variants",
  "layout",
  "layoutId",
  "drag",
  "dragConstraints",
  "onAnimationComplete",
  "onAnimationStart",
  "onUpdate",
  "viewport",
]);

function stripMotionProps(props: AnyProps): AnyProps {
  const cleaned: AnyProps = {};
  for (const key of Object.keys(props)) {
    if (!MOTION_ONLY_PROPS.has(key)) {
      cleaned[key] = props[key];
    }
  }
  return cleaned;
}

function makeMotionComponent(
  tag: string,
): (props: AnyProps & { children?: ReactNode }) => ReactNode {
  return (props) => createElement(tag, stripMotionProps(props));
}

export const motion: Record<
  string,
  (props: AnyProps & { children?: ReactNode }) => ReactNode
> = new Proxy(
  {},
  {
    get: (_target, prop: string) => makeMotionComponent(prop),
  },
) as Record<string, (props: AnyProps & { children?: ReactNode }) => ReactNode>;

export function AnimatePresence({
  children,
}: {
  children?: ReactNode;
}): ReactNode {
  return children;
}

export function useReducedMotion(): boolean {
  return false;
}
