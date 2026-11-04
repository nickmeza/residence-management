import { describe, expect, it } from "vitest";

import { decideMode } from "./view-mode";

describe("modo con el que se abre el edificio", () => {
  it("sin 3D posible, siempre Simple", () => {
    expect(decideMode({ saved: "3d", webgl: false })).toEqual({ mode: "simple", notice: "no_webgl" });
  });

  it("respeta lo que la persona eligió antes", () => {
    expect(decideMode({ saved: "simple", webgl: true, cores: 16 })).toEqual({ mode: "simple", notice: null });
    expect(decideMode({ saved: "3d", webgl: true, cores: 2 })).toEqual({ mode: "3d", notice: null });
  });

  it("la primera vez: 3D, salvo equipo lento", () => {
    expect(decideMode({ saved: null, webgl: true, cores: 8, memoryGb: 8 })).toEqual({
      mode: "3d",
      notice: null,
    });
    expect(decideMode({ saved: null, webgl: true, cores: 4 })).toEqual({
      mode: "simple",
      notice: "slow_device",
    });
    expect(decideMode({ saved: null, webgl: true, cores: 8, memoryGb: 2 }).notice).toBe("slow_device");
  });

  it("si el navegador no informa del equipo, abre en 3D", () => {
    expect(decideMode({ saved: null, webgl: true })).toEqual({ mode: "3d", notice: null });
  });
});
