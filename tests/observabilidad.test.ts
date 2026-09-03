import { afterEach, describe, expect, it, vi } from "vitest";
import { registrar, conObservabilidad, nuevaCorrelacion } from "@/lib/observabilidad";
import { ErrorValidacion } from "@/lib/domain/errors";

function capturar() {
  const lineas: string[] = [];
  const spies = (["log", "warn", "error"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation((l) => { lineas.push(String(l)); }),
  );
  return { lineas, restaurar: () => spies.forEach((s) => s.mockRestore()) };
}

afterEach(() => vi.restoreAllMocks());

describe("observabilidad · registra lo necesario para investigar", () => {
  it("emite una línea de JSON con lo mínimo para rastrear un incidente", () => {
    const { lineas, restaurar } = capturar();
    registrar("info", "carga.guardar", {
      correlacion: "abc", usuario: "u-1", contexto: { movimiento_id: 42, filas: 3 },
    });
    restaurar();

    const e = JSON.parse(lineas[0]);
    expect(e.accion).toBe("carga.guardar");
    expect(e.correlacion).toBe("abc");
    expect(e.usuario).toBe("u-1");
    expect(e.contexto).toEqual({ movimiento_id: 42, filas: 3 });
    expect(typeof e.momento).toBe("string");
  });

  it("registra la clase y el código del error, no su mensaje", () => {
    const { lineas, restaurar } = capturar();
    registrar("error", "carga.guardar", {
      correlacion: "abc",
      error: new ErrorValidacion("El monto 4.455.000 no es válido", "monto"),
    });
    restaurar();

    const e = JSON.parse(lineas[0]);
    expect(e.claseError).toBe("ErrorValidacion");
    expect(e.codigoError).toBe("VALIDACION");
    // El mensaje puede traer importes: no se registra.
    expect(lineas[0]).not.toContain("4.455.000");
  });
});

describe("observabilidad · no registra lo que no debe", () => {
  const sensibles = {
    password: "hunter2",
    token: "eyJhbGciOi...",
    authorization: "Bearer x",
    service_role: "clave",
    monto: 4455000,
    saldo: 1500,
    contraparte: "Comercial del Plata SA",
    concepto: "Préstamo en pesos",
    email: "alguien@nordelta.com",
  };

  it("omite el valor de todo campo sensible", () => {
    const { lineas, restaurar } = capturar();
    registrar("info", "x", { correlacion: "c", contexto: sensibles });
    restaurar();

    const e = JSON.parse(lineas[0]);
    for (const k of Object.keys(sensibles)) {
      expect(e.contexto[k]).toBe("[omitido]");
    }
    for (const v of ["hunter2", "eyJhbGciOi", "4455000", "Comercial del Plata", "@nordelta.com"]) {
      expect(lineas[0]).not.toContain(v);
    }
  });

  it("deja pasar los identificadores, que son lo que sirve para investigar", () => {
    const { lineas, restaurar } = capturar();
    registrar("info", "x", {
      correlacion: "c", contexto: { movimiento_id: 99, oficina_id: 1, partidas: 3 },
    });
    restaurar();
    const e = JSON.parse(lineas[0]);
    expect(e.contexto).toEqual({ movimiento_id: 99, oficina_id: 1, partidas: 3 });
  });

  it("no vuelca objetos anidados, que es por donde se filtran datos", () => {
    const { lineas, restaurar } = capturar();
    registrar("info", "x", { correlacion: "c", contexto: { fila: { monto: 1, cliente: "X" } } });
    restaurar();
    expect(JSON.parse(lineas[0]).contexto.fila).toBe("[no escalar]");
  });

  it("recorta las cadenas largas", () => {
    const { lineas, restaurar } = capturar();
    registrar("info", "x", { correlacion: "c", contexto: { ruta: "a".repeat(500) } });
    restaurar();
    expect(JSON.parse(lineas[0]).contexto.ruta.length).toBeLessThanOrEqual(121);
  });
});

describe("conObservabilidad", () => {
  it("mide la duración y devuelve el resultado", async () => {
    const { lineas, restaurar } = capturar();
    const r = await conObservabilidad("accion.ok", {}, async () => 7);
    restaurar();
    expect(r).toBe(7);
    const e = JSON.parse(lineas[0]);
    expect(e.nivel).toBe("info");
    expect(typeof e.duracionMs).toBe("number");
  });

  it("registra el fallo y lo vuelve a lanzar: registrar no es manejar", async () => {
    const { lineas, restaurar } = capturar();
    await expect(
      conObservabilidad("accion.mal", { usuario: "u" }, async () => {
        throw new ErrorValidacion("no", "campo");
      }),
    ).rejects.toThrow(ErrorValidacion);
    restaurar();
    const e = JSON.parse(lineas[0]);
    expect(e.nivel).toBe("error");
    expect(e.claseError).toBe("ErrorValidacion");
  });

  it("cada invocación tiene su propia correlación", async () => {
    const a = nuevaCorrelacion();
    const b = nuevaCorrelacion();
    expect(a).not.toBe(b);
  });
});
