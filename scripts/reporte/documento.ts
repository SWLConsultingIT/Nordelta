/**
 * El one-pager, en HTML pensado para imprimirse.
 *
 * Una sola hoja A4 y cuatro bloques que se distinguen de un vistazo. El
 * orden no es decorativo: primero lo que hicimos, después lo que falta de
 * cada lado —enfrentados, porque son responsabilidades distintas— y al
 * final el compromiso de la semana que viene.
 *
 * Medidas en píxeles a 96 dpi, que es la unidad en la que Chrome imprime:
 * A4 son exactamente 794 × 1123. Trabajar en píxeles y no en milímetros
 * permite medir el desborde en el navegador antes de generar el PDF.
 */

import type { Changelog } from "./git";
import type { EntradaSemanal, Estado } from "./entrada";

export const A4 = { ancho: 794, alto: 1123 } as const;

/** Cuántas viñetas entran sin apretar la página. */
export const TOPES = { progreso: 6, pendientes: 5, abiertos: 5, siguientes: 5 } as const;

export interface Reporte {
  progreso: string[];
  pendientes: string[];
  abiertos: string[];
  siguientes: string[];
  estado: Estado | null;
  desde: string;
  hasta: string;
  emitido: string;
}

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** `2026-09-11` → `11/09/2026`. */
export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/**
 * Arma el contenido del reporte.
 *
 * El progreso sale del changelog; lo demás, del archivo semanal. Lo único
 * que hace esta función con el texto del cliente es recortarlo al tope: no
 * lo reescribe ni lo completa.
 */
export function componer(
  changelog: Changelog,
  entrada: EntradaSemanal,
  emitido: string,
): Reporte {
  const deLosCommits = changelog.temas.map((t) => t.tema.titulo);
  // Lo que se cargó a mano va primero: si alguien se tomó el trabajo de
  // escribirlo es porque el changelog no lo mostraba.
  const progreso = [...entrada.progressExtra, ...deLosCommits].slice(0, TOPES.progreso);

  return {
    progreso,
    pendientes: entrada.pending.slice(0, TOPES.pendientes),
    abiertos: entrada.openItems.slice(0, TOPES.abiertos),
    siguientes: entrada.nextSteps.slice(0, TOPES.siguientes),
    estado: entrada.status,
    desde: changelog.desde,
    hasta: changelog.hasta,
    emitido,
  };
}

const VACIO: Record<string, string> = {
  progreso: "Sin actividad registrada en el período.",
  pendientes: "Sin pendientes de nuestro lado.",
  abiertos: "Sin puntos bloqueantes esta semana.",
  siguientes: "A definir en la próxima planificación.",
};

function lista(items: string[], clave: string): string {
  if (items.length === 0) {
    return `<p class="vacio">${escapar(VACIO[clave])}</p>`;
  }
  return `<ul>${items.map((i) => `<li>${escapar(i)}</li>`).join("")}</ul>`;
}

function bloque(numero: string, titulo: string, items: string[], clave: string): string {
  return `
    <section class="bloque">
      <h2><span class="num">${numero}</span>${escapar(titulo)}</h2>
      ${lista(items, clave)}
    </section>`;
}

function sello(estado: Estado | null): string {
  // Sin evidencia no hay sello, y tampoco el rótulo: un «Estado general»
  // con nada debajo parece un error de generación. Un estado inventado, en
  // cambio, es la clase de dato que después nadie puede desmentir.
  if (!estado) return "";
  const clase = { "ON TRACK": "ok", "AT RISK": "riesgo", BLOCKED: "bloqueado" }[estado];
  return `<span class="sello ${clase}">${estado}</span>`;
}

