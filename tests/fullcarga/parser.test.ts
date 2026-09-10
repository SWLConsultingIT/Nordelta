/**
 * Parser del informe de Fullcarga.
 *
 * **Todos los datos de este archivo son inventados.** Los CUIT son válidos
 * por dígito verificador pero no corresponden a nadie; los nombres, los
 * importes y las observaciones se escribieron para el test. No se copió nada
 * del archivo real, que tiene datos de terceros y no se commitea.
 */

import { describe, expect, it } from "vitest";
import {
  analizarCuit,
  cuitsParecidos,
  digitoVerificador,
  digitosDiferentes,
  normalizarCuit,
  tieneFormatoCuit,
  verificaDigito,
} from "../../src/lib/fullcarga/cuit";
import {
  candidatosACuit,
  fechaDeObservacion,
  leerObservacion,
  operacionDeObservacion,
} from "../../src/lib/fullcarga/observacion";
import {
  acreditacionesConciliables,
  clasificarFila,
  fechaDeCelda,
  medirCobertura,
  parsearInforme,
} from "../../src/lib/fullcarga/informe";
import { leerLibro } from "../../src/lib/fullcarga/xls";
import { FullcargaInvalidReportError } from "../../src/lib/fullcarga/errores";
import {
  armarXls,
  ENCABEZADOS,
  filaAcreditacion,
  informeSintetico,
} from "../../src/lib/fullcarga/escritor-xls";

/** CUIT inventados, válidos por dígito verificador. */
const CUIT_A = "20111111112";
const CUIT_B = "27222222228";
const CUIT_EMPRESA = "30123456781";
/** Igual a CUIT_A pero con un dígito cambiado; no valida. */
const CUIT_TIPEADO = "20111111113";

const obs = (cuit: string, nombre = "Juan Perez", fecha = "05/09/2026") =>
  `${fecha} - Transferencia Recibida  - De ${nombre} / - Var / ${cuit}`;

describe("lector de XLS", () => {
  it("lee celdas de texto y numéricas de un libro sintético", () => {
    const bytes = armarXls({
      nombre: "Hoja 1",
      filas: [
        ["encabezado", "otro"],
        ["texto", 1234.56],
        [null, -7],
      ],
    });
    const [hoja] = leerLibro(bytes);
    expect(hoja.nombre).toBe("Hoja 1");
    expect(hoja.celdas.get("0,0")).toBe("encabezado");
    expect(hoja.celdas.get("1,0")).toBe("texto");
    expect(hoja.celdas.get("1,1")).toBeCloseTo(1234.56, 6);
    expect(hoja.celdas.get("2,1")).toBe(-7);
    expect(hoja.celdas.has("2,0")).toBe(false);
  });

  it("lee un stream chico, que vive en el mini-stream", () => {
    // Un informe de un día sin movimientos entra por este camino. Sin este
    // caso, se rompería en producción sin que ningún test lo notara.
    const bytes = armarXls({ nombre: "Hoja 1", filas: [["solo", "dos"]] }, true);
    expect(bytes.length).toBeLessThan(8192);
    const [hoja] = leerLibro(bytes);
    expect(hoja.celdas.get("0,0")).toBe("solo");
    expect(hoja.celdas.get("0,1")).toBe("dos");
  });

  it("rechaza un .xlsx con un mensaje que lo dice", () => {
    const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]);
    expect(() => leerLibro(zip)).toThrow(/xlsx/i);
  });

  it("rechaza un archivo que no es OLE2", () => {
    expect(() => leerLibro(Buffer.from("no soy un xls"))).toThrow(FullcargaInvalidReportError);
  });
});

