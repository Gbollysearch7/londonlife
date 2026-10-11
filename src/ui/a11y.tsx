"use client";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Focus management for overlays and cards (spec ch. 36: real keyboard navigation).
 * On mount focus moves inside (to an [autofocus] control, else the first focusable control, else the
 * container); on unmount it returns to whatever had focus before, if that is still on the page.
 * With `trap`, Tab and Shift+Tab cycle inside, which suits modal overlays.
 */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute("inert") && el.getClientRects().length > 0);
}

export function FocusScope({ children, trap = false, focusKey }: { children: ReactNode; trap?: boolean; /** Refocus when this changes (e.g. a different hotspot). */ focusKey?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const opener = document.activeElement as HTMLElement | null;
    const target =
      root.querySelector<HTMLElement>("[autofocus], [data-autofocus]") ??
      root.querySelector<HTMLElement>('[role="dialog"][tabindex]') ??
      focusableIn(root)[0];
    if (target && !root.contains(document.activeElement)) target.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (!trap || e.key !== "Tab") return;
      const items = focusableIn(root);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener && opener !== document.body && document.contains(opener) && (!document.activeElement || document.activeElement === document.body || root.contains(document.activeElement))) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [trap, focusKey]);
  return (
    <div ref={ref} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
