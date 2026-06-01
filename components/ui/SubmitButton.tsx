"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  idleLabel = "Abrir sobre",
  busyLabel = "Abriendo…",
}: {
  children?: React.ReactNode;
  idleLabel?: string;
  busyLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-busy={pending}
      disabled={pending}
      className="h-14 w-full rounded-xl bg-[linear-gradient(135deg,#B8860B,#D4A017,#F4D03F)] font-sans font-black uppercase tracking-wide text-gp-green-deep shadow-gold-glow active:scale-[0.97] transition-transform disabled:opacity-70 disabled:cursor-progress inline-flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-4 focus-visible:ring-gp-white focus-visible:ring-offset-2 focus-visible:ring-offset-gp-green-deep"
    >
      {pending ? (
        <>
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-gp-green-deep border-t-transparent"
          />
          {busyLabel}
        </>
      ) : (
        children ?? idleLabel
      )}
    </button>
  );
}
