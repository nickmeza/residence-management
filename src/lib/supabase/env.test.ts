import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupabaseEnv } from "./env";

// Valores de ejemplo: no son de ningún proyecto real.
const URL_OK = "https://ejemplo.supabase.co";
const KEY = "sb_publishable_ejemplo";

describe("getSupabaseEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("devuelve la URL y la clave cuando están bien", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_OK);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);

    expect(getSupabaseEnv()).toEqual({ url: URL_OK, publishableKey: KEY });
  });

  it("avisa si falta alguna variable", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);

    expect(() => getSupabaseEnv()).toThrow(/Faltan variables de Supabase/);
  });

  it("avisa si la URL trae /rest/v1/ (el error que tuvimos en la Fase 0)", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `${URL_OK}/rest/v1/`);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);

    expect(() => getSupabaseEnv()).toThrow(/sin \/rest\/v1\//);
  });

  it("acepta la URL con una barra final", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `${URL_OK}/`);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);

    expect(getSupabaseEnv().url).toBe(`${URL_OK}/`);
  });
});