describe("CUIT", () => {
  it("normaliza quitando guiones, puntos y espacios", () => {
    expect(normalizarCuit("20-11111111-2")).toBe(CUIT_A);
    expect(normalizarCuit(" 20 11111111 2 ")).toBe(CUIT_A);
    expect(normalizarCuit("20.111.111.112")).toBe(CUIT_A);
  });

  it("distingue formato de validación", () => {
    expect(tieneFormatoCuit(CUIT_TIPEADO)).toBe(true); // once dígitos
    expect(verificaDigito(CUIT_TIPEADO)).toBe(false); // pero no cierra
    expect(verificaDigito(CUIT_A)).toBe(true);
  });

  it("calcula el dígito verificador", () => {
    expect(digitoVerificador("2011111111")).toBe(2);
    expect(digitoVerificador("3012345678")).toBe(1);
  });

  it("clasifica en válido, inválido y no encontrado", () => {
    expect(analizarCuit("20-11111111-2").estado).toBe("VALIDO");
    expect(analizarCuit(CUIT_TIPEADO).estado).toBe("CUIT_INVALIDO");
    expect(analizarCuit("123").estado).toBe("CUIT_INVALIDO");
    expect(analizarCuit("").estado).toBe("CUIT_NO_ENCONTRADO");
    expect(analizarCuit(null).estado).toBe("CUIT_NO_ENCONTRADO");
  });

  it("conserva el original sin tocarlo", () => {
    const c = analizarCuit("20-11111111-2");
    expect(c.original).toBe("20-11111111-2");
    expect(c.normalizado).toBe(CUIT_A);
  });

  it("cuenta dígitos diferentes por posición", () => {
    expect(digitosDiferentes(CUIT_A, CUIT_A)).toBe(0);
    expect(digitosDiferentes(CUIT_A, CUIT_TIPEADO)).toBe(1);
    expect(digitosDiferentes(CUIT_A, CUIT_B)).toBeGreaterThan(1);
    expect(digitosDiferentes("123", "12345")).toBeNull();
  });

  it("sugiere parecidos pero nunca corrige", () => {
    const sug = cuitsParecidos(CUIT_TIPEADO, [CUIT_A, CUIT_B, CUIT_EMPRESA]);
    expect(sug).toHaveLength(1);
    expect(sug[0].cuit).toBe(CUIT_A);
    expect(sug[0].motivo).toBe("Difiere en 1 dígito");
    // El valor consultado no cambió: la función devuelve candidatos, no arregla.
    expect(analizarCuit(CUIT_TIPEADO).normalizado).toBe(CUIT_TIPEADO);
  });

  it("no sugiere nada cuando la diferencia es grande", () => {
    expect(cuitsParecidos(CUIT_A, [CUIT_B, CUIT_EMPRESA])).toHaveLength(0);
  });
});

