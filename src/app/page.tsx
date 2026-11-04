import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Página de prueba de la Fase 0: comprueba que tokens, fuentes, shadcn y modo nocturno funcionan.
// Los textos y montos son ejemplos. Se reemplaza por la landing en una fase posterior.
const pisos = [
  { nombre: "Piso 1", ocupadas: 1, total: 1 },
  { nombre: "Piso 2", ocupadas: 3, total: 3 },
  { nombre: "Piso 3", ocupadas: 1, total: 3 },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Fase 0 · prueba del sistema de diseño</p>
        <ThemeToggle />
      </header>

      <div>
        <h1 className="text-[34px] font-bold tracking-tight">
          <span className="font-script text-[64px] font-normal leading-tight tracking-normal text-primary">
            Buenos días
          </span>
          , Carlos
        </h1>
        <p className="mt-2 text-base text-muted-foreground">Esto es lo que necesita tu atención hoy.</p>
      </div>

      <Card className="rounded-xl border shadow-card ring-0">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Ocupación por piso</CardTitle>
          <CardDescription>5 de 7 unidades ocupadas</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {pisos.map((piso) => (
            <div key={piso.nombre}>
              <div className="mb-1.5 flex justify-between text-sm">
                <b>{piso.nombre}</b>
                <span className="text-muted-foreground">
                  {piso.ocupadas} de {piso.total} ocupadas
                </span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-label={`Ocupación del ${piso.nombre}`}
                aria-valuemin={0}
                aria-valuemax={piso.total}
                aria-valuenow={piso.ocupadas}
              >
                <div className="h-full rounded-full bg-bar" style={{ width: `${(piso.ocupadas / piso.total) * 100}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-xl border shadow-card ring-0">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Estados y botones</CardTitle>
          <CardDescription>Cada estado lleva texto además de color.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-ok-soft px-3 py-1 text-ok">Disponible</span>
            <span className="rounded-full bg-danger-soft px-3 py-1 text-danger">Ocupado</span>
            <span className="rounded-full bg-warn-soft px-3 py-1 text-warn">Mantenimiento</span>
            <span className="rounded-full bg-primary-soft px-3 py-1 text-primary-text">Nueva</span>
            <span className="rounded-full bg-chip px-3 py-1 text-chip-foreground">Pendiente</span>
            <span className="rounded-full bg-terracota px-3 py-1 text-terracota-foreground">2</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="h-11 px-4 shadow-card">Continuar</Button>
            <Button size="lg" variant="outline" className="h-11 px-4">Atrás</Button>
            <Button size="lg" variant="link" className="h-11 px-1 text-link">Ver el edificio en 3D</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
