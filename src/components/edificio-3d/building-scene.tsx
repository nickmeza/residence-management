"use client";

import { Edges } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { ExtrudeGeometry, Group, OrthographicCamera, Plane, Shape, Vector2, Vector3 } from "three";

import type { OutlinePoint } from "@/db/schema";
import { dragTo, type DragArea } from "@/server/building/drag";
import { floorName } from "@/server/building/floors";
import type { Rect } from "@/server/building/geometry";
import type { BuildingUnit, BuildingView } from "@/server/business/queries";

import { LabelSprite } from "./label-sprite";
import { useThemeColors, type ThemeColors } from "./use-theme-colors";

// Medidas del dibujo, en metros. La altura de cada piso es solo para verlo; no se guarda.
export const FLOOR_HEIGHT = 2.6;
const SLAB_GAP = 0.15;
const UNIT_HEIGHT = 0.6;
// Lo que hay que mover el puntero (en píxeles) para que cuente como arrastre y no como clic.
const DRAG_THRESHOLD = 6;

// Dónde está la persona: el edificio completo, la planta de un piso o el interior de un departamento.
export type SceneView =
  | { level: "building" }
  | { level: "floor"; floorId: string }
  | { level: "unit"; floorId: string; unitId: string };
export type SceneSelection = { kind: "floor"; id: string } | { kind: "unit"; id: string } | null;

type Props = {
  building: BuildingView;
  view: SceneView;
  selection: SceneSelection;
  onSelect: (selection: SceneSelection) => void;
  onEnter: (view: SceneView) => void;
  // Guardan en segundo plano. Quien los recibe muestra el cambio al instante y lo deshace si el servidor lo rechaza.
  onMoveFloor: (floorId: string, level: number) => void;
  onMoveUnit: (unitId: string, x: number, z: number) => void;
};

// Doble clic en un piso: si tiene un solo departamento que ocupa todo el piso, se entra directo a él.
export function enterViewFor(floor: BuildingView["floors"][number]): SceneView {
  const only = floor.units.length === 1 ? floor.units[0] : null;
  if (only?.type === "apartment" && only.occupiesWholeFloor) {
    return { level: "unit", floorId: floor.id, unitId: only.id };
  }
  return { level: "floor", floorId: floor.id };
}

function bounds(points: { x: number; z: number }[]) {
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    w: maxX - minX,
    d: maxZ - minZ,
  };
}

// La forma de la losa se dibuja en el plano x/z: Shape trabaja en x/y, así que se usa y = −z y se gira.
function extrude(outline: OutlinePoint[], height: number) {
  const shape = new Shape(outline.map((p) => new Vector2(p.x, -p.z)));
  return new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
}

const setCursor = (c: string) => {
  document.body.style.cursor = c;
};

type CameraGoal = { target: Vector3; dir: Vector3; extentW: number; extentH: number };

// Mueve la cámara poco a poco hacia donde debe estar (transición suave al entrar o salir, como el prototipo).
// Con frameloop="demand" solo se dibuja mientras la cámara se mueve.
function CameraRig({ goal }: { goal: CameraGoal }) {
  const target = useRef(goal.target.clone());
  const dir = useRef(goal.dir.clone());
  // La cámara, el tamaño e invalidate se toman del cuadro actual (no de useThree), como pide R3F.
  useFrame(({ camera, size, invalidate }) => {
    const cam = camera as OrthographicCamera;
    target.current.lerp(goal.target, 0.12);
    dir.current.lerp(goal.dir, 0.1);
    const zoomGoal = Math.min(size.width / goal.extentW, size.height / goal.extentH);
    cam.zoom += (zoomGoal - cam.zoom) * 0.12;
    cam.position.copy(target.current).addScaledVector(dir.current.clone().normalize(), 80);
    cam.lookAt(target.current);
    cam.updateProjectionMatrix();
    const moving =
      target.current.distanceTo(goal.target) > 0.01 ||
      dir.current.distanceTo(goal.dir) > 0.001 ||
      Math.abs(zoomGoal - cam.zoom) > 0.05;
    if (moving) invalidate();
  });
  return null;
}

// Un grupo que se acerca poco a poco a su posición (los pisos se acomodan solos al reordenar o al entrar).
function Animated({ position, children }: { position: [number, number, number]; children: ReactNode }) {
  const ref = useRef<Group>(null);
  const [x, y, z] = position;
  const goal = useMemo(() => new Vector3(x, y, z), [x, y, z]);
  const { invalidate } = useThree();
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    g.position.lerp(goal, 0.15);
    if (g.position.distanceTo(goal) > 0.005) invalidate();
  });
  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  );
}

