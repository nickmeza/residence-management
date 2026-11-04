// Nombre y orden de los pisos. El nombre "Piso N" se calcula del nivel; no se guarda.

export const floorName = (level: number) => `Piso ${level}`;

// Mueve el piso de la posición `from` a `to` y renumera todos del 1 en adelante.
// Devuelve el nuevo nivel de cada piso, en el orden nuevo.
export function reorderFloors<T extends { id: string }>(
  floors: T[],
  from: number,
  to: number,
): { id: string; level: number }[] {
  if (from < 0 || from >= floors.length || to < 0 || to >= floors.length) {
    throw new RangeError("Posición de piso fuera de rango.");
  }
  const order = [...floors];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  return order.map((floor, index) => ({ id: floor.id, level: index + 1 }));
}

// Deja los niveles seguidos (1, 2, 3…) respetando el orden actual, por ejemplo después de borrar un piso.
export function renumberFloors<T extends { id: string; level: number }>(
  floors: T[],
): { id: string; level: number }[] {
  return [...floors]
    .sort((a, b) => a.level - b.level)
    .map((floor, index) => ({ id: floor.id, level: index + 1 }));
}
