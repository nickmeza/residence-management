import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import { floorName } from "@/server/building/floors";
import type { BuildingUnit, BuildingView } from "@/server/business/queries";
import { formatLongDate } from "@/server/contracts/dates";
import { getContractFormOptions } from "@/server/contracts/queries";

import { AddResidentButton } from "./add-resident-button";

import { BuildingBreadcrumb, type Crumb } from "./building-breadcrumb";
import { buildingHref, floorHref, unitHref } from "./building-route";
import { wholeFloorApartment, type BuildingFloor } from "./floor-units";
import { StatusChip } from "./status-chip";
import { AddRoomButton, UnitDataTab } from "./unit-page-client";

const TYPE_LABEL = { apartment: "Departamento", room: "Cuarto" } as const;

// Fila de una lista de unidades (página del piso, pestaña Cuartos): poca información y se entra con un toque.
export function UnitLinkRow({
  href,
  unit,
  included,
}: {
  href: string;
  unit: BuildingUnit;
  // Cuarto de un departamento que se alquila completo: no tiene precio ni estado propios.
  included?: boolean;
}) {
  const byRoom = unit.type === "apartment" && unit.rentalMode === "by_room";
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-14 w-full items-center gap-3 border-t px-4 py-2.5 text-sm transition-colors duration-200 first:border-t-0 hover:bg-muted/60"
      >
        <span className="min-w-0 flex-1">
          <b className="block truncate">{unit.name}</b>
          <span className="text-muted-foreground">
            {unit.type === "apartment"
              ? `${TYPE_LABEL.apartment} · ${byRoom ? `por cuartos · ${unit.rooms.length} ${unit.rooms.length === 1 ? "cuarto" : "cuartos"}` : "completo"}`
              : included
                ? "Incluido en el departamento"
                : (unit.occupant?.name ?? TYPE_LABEL.room)}
          </span>
        </span>
        {byRoom || included ? null : <StatusChip status={unit.status} />}
        {byRoom || included ? null : (
          <span className="hidden w-20 text-right font-bold sm:inline">
            {formatSoles(unit.monthlyPrice) ?? "S/ —"}
          </span>
        )}
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}

type Tab = { key: string; label: string };

// Pestañas que tiene cada unidad. El departamento por cuartos no tiene "Residente": cada cuarto tiene el suyo.
function tabsFor(unit: BuildingUnit): Tab[] {
  const tabs: Tab[] = [{ key: "datos", label: "Datos" }];
  if (unit.type === "apartment") tabs.push({ key: "cuartos", label: "Cuartos" });
  if (!(unit.type === "apartment" && unit.rentalMode === "by_room")) {
    tabs.push({ key: "residente", label: "Residente" });
  }
  return tabs;
}

function Tabs({ tabs, current, basePath }: { tabs: Tab[]; current: string; basePath: string }) {
  return (
    <nav aria-label="Secciones de la unidad" className="flex flex-wrap gap-2 border-b pb-3">
      {tabs.map((t) =>
        t.key === current ? (
          <span
            key={t.key}
            aria-current="page"
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
          >
            {t.label}
          </span>
        ) : (
          <Link
            key={t.key}
            href={t.key === "datos" ? basePath : `${basePath}?pestana=${t.key}`}
            className="rounded-lg border bg-card px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            {t.label}
          </Link>
        ),
      )}
    </nav>
  );
}

function ResidentTab({
  unit,
  parent,
  add,
}: {
  unit: BuildingUnit;
  parent: BuildingUnit | null;
  // Botón "Agregar residente" (solo si está libre y se puede alquilar).
  add: ReactNode;
}) {
  const inWhole = parent !== null && parent.rentalMode !== "by_room";
  const o = unit.occupant;
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
      {inWhole ? (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          Este cuarto se alquila junto con {parent.name}.
        </p>
      ) : null}
      {o ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="min-w-0 flex-1 text-lg font-bold">{o.name}</h2>
            <StatusChip status={unit.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Desde el {formatLongDate(o.startDate)} ·{" "}
            {o.endDate ? `hasta el ${formatLongDate(o.endDate)}` : "mes a mes, sin fecha de fin"}
          </p>
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link href={`/residentes/${o.residentId}`} className="text-link underline-offset-4 hover:underline">
              Ver perfil
            </Link>
            <Link href={`/contratos/${o.contractId}`} className="text-link underline-offset-4 hover:underline">
              Ver contrato
            </Link>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">Libre</h2>
          <p className="text-sm text-muted-foreground">
            {inWhole ? `Nadie alquila ${parent.name} ahora.` : "Nadie vive aquí ahora."}
          </p>
          {add ? <div className="mt-3">{add}</div> : null}
        </div>
      )}
    </section>
  );
}