type Press = {
  id: string;
  x: number;
  y: number;
  dragging: boolean;
  offset: number;
  grab?: { x: number; z: number };
};

const releaseCapture = (e: ThreeEvent<PointerEvent>) =>
  (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
const capture = (e: ThreeEvent<PointerEvent>) =>
  (e.target as unknown as Element).setPointerCapture?.(e.pointerId);

function Scene({ building, view, selection, onSelect, onEnter, onMoveFloor, onMoveUnit }: Props) {
  const colors = useThemeColors();
  const press = useRef<Press | null>(null);
  // Mientras se arrastra se muestra el orden o la posición nueva; al soltar, el cambio pasa a quien guarda.
  const [floorDrag, setFloorDrag] = useState<{ id: string; y: number; order: string[] } | null>(null);
  const [unitDrag, setUnitDrag] = useState<{ id: string; rect: Rect } | null>(null);

  const all = useMemo(() => bounds(building.floors.flatMap((f) => f.outline)), [building.floors]);
  const savedOrder = building.floors.map((f) => f.id);
  const order = floorDrag?.order ?? savedOrder;
  const floorsById = new Map(building.floors.map((f) => [f.id, f]));
  const active = view.level === "building" ? null : (floorsById.get(view.floorId) ?? null);
  const activeApartment =
    view.level === "unit" && active ? (active.units.find((u) => u.id === view.unitId) ?? null) : null;
  const activeY = active ? order.indexOf(active.id) * FLOOR_HEIGHT : 0;

  // Hacia dónde mira la cámara: el edificio entero (isométrico) o la planta (desde arriba).
  const height = building.floors.length * FLOOR_HEIGHT;
  const area = activeApartment
    ? activeApartment.rect
    : active
      ? (() => {
          const b = bounds(active.outline);
          return { x: b.minX, z: b.minZ, width: b.w, depth: b.d };
        })()
      : null;
  const goalKey = area
    ? `${area.x},${area.z},${area.width},${area.depth},${activeY}`
    : `b${height},${all.w},${all.d}`;
  const goal = useMemo<CameraGoal>(() => {
    if (!area) {
      const extent = Math.max(all.w, all.d, 6) * 1.7 + height * 0.5;
      return {
        target: new Vector3(0, height / 2, 0),
        dir: new Vector3(1, 0.95, 1),
        extentW: extent,
        extentH: extent * 0.8,
      };
    }
    return {
      target: new Vector3(area.x + area.width / 2 - all.cx, activeY, area.z + area.depth / 2 - all.cz),
      dir: new Vector3(0, 1, 0.22),
      extentW: area.width + 3,
      extentH: area.depth + 3,
    };
    // goalKey resume todo lo que cambia el encuadre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalKey]);

  // ---- Arrastre de pisos (en el edificio): se mueven hacia arriba o abajo y cambian de nivel. ----
  const floorPlane = useMemo(() => new Plane(new Vector3(1, 0, 1).normalize(), 0), []);
  const floorDown = (e: ThreeEvent<PointerEvent>, id: string) => {
    e.stopPropagation();
    capture(e);
    const hit = new Vector3();
    e.ray.intersectPlane(floorPlane, hit);
    press.current = {
      id,
      x: e.clientX,
      y: e.clientY,
      dragging: false,
      offset: hit.y - order.indexOf(id) * FLOOR_HEIGHT,
    };
  };
  const floorMove = (e: ThreeEvent<PointerEvent>) => {
    const p = press.current;
    if (!p) return;
    if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_THRESHOLD) return;
    p.dragging = true;
    setCursor("grabbing");
    const hit = new Vector3();
    if (!e.ray.intersectPlane(floorPlane, hit)) return;
    const y = Math.min(Math.max(hit.y - p.offset, 0), (building.floors.length - 1) * FLOOR_HEIGHT);
    const next = order.filter((id) => id !== p.id);
    next.splice(Math.round(y / FLOOR_HEIGHT), 0, p.id);
    setFloorDrag({ id: p.id, y, order: next });
  };
  const floorUp = (e: ThreeEvent<PointerEvent>) => {
    releaseCapture(e);
    const p = press.current;
    press.current = null;
    if (!p?.dragging || !floorDrag) return;
    setCursor("");
    const level = floorDrag.order.indexOf(p.id) + 1;
    if (level === floorsById.get(p.id)?.level) {
      setFloorDrag(null);
      return;
    }
    // El cambio se ve al instante (optimista) y se guarda en segundo plano.
    onMoveFloor(p.id, level);
    setFloorDrag(null);
  };

  // ---- Arrastre de unidades (en la planta): en la cuadrícula de 0.1 m, sin salirse ni encimarse. ----
  const unitDown = (e: ThreeEvent<PointerEvent>, u: BuildingUnit, draggable: boolean) => {
    e.stopPropagation();
    if (!draggable) return;
    capture(e);
    const plane = new Plane(new Vector3(0, 1, 0), -(activeY + UNIT_HEIGHT));
    const hit = new Vector3();
    e.ray.intersectPlane(plane, hit);
    press.current = {
      id: u.id,
      x: e.clientX,
      y: e.clientY,
      dragging: false,
      offset: plane.constant,
      grab: { x: hit.x + all.cx - u.rect.x, z: hit.z + all.cz - u.rect.z },
    };
  };
  const unitMove = (e: ThreeEvent<PointerEvent>, u: BuildingUnit, dragArea: DragArea, others: Rect[]) => {
    const p = press.current;
    if (!p?.grab || p.id !== u.id) return;
    if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_THRESHOLD) return;
    p.dragging = true;
    setCursor("grabbing");
    const hit = new Vector3();
    if (!e.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), p.offset), hit)) return;
    const current = unitDrag?.id === u.id ? unitDrag.rect : u.rect;
    setUnitDrag({
      id: u.id,
      rect: dragTo(current, hit.x + all.cx - p.grab.x, hit.z + all.cz - p.grab.z, dragArea, others),
    });
  };
  const unitUp = (e: ThreeEvent<PointerEvent>, u: BuildingUnit) => {
    releaseCapture(e);
    const p = press.current;
    press.current = null;
    if (!p?.dragging || unitDrag?.id !== u.id) return;
    setCursor("");
    const { x, z } = unitDrag.rect;
    if (x === u.rect.x && z === u.rect.z) {
      setUnitDrag(null);
      return;
    }
    onMoveUnit(u.id, x, z);
    setUnitDrag(null);
  };
  // R3F avisa cuánto se movió el puntero entre bajar y soltar: si fue un arrastre, no cuenta como clic.
  const wasDrag = (e: ThreeEvent<MouseEvent>) => e.delta > DRAG_THRESHOLD;

  const selectedUnit = selection?.kind === "unit" ? selection.id : null;
  const selectedFloor = selection?.kind === "floor" ? selection.id : null;

  // Unidades que se ven en la planta: las del piso, o los cuartos del departamento al que se entró.
  const planUnits = activeApartment ? activeApartment.rooms : (active?.units ?? []);
  const planArea: DragArea | null = activeApartment
    ? { parent: activeApartment.rect }
    : active
      ? { outline: active.outline }
      : null;

  return (
    <>
      <CameraRig goal={goal} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[12, 30, 8]} intensity={1.3} />

      <group position={[-all.cx, 0, -all.cz]}>
        {order.map((id, slot) => {
          const f = floorsById.get(id);
          if (!f) return null;
          const isActive = active?.id === id;
          const dragging = floorDrag?.id === id;
          const hidden = view.level !== "building" && !isActive;
          const y = dragging ? floorDrag.y : slot * FLOOR_HEIGHT;
          return (
            <Animated key={id} position={[hidden ? 120 : 0, y, 0]}>
              {view.level === "building" ? (
                <FloorVolume
                  outline={f.outline}
                  color={
                    selectedFloor === id || dragging ? colors.accent : slot % 2 ? colors.bar : colors.primary
                  }
                  colors={colors}
                  label={floorName(slot + 1)}
                  onPointerDown={(e) => floorDown(e, id)}
                  onPointerMove={floorMove}
                  onPointerUp={floorUp}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!wasDrag(e)) onSelect({ kind: "floor", id });
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onEnter(enterViewFor(f));
                  }}
                />
              ) : isActive ? (
                <FloorSlab
                  outline={activeApartment ? null : f.outline}
                  rect={activeApartment?.rect}
                  colors={colors}
                />
              ) : null}
            </Animated>
          );
        })}

        {active && planArea
          ? planUnits.map((u) => {
              const rect = unitDrag?.id === u.id ? unitDrag.rect : u.rect;
              // Un departamento que ocupa todo el piso no se mueve; tampoco hay dónde.
              const draggable = !(u.type === "apartment" && u.occupiesWholeFloor);
              const others = planUnits.filter((o) => o.id !== u.id).map((o) => o.rect);
              return (
                <UnitBox
                  key={u.id}
                  rect={rect}
                  y={activeY}
                  label={u.name}
                  color={
                    selectedUnit === u.id || unitDrag?.id === u.id
                      ? colors.accent
                      : u.type === "apartment"
                        ? colors.primarySoft
                        : colors.surface
                  }
                  colors={colors}
                  lifted={unitDrag?.id === u.id}
                  onPointerDown={(e) => unitDown(e, u, draggable)}
                  onPointerMove={(e) => unitMove(e, u, planArea, others)}
                  onPointerUp={(e) => unitUp(e, u)}
                  onPointerOver={() => setCursor(draggable ? "grab" : "pointer")}
                  onPointerOut={() => setCursor("")}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!wasDrag(e)) onSelect({ kind: "unit", id: u.id });
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (u.type === "apartment" && view.level === "floor") {
                      onEnter({ level: "unit", floorId: active.id, unitId: u.id });
                    }
                  }}
                />
              );
            })
          : null}
      </group>
    </>
  );
}

