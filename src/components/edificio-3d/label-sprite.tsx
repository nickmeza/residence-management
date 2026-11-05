"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

// Etiqueta de texto dentro del 3D (por ejemplo "Piso 2"), como en el prototipo: el texto se pinta en una
// imagen que siempre mira a la cámara. No usa <Html> de drei: ese crea otra raíz de React y, al desmontarse
// mientras React dibuja, provoca el aviso "Attempted to synchronously unmount a root".
export function LabelSprite({
  text,
  position,
  color,
  background,
  fontFamily,
  height = 0.9,
}: {
  text: string;
  position: [number, number, number];
  color: string;
  background: string;
  fontFamily: string;
  // Alto de la etiqueta en metros de la escena.
  height?: number;
}) {
  const { texture, aspect } = useMemo(() => {
    const scale = 4; // más píxeles para que el texto se vea nítido
    const fontSize = 28 * scale;
    const padX = 14 * scale;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const font = `700 ${fontSize}px ${fontFamily}`;
    ctx.font = font;
    const width = Math.ceil(ctx.measureText(text).width + padX * 2);
    const h = Math.ceil(fontSize * 1.6);
    canvas.width = width;
    canvas.height = h;
    ctx.font = font;
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, h, h / 3);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(text, width / 2, h / 2 + scale);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    return { texture: t, aspect: width / h };
  }, [text, color, background, fontFamily]);

  // La imagen ocupa memoria de la tarjeta gráfica: se libera al cambiar o desaparecer la etiqueta.
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}