describe("observación", () => {
  it("extrae la fecha del principio en ISO", () => {
    expect(fechaDeObservacion("05/09/2026 - Transferencia Recibida - De X / / 1")).toBe("2026-09-05");
    expect(fechaDeObservacion("sin fecha")).toBeNull();
    expect(fechaDeObservacion("32/13/2026 - x")).toBeNull();
  });

  it("lee la operación bancaria del segundo segmento", () => {
    expect(operacionDeObservacion(obs(CUIT_A))).toBe("Transferencia Recibida");
    expect(operacionDeObservacion("una sola parte")).toBeNull();
  });

  it("extrae el CUIT cuando está al final", () => {
    const o = leerObservacion(obs(CUIT_A));
    expect(o.patron).toBe("TRANSFERENCIA_COMPLETA");
    expect(o.cuit?.normalizado).toBe(CUIT_A);
    expect(o.cuit?.estado).toBe("VALIDO");
    expect(o.fecha).toBe("2026-09-05");
  });

  it("toma el último de varios números de once dígitos", () => {
    // En el archivo real el concepto libre puede traer otros números.
    const texto = `05/09/2026 - Transferencia Recibida  - De X / ref ${CUIT_B} - Var / ${CUIT_A}`;
    const o = leerObservacion(texto);
    expect(candidatosACuit(texto)).toHaveLength(2);
    expect(o.cuit?.normalizado).toBe(CUIT_A);
    expect(o.candidatosCuit).toBe(2);
  });

  it("no confunde una secuencia de diez dígitos con un CUIT", () => {
    const texto = `05/09/2026 - Transferencia Recibida  - De X / 1234567890 - Var / ${CUIT_A}`;
    expect(candidatosACuit(texto)).toEqual([CUIT_A]);
  });

  it("no muerde parte de una secuencia más larga", () => {
    expect(candidatosACuit("05/09/2026 - x - y / 123456789012345 /")).toHaveLength(0);
  });

  it("marca el CUIT que no cierra el dígito verificador", () => {
    const o = leerObservacion(obs(CUIT_TIPEADO));
    expect(o.cuit?.estado).toBe("CUIT_INVALIDO");
    expect(o.patron).toBe("TRANSFERENCIA_COMPLETA");
  });

  it("marca la fila sin CUIT", () => {
    const o = leerObservacion("05/09/2026 - Transferencia Recibida  - De X / sin numero /");
    expect(o.patron).toBe("SIN_CUIT");
    expect(o.cuit).toBeNull();
  });

  it("reconoce el mantenimiento de plataforma", () => {
    const o = leerObservacion("Mantenimiento de plataforma");
    expect(o.patron).toBe("MANTENIMIENTO");
    expect(o.cuit).toBeNull();
  });

  it("distingue una operación bancaria nueva de una conocida", () => {
    const conocida = leerObservacion(obs(CUIT_A));
    expect(conocida.patron).toBe("TRANSFERENCIA_COMPLETA");

    const nueva = leerObservacion(`05/09/2026 - Operacion Que No Vimos  - De X / / ${CUIT_A}`);
    expect(nueva.patron).toBe("TRANSFERENCIA_OPERACION_NUEVA");
    expect(nueva.operacion).toBe("Operacion Que No Vimos");
  });

  it("clasifica el campo vacío y el texto irreconocible", () => {
    expect(leerObservacion("").patron).toBe("VACIA");
    expect(leerObservacion(null).patron).toBe("VACIA");
    expect(leerObservacion("cualquier cosa sin forma").patron).toBe("DESCONOCIDO");
  });
});

describe("clasificación de filas", () => {
  const transferencia = leerObservacion(obs(CUIT_A));
  const mantenimiento = leerObservacion("Mantenimiento de plataforma");
  const vacia = leerObservacion("");

  it("reconoce una acreditación por transferencia", () => {
    expect(clasificarFila("Depósito bancario", transferencia, 1000)).toBe(
      "ACREDITACION_TRANSFERENCIA",
    );
  });

  it("reconoce el fee de plataforma por cualquiera de las dos señales", () => {
    expect(clasificarFila(null, mantenimiento, -500)).toBe("FEE_MANTENIMIENTO");
    expect(
      clasificarFila("Gestión Habilitación y Mantenimiento de Plataforma", vacia, -500),
    ).toBe("FEE_MANTENIMIENTO");
  });

  it("trata un importe negativo sin observación como ajuste", () => {
    expect(clasificarFila("Otra cosa", vacia, -100)).toBe("AJUSTE");
  });

  it("reconoce un depósito de efectivo en sucursal", () => {
    // Apareció en la validación multidía. No tiene CUIT de depositante, y no
    // debería tenerlo: el efectivo no identifica a quien lo llevó.
    const efectivo = leerObservacion("09/09/2026 - Deposito De Efectivo En Sucursal - Suc 0770 /");
    expect(clasificarFila("Depósito bancario", efectivo, 5000)).toBe("DEPOSITO");
  });

  it("no confunde un reintegro de gastos bancarios con un depósito", () => {
    // El texto del reintegro dice «depósito», así que sin una guarda antes
    // se clasificaba como plata de un cliente. Lo encontró la validación
    // multidía y es el único defecto que produjo.
    const reintegro = leerObservacion(
      "09/09/2026 - Reintegro de gastos bancarios depósito $1000.00 BANCO DE PRUEBA 05/06/2026",
    );
    expect(clasificarFila("Reintegro de G. Bancario", reintegro, 1000)).toBe("REINTEGRO_BANCARIO");
    // Y también por el texto, si el tipo viniera vacío.
    expect(clasificarFila(null, reintegro, 1000)).toBe("REINTEGRO_BANCARIO");
  });

  it("deja en DESCONOCIDO una narrativa bancaria que no se entiende", () => {
    // «TRF IN COEL <11 dígitos>»: trae un CUIT válido embebido, pero la
    // operación no es reconocible. Se retiene para revisión en lugar de
    // suponer que es una transferencia de cliente.
    const rara = leerObservacion(`09/09/2026 - TRF  IN COEL ${CUIT_A}`);
    expect(clasificarFila("Depósito bancario", rara, 1000)).toBe("DESCONOCIDO");
    // El CUIT igual queda extraído, para que quien revise lo vea.
    expect(rara.cuit?.normalizado).toBe(CUIT_A);
  });

  it("deja DESCONOCIDO cuando no hay evidencia, en lugar de adivinar", () => {
    const raro = leerObservacion("cualquier cosa sin forma");
    expect(clasificarFila("Algo nuevo", raro, 100)).toBe("DESCONOCIDO");
  });
});