function RoomsTab({ buildingId, unit }: { buildingId: string; unit: BuildingUnit }) {
  const byRoom = unit.rentalMode === "by_room";
  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {byRoom
          ? "Se alquila por cuartos: cada cuarto tiene su precio y su residente."
          : "Se alquila completo: los cuartos solo describen el departamento."}
      </p>
      {unit.rooms.length ? (
        <ul className="overflow-hidden rounded-xl border bg-card shadow-card">
          {unit.rooms.map((r) => (
            <UnitLinkRow key={r.id} href={unitHref(buildingId, r.id)} unit={r} included={!byRoom} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-card">
          Todavía no tiene cuartos.
        </p>
      )}
      <AddRoomButton apartmentId={unit.id} />
    </section>
  );
}

// Detalle de una unidad con sus pestañas (Datos, Cuartos, Residente). basePath: la dirección de la página que
// lo muestra (la de la unidad o, si el departamento ocupa todo el piso, la del piso).
export async function UnitDetail({
  building,
  floor,
  unit,
  parent,
  tab,
  basePath,
}: {
  building: BuildingView;
  floor: BuildingFloor;
  unit: BuildingUnit;
  parent: BuildingUnit | null;
  tab: string | undefined;
  basePath: string;
}) {
  const tabs = tabsFor(unit);
  const current = tabs.find((t) => t.key === tab)?.key ?? "datos";
  const whole = wholeFloorApartment(floor.units);
  const floorLabel = floorName(floor.level);

  // Unidad libre: se puede agregar un residente. Un cuarto de un departamento que se alquila completo se alquila
  // con el departamento, así que el contrato va al departamento.
  const rentTarget = parent && parent.rentalMode !== "by_room" ? parent : unit;
  const options =
    current === "residente" && !unit.occupant ? await getContractFormOptions(building.businessId) : null;
  const add =
    options && options.units.some((u) => u.id === rentTarget.id) ? (
      <AddResidentButton unitId={rentTarget.id} unitName={rentTarget.name} options={options} />
    ) : null;

  // Migas: el departamento que ocupa todo el piso es el piso mismo, así que no se repite.
  const crumbs: Crumb[] = [
    { label: "Edificio", href: buildingHref(building.id) },
    whole && whole.id === unit.id
      ? { label: `${floorLabel} · ${unit.name}` }
      : { label: floorLabel, href: floorHref(building.id, floor.id) },
  ];
  if (parent && whole?.id !== parent.id) crumbs.push({ label: parent.name, href: unitHref(building.id, parent.id) });
  if (!(whole && whole.id === unit.id)) crumbs.push({ label: unit.name });

  // Al quitar la unidad se vuelve al piso; un cuarto, a los cuartos de su departamento.
  const parentPath = parent
    ? whole?.id === parent.id
      ? floorHref(building.id, floor.id)
      : unitHref(building.id, parent.id)
    : floorHref(building.id, floor.id);
  const backHref = parent ? `${parentPath}?pestana=cuartos` : parentPath;

  return (
    <>
      <div className="flex flex-col gap-2">
        <BuildingBreadcrumb items={crumbs} />
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[34px] font-bold tracking-tight">{unit.name}</h1>
          {unit.type === "apartment" && unit.rentalMode === "by_room" ? null : <StatusChip status={unit.status} />}
        </div>
        <p className="text-muted-foreground">
          {floorLabel} · {TYPE_LABEL[unit.type]}
          {parent ? ` · dentro de ${parent.name}` : ""}
          {unit.type === "apartment" && unit.occupiesWholeFloor ? " · ocupa todo el piso" : ""}
        </p>
      </div>
      <Tabs tabs={tabs} current={current} basePath={basePath} />
      <div className={cn(current === "datos" && "rounded-xl border bg-card p-5 shadow-card")}>
        {current === "datos" ? (
          <UnitDataTab
            target={{ unit, parent, floorLabel, onlyUnit: floor.units.length === 1 }}
            backHref={backHref}
          />
        ) : current === "cuartos" ? (
          <RoomsTab buildingId={building.id} unit={unit} />
        ) : (
          <ResidentTab unit={unit} parent={parent} add={add} />
        )}
      </div>
    </>
  );
}
