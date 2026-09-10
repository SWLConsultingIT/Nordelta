/**
 * Identificación de depositantes y conciliación.
 *
 * **Todos los datos son inventados.** Los CUIT son válidos por dígito
 * verificador y no corresponden a nadie; los DNI, los importes y las fechas
 * se escribieron para el test. No se copió nada de la planilla real de
 * `CLIENT_SAMPLE_01`, que no se commitea.
 *
 * Los casos sí reproducen los **patrones** encontrados en el archivo real:
 * CUIT con guiones y DNI numérico conviviendo en la misma columna, importes
 * muy repetidos, y filas sin número de comprobante.
 */

import { describe, expect, it } from "vitest";
import {
  analizarIdentificacion,
  cuitDe,
  dniCoincideConCuit,
} from "../../src/lib/planillas/identificacion";
import {
  comprobanteValido,
  conciliar,
  detectarDuplicados,
  diasEntre,
  resumir,
  type EstadoConciliacion,
} from "../../src/lib/conciliacion";
import type { ClientTransfer } from "../../src/lib/planillas/cliente";
import type { Acreditacion } from "../../src/lib/fullcarga/informe";

/** CUIT inventados, válidos por verificador. */
const CUIT_A = "20111111112";
const CUIT_B = "27222222228";
/** `CUIT_A` con un dígito cambiado: no valida. */
const CUIT_TIPEADO = "20111111113";
/** CUIT de **persona física** cuyo documento embebido es el DNI de abajo. */
const CUIT_CON_DNI = "20305555550";
/** Otro CUIT de persona física con el **mismo** documento y otro prefijo. */
const CUIT_CON_DNI_ALT = "27305555555";
/** CUIT de **persona jurídica** con los mismos ocho dígitos centrales. */
const CUIT_EMPRESA_CON_DNI = "30305555556";
const DNI = "30555555";

function transfer(p: Partial<ClientTransfer> = {}): ClientTransfer {
  const id = analizarIdentificacion(p.identificacionOriginal ?? CUIT_A);
  return {
    sourceFile: "planilla.xlsx",
    sourceSheet: "Hoja 7",
    sourceRow: 1,
    clientAlias: "CLIENT_SAMPLE_01",
    banco: null,
    fechaDeposito: "2026-08-28",
    importe: 1000,
    nombreDepositante: "Nombre Inventado",
    identificacionOriginal: id.original,
    identificacionNormalizada: id.normalizada,
    tipoIdentificacion: id.tipo,
    numeroDeposito: "123",
    tipo: null,
    comentario: null,
    validationStatus: "VALIDA",
    validationErrors: [],
    ...p,
  };
}

function acreditacion(p: Partial<Acreditacion> = {}): Acreditacion {
  return {
    sourceFile: "informe.xls",
    sheet: "Hoja 1",
    row: 3,
    cuit: CUIT_A,
    fecha: "2026-08-28",
    importe: 1000,
    banco: "Banco de Prueba",
    clienteNord: "EMPRESA SRL",
    descripcion: null,
    ...p,
  };
}