describe("fechas de celda", () => {
  it("recorta la parte de fecha del texto con hora", () => {
    expect(fechaDeCelda("2026-09-08 10:11:12.345")).toBe("2026-09-08");
    expect(fechaDeCelda("2026-09-08 10:11:12.3")).toBe("2026-09-08");
  });

  it("rechaza lo que no es una fecha", () => {
    expect(fechaDeCelda("")).toBeNull();
    expect(fechaDeCelda(null)).toBeNull();
    expect(fechaDeCelda("2026-13-40 00:00:00")).toBeNull();
    expect(fechaDeCelda(12345)).toBeNull();
  });
});

describe("informe completo", () => {
  it("ubica los encabezados por nombre y no por posición", () => {
    const bytes = informeSintetico([filaAcreditacion({ observacion: obs(CUIT_A) })]);
    const informe = parsearInforme(bytes, { sourceFile: "prueba.xls" });
    expect(informe.filaEncabezado).toBe(2);
    expect(Object.keys(informe.columnas)).toHaveLength(14);
    // El encabezado real trae un espacio adelante; igual se ubica.
    expect(informe.columnas.observacion).toBe(ENCABEZADOS.indexOf(" OBSERVACION"));
    expect(informe.columnasDesconocidas).toEqual([]);
  });

  it("mantiene la trazabilidad al archivo, la hoja y la fila", () => {
    const bytes = informeSintetico([filaAcreditacion({ observacion: obs(CUIT_A) })]);
    const [fila] = parsearInforme(bytes, { sourceFile: "prueba.xls" }).filas;
    expect(fila.sourceFile).toBe("prueba.xls");
    expect(fila.sheet).toBe("Hoja 1");
    expect(fila.row).toBe(3);
  });

  it("conserva las dos fechas por separado", () => {
    const bytes = informeSintetico([
      filaAcreditacion({
        observacion: obs(CUIT_A, "Juan Perez", "18/05/2026"),
        fecha: "2026-09-08 10:00:00.000",
        fechaIngreso: "2026-05-18 09:00:00.0",
      }),
    ]);
    const [fila] = parsearInforme(bytes).filas;
    // Una acreditación procesada hoy puede tener fecha de ingreso vieja.
    expect(fila.fechaMovimiento).toBe("2026-09-08");
    expect(fila.fechaIngreso).toBe("2026-05-18");
    expect(fila.observacion.fecha).toBe("2026-05-18");
  });

  it("saltea las filas vacías sin contarlas", () => {
    const bytes = informeSintetico([
      filaAcreditacion({ observacion: obs(CUIT_A) }),
      Array<null>(14).fill(null),
      filaAcreditacion({ observacion: obs(CUIT_B) }),
    ]);
    expect(parsearInforme(bytes).filas).toHaveLength(2);
  });

  it("acepta importes negativos y con decimales", () => {
    const bytes = informeSintetico([
      filaAcreditacion({ observacion: "Mantenimiento de plataforma", importe: -1234.56 }),
    ]);
    const [fila] = parsearInforme(bytes).filas;
    expect(fila.importe).toBe(-1234.56);
    expect(fila.clasificacion).toBe("FEE_MANTENIMIENTO");
  });

  it("falla con un mensaje claro si no encuentra los encabezados", () => {
    const bytes = armarXls({ nombre: "Hoja 1", filas: [["a", "b"], ["c", "d"]] });
    expect(() => parsearInforme(bytes)).toThrow(/encabezados/i);
  });

  it("mide la cobertura y no pierde ninguna fila", () => {
    const bytes = informeSintetico([
      filaAcreditacion({ observacion: obs(CUIT_A) }),
      filaAcreditacion({ observacion: obs(CUIT_B, "Ana Gomez") }),
      filaAcreditacion({ observacion: obs(CUIT_TIPEADO, "Luis Diaz") }),
      filaAcreditacion({ observacion: "05/09/2026 - Transferencia Recibida  - De X / sin cuit /" }),
      filaAcreditacion({
        observacion: "Mantenimiento de plataforma",
        importe: -300,
        tipoIncremento: "Gestión Habilitación y Mantenimiento de Plataforma",
      }),
    ]);
    const informe = parsearInforme(bytes);
    const c = medirCobertura(informe);

    expect(c.totalFilas).toBe(5);
    // La suma de las clasificaciones tiene que dar el total: nada desaparece.
    const suma = Object.values(c.porClasificacion).reduce((a, b) => a + b, 0);
    expect(suma).toBe(c.totalFilas);

    expect(c.filasRelevantes).toBe(4);
    expect(c.conCuitValido).toBe(2);
    expect(c.cuitInvalido).toBe(1);
    expect(c.sinCuit).toBe(1);
    expect(c.coberturaPct).toBe(50);
  });

  it("mide la cobertura del CUIT sobre transferencias, no sobre depósitos", () => {
    // Un depósito de efectivo no tiene depositante identificado. Contarlo
    // como «sin CUIT» ensucia la métrica sin significar nada.
    const bytes = informeSintetico([
      filaAcreditacion({ observacion: obs(CUIT_A) }),
      filaAcreditacion({ observacion: obs(CUIT_B, "Ana Gomez") }),
      filaAcreditacion({
        observacion: "05/09/2026 - Deposito De Efectivo En Sucursal - Suc 0001 /",
      }),
      filaAcreditacion({
        observacion: "05/09/2026 - Reintegro de gastos bancarios depósito $10.00 BANCO X 01/09/2026",
        tipoIncremento: "Reintegro de G. Bancario",
      }),
    ]);
    const c = medirCobertura(parsearInforme(bytes));

    expect(c.transferencias).toBe(2);
    expect(c.depositos).toBe(1);
    expect(c.porClasificacion.REINTEGRO_BANCARIO).toBe(1);
    expect(c.coberturaTransferenciasPct).toBe(100);
    // Sobre las relevantes baja, porque el depósito nunca puede aportar CUIT.
    expect(c.coberturaPct).toBeCloseTo(66.7, 1);
    // Y el reintegro queda fuera de las dos cuentas: no es plata de cliente.
    expect(c.filasRelevantes).toBe(3);
  });

  it("un informe sin movimientos no rompe ni divide por cero", () => {
    // El informe de un domingo puede venir sin una sola fila de datos.
    const bytes = informeSintetico([]);
    const c = medirCobertura(parsearInforme(bytes));
    expect(c.totalFilas).toBe(0);
    expect(c.coberturaPct).toBe(0);
    expect(c.coberturaTransferenciasPct).toBe(0);
  });

  it("solo deja conciliar lo que tiene CUIT válido, fecha e importe", () => {
    const bytes = informeSintetico([
      filaAcreditacion({ observacion: obs(CUIT_A) }),
      filaAcreditacion({ observacion: obs(CUIT_TIPEADO, "Luis Diaz") }),
      filaAcreditacion({ observacion: "Mantenimiento de plataforma", importe: -300 }),
    ]);
    const conciliables = acreditacionesConciliables(parsearInforme(bytes));
    expect(conciliables).toHaveLength(1);
    expect(conciliables[0].cuit).toBe(CUIT_A);
    // Se concilia contra la fecha de ingreso, no la del informe.
    expect(conciliables[0].fecha).toBe("2026-09-05");
  });
});
