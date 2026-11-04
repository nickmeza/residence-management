// Modo de la pantalla Edificio: 3D o Simple. Se recuerda en el dispositivo (no en la cuenta),
// porque depende de lo que el equipo aguanta.

export type ViewMode = "3d" | "simple";

export type DeviceInfo = {
  saved: ViewMode | null;
  webgl: boolean;
  // Núcleos del procesador (navigator.hardwareConcurrency) y memoria en GB (navigator.deviceMemory, solo
  // algunos navegadores). undefined si el navegador no lo dice.
  cores?: number;
  memoryGb?: number;
};

export type ModeDecision = { mode: ViewMode; notice: "no_webgl" | "slow_device" | null };

// Sin 3D posible → Simple siempre. Si la persona ya eligió, se respeta. Si no, 3D salvo que el equipo
// parezca lento (4 núcleos o menos, o 4 GB o menos): en ese caso Simple, con un aviso.
export function decideMode(d: DeviceInfo): ModeDecision {
  if (!d.webgl) return { mode: "simple", notice: "no_webgl" };
  if (d.saved) return { mode: d.saved, notice: null };
  const slow = (d.cores !== undefined && d.cores <= 4) || (d.memoryGb !== undefined && d.memoryGb <= 4);
  return slow ? { mode: "simple", notice: "slow_device" } : { mode: "3d", notice: null };
}

export const VIEW_MODE_KEY = "modo-edificio";

// Lee lo que hace falta del navegador. Si algo falla (por ejemplo, el almacenamiento bloqueado), se sigue
// sin esa información.
export function readDeviceInfo(): DeviceInfo {
  let saved: ViewMode | null = null;
  try {
    const value = localStorage.getItem(VIEW_MODE_KEY);
    if (value === "3d" || value === "simple") saved = value;
  } catch {}
  let webgl = false;
  try {
    const canvas = document.createElement("canvas");
    webgl = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {}
  const nav = navigator as Navigator & { deviceMemory?: number };
  return { saved, webgl, cores: nav.hardwareConcurrency, memoryGb: nav.deviceMemory };
}

export function saveViewMode(mode: ViewMode) {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {}
}