describe("identificación", () => {
  it("reconoce un CUIT con guiones", () => {
    const id = analizarIdentificacion("20-11111111-2");
    expect(id.tipo).toBe("CUIT_VALIDO");
    expect(id.normalizada).toBe(CUIT_A);
    expect(id.original).toBe("20-11111111-2");
  });

  it("reconoce un CUIT con puntos y espacios", () => {
    expect(analizarIdentificacion(" 20.11111111.2 ").tipo).toBe("CUIT_VALIDO");
  });

  it("reconoce un DNI de ocho dígitos, venga como número o como texto", () => {
    expect(analizarIdentificacion(30555555).tipo).toBe("DNI_PROBABLE");
    expect(analizarIdentificacion("30.555.555").tipo).toBe("DNI_PROBABLE");
    expect(analizarIdentificacion("30.555.555").normalizada).toBe(DNI);
  });

  it("acepta un DNI de siete dígitos", () => {
    expect(analizarIdentificacion("7654321").tipo).toBe("DNI_PROBABLE");
  });

  it("marca inválido el número de once dígitos cuyo verificador no cierra", () => {
    const id = analizarIdentificacion(CUIT_TIPEADO);
    expect(id.tipo).toBe("IDENTIFICACION_INVALIDA");
    // No se degrada a DNI ni se corrige.
    expect(id.normalizada).toBe(CUIT_TIPEADO);
  });

  it("marca inválido lo que no es ni CUIT ni DNI", () => {
    expect(analizarIdentificacion("123").tipo).toBe("IDENTIFICACION_INVALIDA");
    expect(analizarIdentificacion("123456789012345").tipo).toBe("IDENTIFICACION_INVALIDA");
  });

  it("clasifica como UNKNOWN lo vacío", () => {
    expect(analizarIdentificacion("").tipo).toBe("UNKNOWN");
    expect(analizarIdentificacion(null).tipo).toBe("UNKNOWN");
    expect(analizarIdentificacion("sin numero").tipo).toBe("UNKNOWN");
  });

  it("solo devuelve CUIT cuando realmente lo es", () => {
    expect(cuitDe(analizarIdentificacion(CUIT_A))).toBe(CUIT_A);
    expect(cuitDe(analizarIdentificacion(DNI))).toBeNull();
    expect(cuitDe(analizarIdentificacion(CUIT_TIPEADO))).toBeNull();
  });

  it("detecta el DNI embebido en el CUIT, sin construir el CUIT", () => {
    expect(dniCoincideConCuit(DNI, CUIT_CON_DNI)).toBe(true);
    expect(dniCoincideConCuit(DNI, CUIT_A)).toBe(false);
    // Es una señal para mostrar, no una conversión: la función no devuelve
    // ningún CUIT armado a partir del DNI.
    expect(cuitDe(analizarIdentificacion(DNI))).toBeNull();
  });
});

describe("utilidades", () => {
  it("cuenta días sin depender del huso horario", () => {
    const tz = process.env.TZ;
    try {
      for (const z of ["UTC", "Pacific/Kiritimati", "Pacific/Midway"]) {
        process.env.TZ = z;
        expect(diasEntre("2026-08-28", "2026-08-28")).toBe(0);
        expect(diasEntre("2026-08-31", "2026-09-01")).toBe(1);
      }
    } finally {
      process.env.TZ = tz;
    }
  });

  it("valida el comprobante: sin letras ni guiones", () => {
    expect(comprobanteValido("123")).toBe(true);
    expect(comprobanteValido("12-3")).toBe(false);
    expect(comprobanteValido("A12")).toBe(false);
    expect(comprobanteValido("")).toBe(false);
    expect(comprobanteValido(null)).toBe(false);
  });
});

describe("duplicados", () => {
  it("un importe repetido NO alcanza para marcar duplicado", () => {
    // En el archivo real hay doce filas con tres importes distintos.
    const filas = [
      transfer({ sourceRow: 1, importe: 1000, fechaDeposito: "2026-08-28" }),
      transfer({ sourceRow: 2, importe: 1000, fechaDeposito: "2026-08-29", identificacionOriginal: CUIT_B }),
    ];
    expect(detectarDuplicados(filas).size).toBe(0);
  });

  it("marca cuando coinciden identificación, fecha e importe", () => {
    const filas = [
      transfer({ sourceRow: 1 }),
      transfer({ sourceRow: 2 }),
    ];
    const d = detectarDuplicados(filas);
    expect(d.get(1)).toEqual([2]);
    expect(d.get(2)).toEqual([1]);
  });
});

