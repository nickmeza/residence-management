import { describe, expect, it } from "vitest";

import { greetingFor, greetingName, initials } from "./greeting";

// Lima está en UTC−5 todo el año: las 13:00 UTC son las 8:00 en Lima.
const lima = (hour: number) => new Date(Date.UTC(2026, 10, 4, hour + 5, 0));

describe("saludo según la hora de Lima", () => {
  it("días, tardes y noches", () => {
    expect(greetingFor(lima(8))).toBe("Buenos días");
    expect(greetingFor(lima(12))).toBe("Buenas tardes");
    expect(greetingFor(lima(18))).toBe("Buenas tardes");
    expect(greetingFor(lima(19))).toBe("Buenas noches");
    expect(greetingFor(lima(2))).toBe("Buenas noches");
  });
});

describe("nombre e iniciales", () => {
  it("usa nombre y primer apellido, y las iniciales del primero y el último", () => {
    expect(greetingName("  Nick  Meza Ramos ")).toBe("Nick Meza");
    expect(greetingName("Nick")).toBe("Nick");
    expect(initials("Carlos Ramos")).toBe("CR");
    expect(initials("carlos")).toBe("C");
  });
});