export function html(r: Reporte): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Pagos Nordelta · Weekly Project Report</title>
<style>
  @page { size: A4; margin: 0; }

  :root {
    --navy:    #0A1930;
    --navy-2:  #1A3357;
    --tinta:   #131A24;
    --tinta-2: #45505F;
    --tinta-3: #74808F;
    --verde:   #10513C;
    --ambar:   #8A5E14;
    --rojo:    #A32F26;
    --linea:   #E5E2DA;
    --linea-2: #D3CFC4;
    --marfil:  #FBFAF7;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    width: ${A4.ancho}px;
    height: ${A4.alto}px;
    background: #fff;
    color: var(--tinta);
    font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .hoja {
    width: ${A4.ancho}px;
    height: ${A4.alto}px;
    padding: 44px 56px 34px;
    display: flex;
    flex-direction: column;
  }

  /* ── Encabezado ───────────────────────────────────────── */
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }

  .marca { display: flex; align-items: center; gap: 9px; }
  .mono {
    width: 26px; height: 26px; border-radius: 7px; background: var(--navy);
    color: var(--marfil); display: grid; place-items: center;
    font-size: 12px; font-weight: 700; letter-spacing: -0.02em; flex: none;
  }
  .producto { font-size: 17px; font-weight: 700; letter-spacing: -0.02em; }
  .documento {
    margin-top: 3px; font-size: 11px; color: var(--tinta-3); letter-spacing: 0.01em;
  }
  .periodo { margin-top: 13px; font-size: 12.5px; color: var(--tinta-2); }
  .periodo b { color: var(--tinta); font-weight: 600; }

  .derecha { text-align: right; flex: none; }
  .rotulo {
    font-size: 8px; font-weight: 600; letter-spacing: 0.13em;
    text-transform: uppercase; color: var(--tinta-3);
  }
  .sello {
    display: inline-block; margin-top: 6px; padding: 4px 10px; border-radius: 4px;
    font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em;
    border: 1px solid; background: #fff;
  }
  .sello.ok        { color: var(--verde); border-color: #B4D6C6; background: #F1F6F4; }
  .sello.riesgo    { color: var(--ambar); border-color: #E2D2AC; background: #F9F4E9; }
  .sello.bloqueado { color: var(--rojo);  border-color: #E8C6C1; background: #FAF0EE; }

  .barra { height: 2px; background: var(--navy); margin: 20px 0 0; }

  /* ── Bloques ──────────────────────────────────────────── */
  .cuerpo { flex: 1; display: flex; flex-direction: column; }

  .bloque { padding: 23px 0 21px; border-bottom: 1px solid var(--linea); }
  .bloque:last-child { border-bottom: 0; }

  h2 {
    display: flex; align-items: baseline; gap: 9px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.11em;
    text-transform: uppercase; color: var(--navy); margin-bottom: 11px;
  }
  .num {
    font-size: 9px; font-weight: 700; letter-spacing: 0.04em;
    color: var(--tinta-3); font-variant-numeric: tabular-nums;
  }

  ul { list-style: none; }
  li {
    position: relative; padding-left: 14px; margin-bottom: 7px;
    font-size: 12px; line-height: 1.5; color: var(--tinta-2);
  }
  li:last-child { margin-bottom: 0; }
  li::before {
    content: ""; position: absolute; left: 0; top: 7px;
    width: 4px; height: 4px; border-radius: 50%; background: var(--navy-2);
  }
  .vacio { font-size: 12px; line-height: 1.5; color: var(--tinta-3); font-style: italic; }

  /* Las dos mitades que se enfrentan: lo nuestro y lo del cliente. */
  .par { display: grid; grid-template-columns: 1fr 1fr; gap: 0 34px; }
  .par .bloque { border-bottom: 0; }
  .par .bloque:first-child {
    border-right: 1px solid var(--linea); padding-right: 34px; margin-right: -17px;
  }
  .fila-par { border-bottom: 1px solid var(--linea); }

  /* ── Pie ──────────────────────────────────────────────── */
  footer {
    margin-top: auto; padding-top: 14px; border-top: 1px solid var(--linea-2);
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 9.5px; color: var(--tinta-3);
  }
  footer b { color: var(--tinta-2); font-weight: 600; }
</style>
</head>
<body>
  <div class="hoja">
    <header>
      <div>
        <div class="marca">
          <span class="mono">N</span>
          <span class="producto">Pagos Nordelta</span>
        </div>
        <div class="documento">Weekly Project Report</div>
        <div class="periodo">Semana <b>${fechaCorta(r.desde)} — ${fechaCorta(r.hasta)}</b></div>
      </div>
      ${r.estado
        ? `<div class="derecha"><div class="rotulo">Estado general</div>${sello(r.estado)}</div>`
        : ""}
    </header>

    <div class="barra"></div>

    <div class="cuerpo">
      ${bloque("01", "Progreso semanal", r.progreso, "progreso")}

      <div class="par fila-par">
        ${bloque("02", "Pendientes", r.pendientes, "pendientes")}
        ${bloque("03", "Open items", r.abiertos, "abiertos")}
      </div>

      ${bloque("04", "Next steps", r.siguientes, "siguientes")}
    </div>

    <footer>
      <span><b>SWL Consulting</b> · Confidencial</span>
      <span>Emitido el ${fechaCorta(r.emitido)}</span>
    </footer>
  </div>
</body>
</html>`;
}