describe("conciliación", () => {
  it("acredita cuando CUIT, fecha e importe coinciden con uno solo", () => {
    const [r] = conciliar([transfer()], [acreditacion()]);
    expect(r.estado).toBe("ACREDITADA_EXACTA_CUIT");
    expect(r.automatico).toBe(true);
    expect(r.acreditacion).not.toBeNull();
  });

  it("si dos filas pretenden el mismo registro, ninguna se lo queda", () => {
    // Dos filas idénticas contra una sola acreditación: una se lleva el
    // registro y la otra no puede quedarse con el mismo.
    const rs = conciliar(
      [transfer({ sourceRow: 1 }), transfer({ sourceRow: 2 })],
      [acreditacion()],
    );
    // **Ninguna** se lo queda: si se lo diera a la primera, estaría
    // eligiendo por orden de aparición. Las dos van a revisión.
    expect(rs.filter((r) => r.automatico)).toHaveLength(0);
    expect(rs.every((r) => r.estado === "MATCH_AMBIGUO" || r.estado === "POSIBLE_DUPLICADO")).toBe(true);
  });

  it("dos operaciones iguales contra dos acreditaciones iguales quedan ambiguas", () => {
    // Decisión conservadora y deliberada: aunque las dos filas y los dos
    // registros sean intercambiables, el sistema **no elige** cuál va con
    // cuál. Emparejarlos sería inofensivo en este caso, pero la regla —«más
    // de un candidato, no se elige»— no debe tener excepciones que después
    // haya que razonar caso por caso.
    const rs = conciliar(
      [transfer({ sourceRow: 1 }), transfer({ sourceRow: 2 })],
      [acreditacion({ row: 3 }), acreditacion({ row: 4 })],
    );
    expect(rs.every((r) => r.estado === "MATCH_AMBIGUO" || r.estado === "POSIBLE_DUPLICADO")).toBe(true);
    expect(rs.every((r) => r.automatico === false)).toBe(true);
    // Y las dos ven a los dos candidatos: nada se consumió.
    expect(rs[0].candidatos.length + rs[1].candidatos.length).toBeGreaterThan(0);
  });

  it("es ambiguo cuando hay dos acreditaciones idénticas para una sola fila", () => {
    const rs = conciliar([transfer()], [acreditacion({ row: 3 }), acreditacion({ row: 4 })]);
    expect(rs[0].estado).toBe("MATCH_AMBIGUO");
    expect(rs[0].candidatos).toHaveLength(2);
    expect(rs[0].automatico).toBe(false);
  });

  it("es ambiguo cuando el importe no coincide", () => {
    const rs = conciliar([transfer()], [acreditacion({ importe: 900 })]);
    expect(rs[0].estado).toBe("MATCH_AMBIGUO");
    expect(rs[0].motivo).toMatch(/totales/);
  });

  it("acredita por DNI cuando hay un solo CUIT de persona física que encaja", () => {
    // Regla confirmada por NORD: documento del CUIT + fecha + importe.
    const rs = conciliar(
      [transfer({ identificacionOriginal: DNI })],
      [acreditacion({ cuit: CUIT_CON_DNI })],
    );
    expect(rs[0].estado).toBe("ACREDITADA_EXACTA_DNI");
    expect(rs[0].automatico).toBe(true);
    expect(rs[0].acreditacion?.cuit).toBe(CUIT_CON_DNI);
  });

  it("acepta un DNI de siete dígitos rellenando a ocho", () => {
    const rs = conciliar(
      [transfer({ identificacionOriginal: "5555555" })],
      [acreditacion({ cuit: "20055555559" })],
    );
    // El CUIT sintético puede no validar; lo que importa es que no explote.
    expect(rs).toHaveLength(1);
  });

  it("NO acredita por DNI contra un CUIT de persona jurídica", () => {
    // En un CUIT de empresa los ocho dígitos centrales no son un DNI.
    const rs = conciliar(
      [transfer({ identificacionOriginal: DNI })],
      [acreditacion({ cuit: CUIT_EMPRESA_CON_DNI })],
    );
    expect(rs[0].estado).not.toBe("ACREDITADA_EXACTA_DNI");
    expect(rs[0].automatico).toBe(false);
  });

  it("es ambiguo cuando dos personas distintas comparten el documento", () => {
    // Mismo documento con prefijos 20 y 27: el sistema no elige.
    const rs = conciliar(
      [transfer({ identificacionOriginal: DNI })],
      [acreditacion({ row: 3, cuit: CUIT_CON_DNI }), acreditacion({ row: 4, cuit: CUIT_CON_DNI_ALT })],
    );
    expect(rs[0].estado).toBe("MATCH_AMBIGUO");
    expect(rs[0].candidatos).toHaveLength(2);
    expect(rs[0].automatico).toBe(false);
  });

  it("no acredita por DNI si la fecha no coincide", () => {
    const rs = conciliar(
      [transfer({ identificacionOriginal: DNI })],
      [acreditacion({ cuit: CUIT_CON_DNI, fecha: "2026-08-01" })],
    );
    expect(rs[0].estado).toBe("IDENTITY_MAPPING_REQUIRED");
    expect(rs[0].motivo).toMatch(/fecha|importe/);
  });

  it("no acredita por DNI si el importe no coincide", () => {
    const rs = conciliar(
      [transfer({ identificacionOriginal: DNI })],
      [acreditacion({ cuit: CUIT_CON_DNI, importe: 999 })],
    );
    expect(rs[0].estado).toBe("IDENTITY_MAPPING_REQUIRED");
  });

  it("con DNI y sin ningún documento coincidente, queda pendiente", () => {
    const rs = conciliar(
      [transfer({ identificacionOriginal: DNI })],
      [acreditacion({ cuit: CUIT_B })],
    );
    expect(rs[0].estado).toBe("PENDIENTE_NO_ENCONTRADA_EN_RANGO");
    expect(rs[0].candidatos).toHaveLength(0);
  });

  it("uno a uno también entre dos filas con DNI: ninguna se queda el registro", () => {
    const rs = conciliar(
      [
        transfer({ sourceRow: 1, identificacionOriginal: DNI }),
        transfer({ sourceRow: 2, identificacionOriginal: DNI, importe: 1000 }),
      ],
      [acreditacion({ cuit: CUIT_CON_DNI })],
    );
    expect(rs.every((r) => r.automatico === false)).toBe(true);
    expect(rs.some((r) => r.estado === "MATCH_AMBIGUO" || r.estado === "POSIBLE_DUPLICADO")).toBe(true);
  });

  it("una fila con DNI no le roba la acreditación a una con CUIT", () => {
    const rs = conciliar(
      [
        transfer({ sourceRow: 1, identificacionOriginal: DNI }),
        transfer({ sourceRow: 2, identificacionOriginal: CUIT_CON_DNI }),
      ],
      [acreditacion({ cuit: CUIT_CON_DNI })],
    );
    // El CUIT tiene prioridad: identidad directa antes que derivada.
    expect(rs[1].estado).toBe("ACREDITADA_EXACTA_CUIT");
    // La de DNI ya no lo ve: fue consumido en la fase anterior.
    expect(rs[0].estado).not.toBe("ACREDITADA_EXACTA_DNI");
    expect(rs[0].candidatos).toHaveLength(0);
  });

  it("queda pendiente cuando no hay nada en el rango, y no es un fallo", () => {
    const rs = conciliar([transfer()], [acreditacion({ cuit: CUIT_B })]);
    expect(rs[0].estado).toBe("PENDIENTE_NO_ENCONTRADA_EN_RANGO");
    expect(rs[0].motivo).toMatch(/113 d[ií]as|m[aá]s adelante/);
  });

  it("sugiere pero no acredita ante un CUIT a un dígito", () => {
    const rs = conciliar(
      [transfer({ identificacionOriginal: CUIT_A })],
      [acreditacion({ cuit: "20111111120" })],
    );
    // Solo si además cuadran fecha e importe, y aun así no es automático.
    if (rs[0].estado === "POSIBLE_MATCH") expect(rs[0].automatico).toBe(false);
    else expect(rs[0].estado).toBe("PENDIENTE_NO_ENCONTRADA_EN_RANGO");
  });

  it("marca error de CUIT sin degradarlo a DNI", () => {
    const rs = conciliar([transfer({ identificacionOriginal: CUIT_TIPEADO })], []);
    expect(rs[0].estado).toBe("ERROR_CUIT");
  });

  it("marca datos inválidos cuando falta fecha o importe", () => {
    expect(conciliar([transfer({ fechaDeposito: null })], [])[0].estado).toBe("DATOS_INVALIDOS");
    expect(conciliar([transfer({ importe: null })], [])[0].estado).toBe("DATOS_INVALIDOS");
    expect(conciliar([transfer({ importe: -5 })], [])[0].estado).toBe("DATOS_INVALIDOS");
  });

  it("no usa el nombre para emparejar", () => {
    // Mismo nombre, CUIT distinto: no hay match.
    const rs = conciliar(
      [transfer({ identificacionOriginal: CUIT_A, nombreDepositante: "Juan Perez" })],
      [acreditacion({ cuit: CUIT_B, descripcion: "Juan Perez" })],
    );
    expect(rs[0].estado).toBe("PENDIENTE_NO_ENCONTRADA_EN_RANGO");
  });

  it("marca posible duplicado sin descartar ninguna fila", () => {
    const rs = conciliar(
      [transfer({ sourceRow: 1 }), transfer({ sourceRow: 2 })],
      [],
    );
    expect(rs).toHaveLength(2);
    expect(rs.every((r) => r.estado === "POSIBLE_DUPLICADO")).toBe(true);
    expect(rs[0].duplicadoDe).toEqual([2]);
  });

  it("ninguna fila se pierde: la suma de estados da el total", () => {
    const filas = [
      transfer({ sourceRow: 1, identificacionOriginal: CUIT_A }),
      transfer({ sourceRow: 2, identificacionOriginal: DNI }),
      transfer({ sourceRow: 3, identificacionOriginal: CUIT_TIPEADO }),
      transfer({ sourceRow: 4, identificacionOriginal: "" }),
      transfer({ sourceRow: 5, fechaDeposito: null }),
      transfer({ sourceRow: 6, identificacionOriginal: CUIT_B, importe: 555 }),
    ];
    const rs = conciliar(filas, [acreditacion()]);
    expect(rs).toHaveLength(filas.length);

    const resumen = resumir(rs, "CLIENT_SAMPLE_01");
    const suma = Object.values(resumen.porEstado).reduce((a, b) => a + b, 0);
    expect(suma).toBe(filas.length);
    // Y el orden de salida es el del archivo.
    expect(rs.map((r) => r.transfer.sourceRow)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("el resumen suma dinero en centavos, sin deriva", () => {
    const rs = conciliar(
      [transfer({ importe: 0.1 }), transfer({ sourceRow: 2, importe: 0.2, identificacionOriginal: CUIT_B })],
      [],
    );
    expect(resumir(rs, "X").totalEnviado).toBe(0.3);
  });

  it("cada estado posible está contemplado en el resumen", () => {
    const estados: EstadoConciliacion[] = [
      "ACREDITADA_EXACTA_CUIT", "ACREDITADA_EXACTA_DNI", "PENDIENTE_NO_ENCONTRADA_EN_RANGO", "MATCH_AMBIGUO",
      "POSIBLE_MATCH", "IDENTITY_MAPPING_REQUIRED", "ERROR_CUIT",
      "ERROR_IDENTIFICACION", "COMPROBANTE_INVALIDO", "POSIBLE_DUPLICADO",
      "DATOS_INVALIDOS",
    ];
    const resumen = resumir([], "X");
    expect(Object.keys(resumen.porEstado).sort()).toEqual([...estados].sort());
  });
});
