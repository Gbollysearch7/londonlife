"use client";
import { useEffect, useRef } from "react";
import styles from "./ui.module.css";

/** Side sheet on desktop, bottom sheet on mobile. Escape closes it; focus returns to the opener. */
export default function Sheet({
  title,
  onClose,
  onBack,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);
  return (
    <aside className={`${styles.sheet} ${wide ? styles.wide : ""}`} role="dialog" aria-label={title} tabIndex={-1} ref={ref}>
      <header className={styles.sheetHead}>
        {onBack ? (
          <button className={styles.iconBtn} onClick={onBack} aria-label="Back">
            ‹
          </button>
        ) : (
          <span />
        )}
        <h2>{title}</h2>
        <button className={styles.iconBtn} onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className={styles.sheetBody}>{children}</div>
    </aside>
  );
}
