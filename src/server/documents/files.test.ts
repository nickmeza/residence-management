import { describe, expect, it } from "vitest";

import { DEFAULT_LIMITS, fileProblem, folderPath, isFolderPathOf, isPathOf, storagePath } from "./files";

const MB = 1024 * 1024;

describe("archivos de documentos", () => {
  it("acepta PDF y fotos dentro del tamaño", () => {
    expect(fileProblem({ mimeType: "application/pdf", sizeBytes: MB }, DEFAULT_LIMITS)).toBeNull();
    expect(fileProblem({ mimeType: "image/heic", sizeBytes: MB }, DEFAULT_LIMITS)).toBeNull();
  });

  it("respeta los formatos y el tamaño del requisito", () => {
    const onlyPdf = { acceptedFormats: ["pdf" as const], maxSizeMb: 5 };
    expect(fileProblem({ mimeType: "image/jpeg", sizeBytes: MB }, onlyPdf)).toBe("Solo se acepta PDF.");
    expect(fileProblem({ mimeType: "application/pdf", sizeBytes: 6 * MB }, onlyPdf)).toMatch(/más de 5 MB/);
  });

  it("rechaza otros tipos y archivos vacíos", () => {
    expect(fileProblem({ mimeType: "application/zip", sizeBytes: MB }, DEFAULT_LIMITS)).toMatch(/PDF o foto/);
    expect(fileProblem({ mimeType: "application/pdf", sizeBytes: 0 }, DEFAULT_LIMITS)).toMatch(/vacío/);
  });

  it("la ruta lleva negocio y ficha, y no se acepta una ruta de otra ficha", () => {
    const id = "0b9c2c5e-6a3e-4e7b-9a43-3d1f5d2c9a10";
    const path = storagePath("neg", "ficha", id, "image/jpeg");
    expect(path).toBe(`neg/ficha/${id}.jpg`);
    expect(isPathOf(path, "neg", "ficha")).toBe(true);
    expect(isPathOf(path, "neg", "otra")).toBe(false);
    expect(isPathOf(`neg/ficha/../otra/${id}.jpg`, "neg", "ficha")).toBe(false);
  });
});

describe("archivos de cobros y garantía", () => {
  const biz = "11111111-1111-4111-8111-111111111111";
  const res = "22222222-2222-4222-8222-222222222222";
  const file = "33333333-3333-4333-8333-333333333333";

  it("van en una carpeta aparte dentro de la ficha", () => {
    const path = folderPath(biz, res, "comprobantes", file, "image/png");
    expect(path).toBe(`${biz}/${res}/comprobantes/${file}.png`);
    expect(isFolderPathOf(path, biz, res, "comprobantes")).toBe(true);
    expect(isFolderPathOf(path, biz, res, "ingreso")).toBe(false);
    expect(isFolderPathOf(`${biz}/${res}/${file}.png`, biz, res, "comprobantes")).toBe(false);
    expect(isFolderPathOf(`${biz}/otra/comprobantes/${file}.png`, biz, res, "comprobantes")).toBe(false);
  });
});
