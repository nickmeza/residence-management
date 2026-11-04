"use client";

import { Bounds, Edges, OrthographicCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { ExtrudeGeometry, Shape, Vector2 } from "three";

import type { OutlinePoint } from "@/db/schema";
import { floorName } from "@/server/building/floors";

import { LabelSprite } from "./label-sprite";
import { useThemeColors, type ThemeColors } from "./use-theme-colors";

// Medidas del dibujo, en metros. La altura de cada piso es solo para verlo; no se guarda.
export const FLOOR_HEIGHT = 2.6;
const SLAB_GAP = 0.15;

export type SceneFloor = { id: string; level: number; outline: OutlinePoint[] };

// Volumen de un piso: la forma de su losa (rectángulo, L…) levantada hasta la altura del piso.
// La forma se dibuja en el plano x/z: Shape trabaja en x/y, así que se usa y = −z y se gira el volumen.
function floorGeometry(outline: OutlinePoint[]) {
  const shape = new Shape(outline.map((p) => new Vector2(p.x, -p.z)));
  return new ExtrudeGeometry(shape, { depth: FLOOR_HEIGHT - SLAB_GAP, bevelEnabled: false });
}

function FloorBlock({
  floor,
  color,
  colors,
  label,
}: {
  floor: SceneFloor;
  color: string;
  colors: ThemeColors;
  label: string;
}) {
  const geometry = useMemo(() => floorGeometry(floor.outline), [floor.outline]);
  const xs = floor.outline.map((p) => p.x);
  const zs = floor.outline.map((p) => p.z);
  const y = (floor.level - 1) * FLOOR_HEIGHT;
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshLambertMaterial color={color} />
        <Edges color={colors.border} />
      </mesh>
      {/* Etiqueta "Piso N" junto a la esquina del piso. */}
      <LabelSprite
        text={label}
        position={[Math.max(...xs) + 1.4, FLOOR_HEIGHT / 2, Math.max(...zs)]}
        color={colors.text}
        background={colors.surface}
        fontFamily={colors.fontFamily}
      />
    </group>
  );
}

// Escena del edificio: pisos apilados en vista isométrica, como el prototipo.
export function BuildingScene({ floors }: { floors: SceneFloor[] }) {
  const colors = useThemeColors();

  // Centra el edificio en el origen para que la cámara lo encuadre bien.
  const center = useMemo(() => {
    const pts = floors.flatMap((f) => f.outline);
    if (!pts.length) return { x: 0, z: 0, size: 6 };
    const xs = pts.map((p) => p.x);
    const zs = pts.map((p) => p.z);
    const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, size: Math.max(maxX - minX, maxZ - minZ, 6) };
  }, [floors]);

  return (
    <Canvas frameloop="demand" shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <OrthographicCamera makeDefault position={[30, 30, 30]} zoom={20} near={0.1} far={500} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[12, 30, 8]} intensity={1.4} castShadow />
      <Bounds fit observe margin={1.25}>
        <group position={[-center.x, 0, -center.z]}>
          {floors.map((f) => (
            <FloorBlock
              key={f.id}
              floor={f}
              color={f.level % 2 ? colors.primary : colors.bar}
              colors={colors}
              label={floorName(f.level)}
            />
          ))}
        </group>
      </Bounds>
      {/* Suelo */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[center.size * 2.2, 0.1, center.size * 2.2]} />
        <meshLambertMaterial color={colors.surface} />
      </mesh>
    </Canvas>
  );
}
