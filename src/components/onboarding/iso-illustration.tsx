import { cn } from "@/lib/utils";
import type { PropertyType } from "@/server/onboarding/form";

// Dibujos isométricos del prototipo (paso "Qué ofreces"). Las formas son las mismas;
// los colores salen de los tokens: lo que ofreces en terracota, el resto de la propiedad en el color principal suave.
type Role = "slabL" | "slabR" | "slabT" | "restL" | "restR" | "restT" | "hiL" | "hiR" | "hiT";

const FILL: Record<Role, string> = {
  slabL: "fill-border",
  slabR: "fill-muted",
  slabT: "fill-card",
  restL: "fill-primary/35",
  restR: "fill-primary/25",
  restT: "fill-primary-soft",
  hiL: "fill-terracota",
  hiR: "fill-terracota/80",
  hiT: "fill-terracota/55",
};

const SHAPES: Record<PropertyType, [Role, string][]> = {
  room: [
    ["slabL", "50,117 140,162 140,154 50,109"],
    ["slabR", "140,162 260,102 260,94 140,154"],
    ["slabT", "50,109 140,154 260,94 170,49"],
    ["restL", "134,73 173,92.5 173,76.5 134,57"],
    ["restR", "173,92.5 206,76 206,60 173,76.5"],
    ["restT", "134,57 173,76.5 206,60 167,40.5"],
    ["hiL", "98,91 137,110.5 137,94.5 98,75"],
    ["hiR", "137,110.5 170,94 170,78 137,94.5"],
    ["hiT", "98,75 137,94.5 170,78 131,58.5"],
    ["restL", "62,109 101,128.5 101,112.5 62,93"],
    ["restR", "101,128.5 134,112 134,96 101,112.5"],
    ["restT", "62,93 101,112.5 134,96 95,76.5"],
    ["restL", "110,133 140,148 140,132 110,117"],
    ["restR", "140,148 173,131.5 173,115.5 140,132"],
    ["restT", "110,117 140,132 173,115.5 143,100.5"],
  ],
  floor: [
    ["slabL", "60,122 140,162 140,154 60,114"],
    ["slabR", "140,162 240,112 240,104 140,154"],
    ["slabT", "60,114 140,154 240,104 160,64"],
    ["restL", "88,124 140,150 140,126 88,100"],
    ["restR", "140,150 210,115 210,91 140,126"],
    ["restT", "88,100 140,126 210,91 158,65"],
    ["hiL", "88,98 140,124 140,100 88,74"],
    ["hiR", "140,124 210,89 210,65 140,100"],
    ["hiT", "88,74 140,100 210,65 158,39"],
  ],
  building: [
    ["slabL", "60,122 140,162 140,154 60,114"],
    ["slabR", "140,162 240,112 240,104 140,154"],
    ["slabT", "60,114 140,154 240,104 160,64"],
    ["hiL", "88,124 140,150 140,126 88,100"],
    ["hiR", "140,150 210,115 210,91 140,126"],
    ["hiT", "88,100 140,126 210,91 158,65"],
    ["hiL", "88,98 140,124 140,100 88,74"],
    ["hiR", "140,124 210,89 210,65 140,100"],
    ["hiT", "88,74 140,100 210,65 158,39"],
    ["hiL", "88,72 140,98 140,74 88,48"],
    ["hiR", "140,98 210,63 210,39 140,74"],
    ["hiT", "88,48 140,74 210,39 158,13"],
  ],
};

const LABEL: Record<PropertyType, string> = {
  room: "Un cuarto resaltado dentro de la casa",
  floor: "Un piso resaltado dentro de la casa",
  building: "Edificio completo resaltado",
};

export function IsoIllustration({ type, className }: { type: PropertyType; className?: string }) {
  return (
    <svg
      viewBox="0 0 280 200"
      role="img"
      aria-label={LABEL[type]}
      className={cn("mx-auto block w-full max-w-72", className)}
    >
      {SHAPES[type].map(([role, points], i) => (
        <polygon key={i} points={points} className={FILL[role]} />
      ))}
    </svg>
  );
}

// Leyenda de los dibujos.
export function IsoLegend() {
  return (
    <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
      <span className="flex items-center gap-2">
        <span className="size-3.5 rounded bg-terracota" aria-hidden="true" />
        Lo que ofreces
      </span>
      <span className="flex items-center gap-2">
        <span className="size-3.5 rounded bg-primary/30" aria-hidden="true" />
        Resto de la propiedad
      </span>
    </div>
  );
}
