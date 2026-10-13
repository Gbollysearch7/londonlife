"use client";
import { useEffect, useRef, useState } from "react";
import { useGame } from "@/client/store";
import { installKeyboard, useControls } from "@/world/controls";
import styles from "./controls.module.css";

/** "Press E" prompt for whatever you're standing next to; also a tap target on phones. */
export function InteractPrompt() {
  const nearby = useControls((x) => x.nearby);
  const sheet = useGame((x) => x.sheet);
  if (!nearby || sheet) return null;
  return (
    <button className={styles.prompt} onClick={() => nearby.open()} aria-label={nearby.label}>
      <kbd>E</kbd>
      <span>{nearby.label}</span>
    </button>
  );
}

/** Virtual thumbstick for touch screens. Push to walk; push to the edge to run. */
export function Joystick() {
  const setStick = useControls((x) => x.setStick);
  const [touch, setTouch] = useState(false);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  useEffect(() => {
    setTouch(typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window));
  }, []);
  if (!touch) return null;
  const R = 46;
  const move = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId || !base.current) return;
    const r = base.current.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const m = Math.hypot(dx, dy);
    if (m > R) {
      dx = (dx / m) * R;
      dy = (dy / m) * R;
    }
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    setStick(dx / R, -dy / R);
  };
  const end = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    if (knob.current) knob.current.style.transform = "translate(0px, 0px)";
    setStick(0, 0);
  };
  return (
    <div
      ref={base}
      className={styles.stick}
      onPointerDown={(e) => {
        active.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      role="application"
      aria-label="Movement joystick"
    >
      <div ref={knob} className={styles.knob} />
    </div>
  );
}

/** One-time hint so new players know they can steer. */
export function ControlsHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem("ll-controls-hint") === "1";
    } catch {
      /* storage unavailable */
    }
    if (seen) return;
    setShow(true);
    const t = setTimeout(() => dismiss(), 12000);
    return () => clearTimeout(t);
  }, []);
  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem("ll-controls-hint", "1");
    } catch {
      /* storage unavailable */
    }
  };
  if (!show) return null;
  return (
    <button className={styles.hint} onClick={dismiss}>
      <strong>Move:</strong> <kbd>W</kbd>
      <kbd>A</kbd>
      <kbd>S</kbd>
      <kbd>D</kbd> or arrows · <kbd>Shift</kbd> run · <kbd>E</kbd> use · drag to turn the camera
    </button>
  );
}

/** Installs keyboard control once; movement pauses while placing furniture or playing a minigame. */
export function useKeyboardControls() {
  useEffect(() => {
    installKeyboard(() => {
      const g = useGame.getState();
      return !!g.placement || !!g.state?.minigame;
    });
  }, []);
}
