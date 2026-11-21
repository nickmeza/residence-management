"use client";

import { useEffect, useState } from "react";

// Pastilla flotante sobre un esqueleto: dice qué se le está pidiendo a la base mientras carga.
// Aparece solo si la carga pasa de `delay` (si es rápida, no parpadea). Las frases avanzan por tiempo, no por el
// avance real (la página llega de un solo golpe), y la última se queda hasta que entran los datos.
export function LoadingPill({
  messages,
  delay = 500,
  every = 1500,
}: {
  messages: string[];
  delay?: number;
  every?: number;
}) {
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    const timers = messages.map((_, i) => setTimeout(() => setIndex(i), delay + i * every));
    return () => timers.forEach(clearTimeout);
  }, [messages, delay, every]);

  return (
    <div
      className={`loading-pill pointer-events-none absolute inset-0 flex items-center justify-center p-4 ${index < 0 ? "opacity-0" : "opacity-100"}`}
    >
      <p className="flex max-w-full items-center gap-2.5 rounded-full border bg-card/95 px-4 py-2.5 text-sm shadow-card backdrop-blur">
        <span className="loading-dot size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
        <span key={index} className="loading-message truncate">
          {messages[Math.max(index, 0)]}
        </span>
      </p>
    </div>
  );
}