type Handlers = {
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onDoubleClick: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
};

// Volumen de un piso en la vista del edificio.
function FloorVolume({
  outline,
  color,
  colors,
  label,
  ...handlers
}: { outline: OutlinePoint[]; color: string; colors: ThemeColors; label: string } & Handlers) {
  const geometry = useMemo(() => extrude(outline, FLOOR_HEIGHT - SLAB_GAP), [outline]);
  const b = bounds(outline);
  return (
    <group>
      <mesh
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        {...handlers}
        onPointerOver={() => setCursor("grab")}
        onPointerOut={() => setCursor("")}
      >
        <meshLambertMaterial color={color} />
        <Edges color={colors.border} />
      </mesh>
      <LabelSprite
        text={label}
        position={[b.maxX + 1.4, FLOOR_HEIGHT / 2, b.maxZ]}
        color={colors.text}
        background={colors.surface}
        fontFamily={colors.fontFamily}
      />
    </group>
  );
}

// Losa del piso (o del departamento) en la vista de planta.
function FloorSlab({
  outline,
  rect,
  colors,
}: {
  outline: OutlinePoint[] | null;
  rect?: Rect;
  colors: ThemeColors;
}) {
  const geometry = useMemo(() => {
    const shape = outline ?? [
      { x: rect!.x, z: rect!.z },
      { x: rect!.x + rect!.width, z: rect!.z },
      { x: rect!.x + rect!.width, z: rect!.z + rect!.depth },
      { x: rect!.x, z: rect!.z + rect!.depth },
    ];
    return extrude(shape, 0.12);
  }, [outline, rect]);
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshLambertMaterial color={colors.surface} />
      <Edges color={colors.border} />
    </mesh>
  );
}

