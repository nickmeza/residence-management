"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

// Filtros y búsqueda de una lista guardados en la dirección (?filtro=sin-cuarto,documentos&q=maria): al recargar o
// volver con "Atrás" la lista sigue como se dejó, y un enlace (por ejemplo, un pendiente del Panel) la abre filtrada.
// "slugs" son las palabras en español de cada filtro. Sin ?filtro se usan "defaults"; ?filtro= vacío es "ninguno".
// Se escribe con history.replaceState: cambia la dirección sin volver a pedir la página al servidor (Next.js lo
// sincroniza con useSearchParams).
export function useListParams<F extends string>(slugs: Record<F, string>, defaults: readonly F[] = []) {
  const params = useSearchParams();
  const [filters, setFiltersState] = useState<F[]>(() => {
    const raw = params.get("filtro");
    if (raw === null) return [...defaults];
    const bySlug = new Map(Object.entries(slugs).map(([id, slug]) => [slug as string, id as F]));
    return raw
      .split(",")
      .map((slug) => bySlug.get(slug))
      .filter((f): f is F => f !== undefined);
  });
  const [query, setQueryState] = useState(() => params.get("q") ?? "");
  // Lo último escrito, para que cambiar filtro y búsqueda seguidos (en el mismo clic) no pise uno al otro.
  const latest = useRef({ filters, query });

  const write = (nextFilters: F[], nextQuery: string) => {
    latest.current = { filters: nextFilters, query: nextQuery };
    const url = new URLSearchParams(window.location.search);
    const isDefault =
      nextFilters.length === defaults.length && nextFilters.every((f) => defaults.includes(f));
    if (isDefault) url.delete("filtro");
    else url.set("filtro", nextFilters.map((f) => slugs[f]).join(","));
    if (nextQuery.trim()) url.set("q", nextQuery);
    else url.delete("q");
    // Las comas se dejan legibles: ?filtro=vigentes,por-vencer
    const search = url.toString().replace(/%2C/g, ",");
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  };

  return {
    filters,
    query,
    setFilters: (next: F[]) => {
      setFiltersState(next);
      write(next, latest.current.query);
    },
    setQuery: (next: string) => {
      setQueryState(next);
      write(latest.current.filters, next);
    },
  };
}
