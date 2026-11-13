"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// Arrastrar y soltar del menú, con eventos de puntero del navegador (sirven igual para mouse y dedo; sin paquetes).
// - Mouse: se arrastra al mover más de 5 px con el botón apretado.
// - Dedo: hay que mantener presionado 0,4 s; si el dedo se mueve antes, es un desplazamiento normal de la página.
// Los lugares donde se puede soltar llevan data-drop-date="AAAA-MM-DD"; lo que esté marcado con data-no-drag
// (botones dentro del título) no empieza un arrastre. Esc cancela.

// touch: se arrastra con el dedo (la tarjeta que se lleva va debajo del dedo para no tapar los días).
export type DragState<T> = { item: T; x: number; y: number; overDate: string | null; touch: boolean };

const LONG_PRESS_MS = 400;
const MOUSE_THRESHOLD = 5;
const TOUCH_SLOP = 8;

function dateAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  return el?.closest<HTMLElement>("[data-drop-date]")?.dataset.dropDate ?? null;
}

export function useMenuDrag<T>(onDrop: (item: T, date: string) => void) {
  const [drag, setDrag] = useState<DragState<T> | null>(null);
  const onDropRef = useRef(onDrop);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onDropRef.current = onDrop;
  });
  useEffect(() => () => stopRef.current?.(), []);

  function handle(item: T) {
    return {
      onPointerDown(e: ReactPointerEvent<HTMLElement>) {
        if (e.button !== 0 || stopRef.current) return;
        if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
        const el = e.currentTarget;
        const id = e.pointerId;
        const touch = e.pointerType === "touch";
        const start = { x: e.clientX, y: e.clientY };
        let last = start;
        let active = false;
        // Con mouse se evita que el arrastre seleccione texto.
        if (!touch) e.preventDefault();

        const activate = () => {
          active = true;
          try {
            el.setPointerCapture(id);
          } catch {
            // El puntero ya se soltó: no pasa nada.
          }
          navigator.vibrate?.(15);
          setDrag({ item, x: last.x, y: last.y, overDate: dateAt(last.x, last.y), touch });
        };
        const timer = touch ? window.setTimeout(activate, LONG_PRESS_MS) : undefined;

        const onMove = (ev: PointerEvent) => {
          if (ev.pointerId !== id) return;
          last = { x: ev.clientX, y: ev.clientY };
          if (!active) {
            const dist = Math.hypot(last.x - start.x, last.y - start.y);
            if (touch && dist > TOUCH_SLOP) stop(false);
            else if (!touch && dist > MOUSE_THRESHOLD) activate();
            return;
          }
          setDrag({ item, x: last.x, y: last.y, overDate: dateAt(last.x, last.y), touch });
        };
        const onUp = (ev: PointerEvent) => {
          if (ev.pointerId === id) stop(true);
        };
        const onCancel = (ev: PointerEvent) => {
          if (ev.pointerId === id) stop(false);
        };
        const onKey = (ev: KeyboardEvent) => {
          if (ev.key === "Escape") stop(false);
        };
        // Mientras se arrastra con el dedo, la página no se desplaza.
        const onTouchMove = (ev: TouchEvent) => {
          if (active && ev.cancelable) ev.preventDefault();
        };

        function stop(commit: boolean) {
          window.clearTimeout(timer);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onCancel);
          window.removeEventListener("keydown", onKey);
          document.removeEventListener("touchmove", onTouchMove);
          stopRef.current = null;
          if (active) {
            // El clic que llega al soltar no debe abrir ni elegir nada.
            const swallow = (ev: MouseEvent) => {
              ev.stopPropagation();
              ev.preventDefault();
            };
            window.addEventListener("click", swallow, { capture: true, once: true });
            window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
            const date = commit ? dateAt(last.x, last.y) : null;
            if (date) onDropRef.current(item, date);
          }
          active = false;
          setDrag(null);
        }

        stopRef.current = () => stop(false);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onCancel);
        window.addEventListener("keydown", onKey);
        document.addEventListener("touchmove", onTouchMove, { passive: false });
      },
      // Mantener presionado no abre el menú del navegador.
      onContextMenu(e: ReactMouseEvent) {
        e.preventDefault();
      },
    };
  }

  return { drag, handle };
}