// Una unidad en la planta: una caja con su nombre encima.
function UnitBox({
  rect,
  y,
  label,
  color,
  colors,
  lifted,
  ...handlers
}: { rect: Rect; y: number; label: string; color: string; colors: ThemeColors; lifted: boolean } & Handlers) {
  const gap = 0.06;
  const height = UNIT_HEIGHT - 0.12;
  return (
    <group
      position={[
        rect.x + rect.width / 2,
        y + 0.12 + height / 2 + (lifted ? 0.25 : 0),
        rect.z + rect.depth / 2,
      ]}
    >
      <mesh {...handlers}>
        <boxGeometry args={[Math.max(rect.width - gap, 0.1), height, Math.max(rect.depth - gap, 0.1)]} />
        <meshLambertMaterial color={color} />
        <Edges color={colors.border} />
      </mesh>
      <LabelSprite
        text={label}
        position={[0, height / 2 + 0.5, 0]}
        height={Math.min(0.7, rect.width / 3)}
        color={colors.text}
        background={colors.surface}
        fontFamily={colors.fontFamily}
      />
    </group>
  );
}

// El lienzo 3D. Clic en el vacío: quita la selección.
export function BuildingScene(props: Props) {
  return (
    <Canvas
      frameloop="demand"
      orthographic
      camera={{ position: [40, 40, 40], zoom: 20, near: 0.1, far: 1000 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => props.onSelect(null)}
      style={{ touchAction: "none" }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
