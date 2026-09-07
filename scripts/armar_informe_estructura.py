#!/usr/bin/env python3
"""Arma el informe de arquitectura de producto como HTML y lo imprime a PDF.

Una sección por página A4 horizontal. Las capturas de la aplicación se
embeben en base64 para que el HTML sea autocontenido y no dependa de rutas
relativas al momento de imprimir.

Uso:
    python3 scripts/armar_informe_estructura.py

Requiere las capturas en el directorio que indica CAPTURAS. Se toman contra
el build de producción (`npx next start`), no contra el servidor de
desarrollo: ese dibuja su propio indicador en la esquina.
"""
import base64
import pathlib
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
CAPTURAS = pathlib.Path(
    "/private/tmp/claude-501/-Users-fran-Desktop-Laburo-Nordelta/"
    "fd35491a-502a-4fea-82cf-b3a308b74e7a/scratchpad/estructura"
)
SALIDA_HTML = RAIZ / "docs" / "NORDELTA_APP_STRUCTURE_REPORT.html"
SALIDA_PDF = RAIZ / "docs" / "NORDELTA_APP_STRUCTURE_REPORT.pdf"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def img(nombre: str) -> str:
    ruta = CAPTURAS / f"{nombre}.png"
    if not ruta.exists():
        sys.exit(f"falta la captura {ruta}")
    return "data:image/png;base64," + base64.b64encode(ruta.read_bytes()).decode()


def captura(nombre, titulo, pie="", alto=None):
    """`alto` en píxeles fija la altura y libera el ancho: mantiene la
    proporción, y es lo único que permite que una captura muy alta entre en
    una página horizontal."""
    estilo = f' style="height:{alto}px;width:auto;margin:0 auto"' if alto else ""
    return f"""<figure class="cap">
      <img src="{img(nombre)}" alt="{titulo}"{estilo}>
      <figcaption><b>{titulo}</b>{(" " + pie) if pie else ""}</figcaption>
    </figure>"""


# ═════════════════════════════════════════════════════════════════════════
#  Sistema visual del documento
#
#  Mismos tokens que la aplicación: el informe tiene que parecerse al
#  producto del que habla.
# ═════════════════════════════════════════════════════════════════════════

CSS = """
@page { size: A4 landscape; margin: 12mm 13mm; }

:root {
  --surface:#FFFFFF; --raised:#F8FAFD; --sunken:#EFF3F9; --ground:#F4F6FB;
  --navy:#0A1930; --navy-3:#1A3357;
  --brand:#1D5AD0; --brand-lo:#164AAE; --brand-wash:#EAF1FE; --brand-line:#C0D6F9;
  --line:#E2E8F1; --line-soft:#EDF1F7; --line-hard:#CFD9E7;
  --ink:#0B1727; --ink-2:#3E4F66; --ink-3:#71849C; --ink-4:#9BAABD;
  --pos:#0C7550; --pos-wash:#E3F3EC; --pos-line:#A9DBC5;
  --neg:#B02318; --neg-wash:#FBEBE9; --neg-line:#F0C0BA;
  --warn:#9A6408; --warn-wash:#FCF2E0; --warn-line:#EBD3A0;
  --sans:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;
  --mono:"SF Mono",Menlo,Consolas,monospace;
}
* { box-sizing:border-box; }
html,body { margin:0; padding:0; }
body {
  font-family:var(--sans); color:var(--ink); font-size:8.9pt; line-height:1.5;
  -webkit-font-smoothing:antialiased; background:var(--surface);
}
.hoja { page-break-after:always; position:relative; }
.hoja:last-child { page-break-after:auto; }

/* ── Tipografía ─────────────────────────────────────────────── */
h1 { font-size:26pt; font-weight:700; letter-spacing:-.03em; line-height:1.04; margin:0; }
h2 { font-size:14pt; font-weight:680; letter-spacing:-.02em; margin:0; }
h3 { font-size:10pt; font-weight:660; letter-spacing:-.012em; margin:0 0 1mm; }
h4 { font-size:8.9pt; font-weight:660; margin:0 0 .8mm; }
p  { margin:0 0 2.2mm; }
b,strong { font-weight:640; }
em { font-style:normal; color:var(--brand); font-weight:600; }
code { font-family:var(--mono); font-size:7.6pt; background:var(--brand-wash);
       color:var(--brand-lo); padding:.2mm 1mm; border-radius:1mm; }
.rot { font-family:var(--mono); font-size:6.3pt; font-weight:500; letter-spacing:.14em;
       text-transform:uppercase; color:var(--ink-3); }
.mini { font-size:7.8pt; color:var(--ink-3); line-height:1.42; }
.nada > *:last-child { margin-bottom:0; }

/* ── Encabezado de sección ──────────────────────────────────── */
.sec { display:flex; align-items:baseline; gap:3mm; border-bottom:1.5pt solid var(--ink);
       padding-bottom:1.4mm; margin-bottom:3.6mm; }
.sec .n { font-family:var(--mono); font-size:12pt; font-weight:700; color:var(--brand); line-height:1; }
.sec .sub { margin:0 0 0 auto; color:var(--ink-3); font-size:8.2pt; }

/* ── Grillas ────────────────────────────────────────────────── */
.g2 { display:grid; grid-template-columns:1fr 1fr; gap:6mm; align-items:start; }
.g3 { display:grid; grid-template-columns:repeat(3,1fr); gap:4.4mm; align-items:start; }
.g4 { display:grid; grid-template-columns:repeat(4,1fr); gap:3.6mm; align-items:start; }
.g23 { display:grid; grid-template-columns:1.35fr 1fr; gap:6mm; align-items:start; }
.g32 { display:grid; grid-template-columns:1fr 1.35fr; gap:6mm; align-items:start; }

/* ── Tarjetas ───────────────────────────────────────────────── */
.card { border:.7pt solid var(--line); border-radius:2.6mm; padding:3.2mm; break-inside:avoid; }
.card.pl { background:var(--raised); }
.card.br { background:var(--brand-wash); border-color:var(--brand-line); }
.card.ok { background:var(--pos-wash); border-color:var(--pos-line); }
.card.no { background:var(--neg-wash); border-color:var(--neg-line); }
.card.wa { background:var(--warn-wash); border-color:var(--warn-line); }
.card .rot { display:block; margin-bottom:1.2mm; }

.aviso { border-left:2pt solid var(--brand); background:var(--brand-wash);
         padding:2.6mm 3.4mm; border-radius:0 2mm 2mm 0; break-inside:avoid; }
.aviso.no { border-color:var(--neg); background:var(--neg-wash); }
.aviso.wa { border-color:var(--warn); background:var(--warn-wash); }
.aviso.ok { border-color:var(--pos); background:var(--pos-wash); }
.aviso > *:last-child { margin-bottom:0; }

/* ── Tablas ─────────────────────────────────────────────────── */
.tbl { border:.7pt solid var(--line); border-radius:2.6mm; overflow:hidden; break-inside:avoid; }
table { width:100%; border-collapse:collapse; font-size:7.9pt; }
th { text-align:left; font-family:var(--mono); font-size:6.1pt; font-weight:500;
     letter-spacing:.11em; text-transform:uppercase; color:var(--ink-3);
     border-bottom:.7pt solid var(--line); padding:1.3mm 1.9mm; background:var(--raised);
     vertical-align:bottom; }
td { padding:1.35mm 1.9mm; border-bottom:.55pt solid var(--line-soft); vertical-align:top;
     line-height:1.38; }
tr:last-child td { border-bottom:0; }
td.m,th.m { font-family:var(--mono); font-size:7.1pt; }
td.c,th.c { text-align:center; }
td.r,th.r { text-align:right; }
td.num { font-family:var(--mono); font-variant-numeric:tabular-nums; text-align:right; }
.tbl.zebra tr:nth-child(even) td { background:var(--raised); }

/* Para las tablas de veinte filas o más: sin esto no entran en una página. */
.tbl.compacta table { font-size:7.2pt; }
.tbl.compacta th { padding:1mm 1.6mm; }
.tbl.compacta td { padding:.85mm 1.6mm; line-height:1.28; }
.tbl.compacta td.m { font-size:6.6pt; }
.tbl.compacta .mini { font-size:7pt; line-height:1.28; }

.tbl.micro table { font-size:6.8pt; }
.tbl.micro th { padding:.9mm 1.4mm; }
.tbl.micro td { padding:.7mm 1.4mm; line-height:1.24; }
.tbl.micro td.m { font-size:6.3pt; }
.tbl.micro .mini { font-size:6.6pt; line-height:1.24; }

/* ── Etiquetas de estado ────────────────────────────────────── */
.et { display:inline-block; font-family:var(--mono); font-size:5.9pt; font-weight:600;
      letter-spacing:.07em; text-transform:uppercase; padding:.5mm 1.2mm;
      border-radius:1mm; white-space:nowrap; }
.et-keep { background:var(--pos-wash); color:var(--pos); }
.et-red  { background:var(--warn-wash); color:var(--warn); }
.et-new  { background:var(--brand-wash); color:var(--brand); }
.et-fus  { background:var(--sunken); color:var(--ink-2); }
.et-del  { background:var(--neg-wash); color:var(--neg); }
.et-val  { background:var(--sunken); color:var(--ink-3); }
.blk { display:inline-block; font-family:var(--mono); font-size:6pt; font-weight:700;
       letter-spacing:.08em; padding:.5mm 1.4mm; border-radius:1mm;
       background:var(--neg); color:#fff; }
.hi  { display:inline-block; font-family:var(--mono); font-size:6pt; font-weight:700;
       letter-spacing:.08em; padding:.5mm 1.4mm; border-radius:1mm;
       background:var(--warn-wash); color:var(--warn); border:.5pt solid var(--warn-line); }

/* ── Diagramas ASCII ────────────────────────────────────────── */
pre.ascii { font-family:var(--mono); font-size:6.9pt; line-height:1.52; color:var(--ink-2);
            margin:0; white-space:pre; background:var(--raised); border:.7pt solid var(--line);
            border-radius:2.6mm; padding:3mm 3.4mm; break-inside:avoid; overflow:hidden; }
pre.ascii.limpio { background:transparent; border:0; padding:0; }
pre.ascii b { color:var(--ink); font-weight:700; }
pre.ascii i { color:var(--brand); font-style:normal; font-weight:700; }

/* ── Cadena de nodos ────────────────────────────────────────── */
.flujo { display:flex; align-items:stretch; gap:0; break-inside:avoid; }
.nodo { flex:1; border:.7pt solid var(--line); border-radius:2mm; background:var(--surface);
        padding:2.2mm 2.4mm; min-width:0; }
.nodo.br { background:var(--brand-wash); border-color:var(--brand-line); }
.nodo .t { font-size:7.8pt; font-weight:640; line-height:1.25; }
.nodo .d { font-size:6.9pt; color:var(--ink-3); line-height:1.32; margin-top:.6mm; }
.fl { flex:0 0 5mm; display:grid; place-items:center; color:var(--ink-4); font-size:9pt; }

/* ── Wireframes ─────────────────────────────────────────────── */
.wf { border:1pt solid var(--line-hard); border-radius:2.4mm; overflow:hidden;
      background:var(--surface); break-inside:avoid; font-size:7.4pt; }
.wf-top { display:flex; align-items:center; gap:2mm; padding:1.8mm 2.4mm;
          border-bottom:.7pt solid var(--line-hard); background:var(--raised); }
.wf-top .ti { font-size:8.6pt; font-weight:680; letter-spacing:-.015em; }
.wf-top .me { font-size:6.9pt; color:var(--ink-3); }
.wf-body { display:flex; }
.wf-side { flex:0 0 25mm; border-right:.7pt solid var(--line-hard); background:var(--navy);
           padding:1.8mm 1.4mm; }
.wf-side .s-g { font-family:var(--mono); font-size:5.4pt; letter-spacing:.12em;
                text-transform:uppercase; color:#5A749A; margin:1.4mm 0 .6mm .8mm; }
.wf-side .s-i { font-size:6.4pt; color:#90A8C8; padding:.6mm .8mm; border-radius:1mm;
                display:flex; gap:1.2mm; white-space:nowrap; }
.wf-side .s-i.on { background:var(--navy-3); color:#F1F6FF; font-weight:600; }
.wf-side .s-i .b { margin-left:auto; font-family:var(--mono); font-size:5.6pt; color:var(--brand); }
.wf-main { flex:1; min-width:0; padding:2.4mm; display:flex; flex-direction:column; gap:2mm; }
.wf-blk { border:.7pt solid var(--line); border-radius:1.8mm; padding:2mm 2.2mm; }
.wf-blk.pl { background:var(--raised); }
.wf-blk.br { background:var(--brand-wash); border-color:var(--brand-line); }
.wf-blk > .rot { display:block; margin-bottom:1.2mm; }
.wf-r { display:flex; gap:2mm; align-items:baseline; padding:.9mm 0;
        border-bottom:.5pt solid var(--line-soft); }
.wf-r:last-child { border-bottom:0; }
.wf-h { display:flex; gap:2mm; padding:0 0 .9mm; border-bottom:.7pt solid var(--line); }
.wf-h span { font-family:var(--mono); font-size:5.7pt; letter-spacing:.1em;
             text-transform:uppercase; color:var(--ink-3); }
.wf-bar { display:flex; gap:1.4mm; align-items:center; flex-wrap:wrap; }
.pill { border:.6pt solid var(--line); border-radius:6mm; padding:.5mm 1.8mm;
        font-size:6.6pt; color:var(--ink-2); background:var(--surface); }
.pill.on { background:var(--surface); color:var(--brand); font-weight:640;
           border-color:var(--brand-line); }
.btn { border-radius:1.4mm; padding:.7mm 2mm; font-size:6.8pt; font-weight:640;
       border:.6pt solid var(--line-hard); color:var(--ink-2); background:var(--surface);
       white-space:nowrap; }
.btn.pri { background:var(--brand); border-color:var(--brand); color:#fff; }
.inp { flex:1; border:.6pt solid var(--line); border-radius:1.4mm; background:var(--surface);
       padding:.7mm 2mm; font-size:6.6pt; color:var(--ink-4); min-width:0; }
.gh { background:var(--sunken); border-radius:.8mm; height:2.2mm; display:block; }
.nm { font-family:var(--mono); font-variant-numeric:tabular-nums; }
.big { font-family:var(--mono); font-size:12pt; font-weight:600; line-height:1;
       font-variant-numeric:tabular-nums; }
.med { font-family:var(--mono); font-size:9.4pt; font-weight:600; line-height:1;
       font-variant-numeric:tabular-nums; }
.dot { display:inline-block; width:1.3mm; height:1.3mm; border-radius:50%; }

/* ── Tira de pipeline ───────────────────────────────────────── */
.pipe { display:flex; align-items:stretch; border:.7pt solid var(--line);
        border-radius:2mm; overflow:hidden; }
.pipe > div { flex:1; padding:2mm 2.2mm; border-right:.6pt solid var(--line); min-width:0; }
.pipe > div:last-child { border-right:0; }
.pipe .k { font-family:var(--mono); font-size:5.8pt; letter-spacing:.1em;
           text-transform:uppercase; color:var(--ink-3); }
.pipe .v { font-family:var(--mono); font-size:11pt; font-weight:600; line-height:1.1;
           margin-top:.6mm; font-variant-numeric:tabular-nums; }
.pipe .s { font-family:var(--mono); font-size:6.4pt; color:var(--ink-3); margin-top:.4mm; }
.pipe .alerta { background:var(--neg-wash); }
.pipe .alerta .v { color:var(--neg); }

/* ── Listas ─────────────────────────────────────────────────── */
ul.pl { margin:0 0 2.2mm; padding-left:3.8mm; }
ul.pl li { margin-bottom:1mm; }
ul.tick { margin:0; padding:0; list-style:none; }
ul.tick li { position:relative; padding-left:4.4mm; margin-bottom:1.2mm; }
ul.tick li::before { content:"□"; position:absolute; left:0; color:var(--ink-4);
                     font-size:9pt; line-height:1; top:.2mm; }
ol.num { margin:0; padding:0; list-style:none; counter-reset:x; }
ol.num > li { counter-increment:x; padding-left:6.4mm; position:relative;
              margin-bottom:1.8mm; break-inside:avoid; }
ol.num > li::before {
  content:counter(x); position:absolute; left:0; top:.1mm;
  width:4.4mm; height:4.4mm; border-radius:50%; background:var(--brand-wash);
  color:var(--brand); border:.5pt solid var(--brand-line);
  font-family:var(--mono); font-size:6.2pt; font-weight:600;
  display:grid; place-items:center;
}

/* ── Portada ────────────────────────────────────────────────── */
.tapa { height:183mm; margin:-12mm -13mm; padding:16mm 18mm; background:var(--navy);
        color:#F1F6FF; display:flex; flex-direction:column; position:relative; overflow:hidden; }
.tapa .glow { position:absolute; top:-72mm; right:-42mm; width:175mm; height:175mm;
              border-radius:50%; background:rgba(29,90,208,.34); filter:blur(34mm); }
.tapa .malla { position:absolute; inset:0; opacity:.06;
  background-image:linear-gradient(#E2E8F1 1px,transparent 1px),
                   linear-gradient(90deg,#E2E8F1 1px,transparent 1px);
  background-size:13mm 13mm; }
.tapa > * { position:relative; }
.marca { display:flex; align-items:center; gap:2.6mm; }
.logo { width:9mm; height:9mm; border-radius:2.4mm; display:grid; place-items:center;
        font-family:var(--mono); font-weight:700; font-size:12pt; color:#fff;
        background:linear-gradient(135deg,#2C77F5,#1D5AD0); }
.tapa h1 { color:#fff; font-size:32pt; max-width:160mm; }
.tapa .lead { font-size:11.5pt; color:#90A8C8; max-width:145mm; margin-top:5mm; line-height:1.45; }
.tapa .pie { margin-top:auto; display:flex; align-items:flex-end; gap:9mm; }
.tapa .rot { color:#5A749A; }
.cifras { display:flex; gap:10mm; }
.cifra .n { font-family:var(--mono); font-size:18pt; font-weight:600; color:#fff; line-height:1; }
.cifra .r { font-size:7.2pt; color:#8AA2C2; margin-top:1.2mm; max-width:26mm; line-height:1.3; }

/* ── Capturas ───────────────────────────────────────────────── */
.cap { margin:0; break-inside:avoid; }
.cap img { display:block; width:100%; border:.7pt solid var(--line); border-radius:1.8mm; }
.cap figcaption { font-size:6.8pt; color:var(--ink-3); margin-top:1.2mm; line-height:1.34; }
.cap figcaption b { color:var(--ink); }
"""


def hoja(n, titulo, sub, cuerpo):
    return f"""<section class="hoja">
  <div class="sec"><span class="n">{n}</span><h2>{titulo}</h2><p class="sub">{sub}</p></div>
  {cuerpo}
</section>"""


PAGINAS = []


def pagina(html):
    PAGINAS.append(html)


# ═════════════════════════════════════════════════════════════════════════
#  1 · Portada
# ═════════════════════════════════════════════════════════════════════════
pagina("""<section class="hoja">
  <div class="tapa">
    <div class="glow"></div><div class="malla"></div>
    <div class="marca"><span class="logo">N</span>
      <span style="font-size:12pt;font-weight:640;letter-spacing:-.02em">Nordelta</span>
    </div>
    <div style="margin-top:auto">
      <span class="rot">Propuesta de arquitectura de producto · para revisión interna</span>
      <h1>Qué aplicación<br>vamos a construir</h1>
      <p class="lead">La mitad contable ya está construida y probada. Lo que falta es la
      mitad operativa: 300 a 600 transferencias por día que hoy se procesan limpiando
      Excel a mano. Este documento define qué se construye, qué se conserva, cómo se
      conectan y en qué orden.</p>
    </div>
    <div class="pie">
      <div class="cifras">
        <div class="cifra"><div class="n">2</div><div class="r">módulos nuevos</div></div>
        <div class="cifra"><div class="n">0</div><div class="r">piezas descartadas</div></div>
        <div class="cifra"><div class="n">3</div><div class="r">decisiones bloqueantes</div></div>
        <div class="cifra"><div class="n">6</div><div class="r">fases de implementación</div></div>
      </div>
      <div style="margin-left:auto;text-align:right">
        <div class="rot">Septiembre de 2026</div>
        <div class="rot" style="margin-top:1.2mm">SWL Consulting</div>
      </div>
    </div>
  </div>
</section>""")

# ═════════════════════════════════════════════════════════════════════════
#  2 · Índice
# ═════════════════════════════════════════════════════════════════════════
_IDX = [
    ("01", "Executive summary", "El hallazgo, la propuesta y los bloqueantes"),
    ("02", "El hallazgo", "Dos mitades y una costura"),
    ("03", "Qué problema estamos resolviendo", "Por qué el estado no existe como dato"),
    ("04", "Cómo funciona hoy", "Las dos cadenas: contable y de acreditaciones"),
    ("05", "Principales pain points", "Siete, y el que ordena el diseño"),
    ("06", "Qué existe actualmente en la app", "Auditoría del repositorio real"),
    ("07", "El motor financiero que ya está", "Volumen de código y garantías"),
    ("08", "Qué conservamos", "Matriz de reutilización"),
    ("09", "Qué cambia", "Hoy contra la propuesta, pantalla por pantalla"),
    ("10", "Arquitectura de información", "Cinco decisiones de estructura, con su razón"),
    ("11", "Sitemap", "El árbol completo"),
    ("12", "Módulos principales", "Siete módulos y la costura"),
    ("13", "Home", "Centro de operaciones"),
    ("14", "Acreditaciones · estados", "Dos ejes, no uno"),
    ("15", "Acreditaciones · pantalla", "La bandeja"),
    ("16", "Importación de archivos · flujo", "Ocho pasos"),
    ("17", "Importación · preview editable", "Donde se corrige antes de procesar"),
    ("18", "Validación de CUIT", "Cinco resultados y una regla que no se cruza"),
    ("19", "Conciliación · pantalla", "Enviado contra acreditado"),
    ("20", "Matching", "Señales, unicidad y lo que no vamos a hacer"),
    ("21", "Clientes", "Una pantalla con pestañas, y por qué"),
    ("22", "Cuenta corriente", "La cadena completa del dato"),
    ("23", "Carga manual y Balance", "Lo que no se toca"),
    ("24", "Ajustes y Auditoría", "Lo que se muda y lo que se extiende"),
    ("25", "User flows · 1 y 2", "Recepción y conciliación"),
    ("26", "User flows · 3, 4 y 5", "Cliente, carga manual y ajuste"),
    ("27", "Arquitectura técnica", "Conservar el stack, y qué se agrega"),
    ("28", "Infraestructura y hosting", "Recomendación"),
    ("29", "Hosting · alternativa evaluada", "VPS propio, con pros y contras"),
    ("30", "Arquitectura de datos", "El flujo y la costura"),
    ("31", "Arquitectura de datos · tablas", "Ocho tablas nuevas"),
    ("32", "Integraciones", "Mapa de sistemas externos"),
    ("33", "Accesos necesarios", "Checklist para el cliente"),
    ("34", "MVP", "Alcance, fase 2 y futuro"),
    ("35", "Roadmap", "Seis fases"),
    ("36", "Roadmap · detalle por fase", "Objetivo, entregables, riesgos, validación"),
    ("37", "Decisiones pendientes", "Doce nuevas y las que siguen abiertas"),
    ("38", "Riesgos", "Once, ordenados por probabilidad × impacto"),
    ("39", "Próximos pasos", "Quién hace qué, y qué no vamos a hacer"),
    ("40", "Anexo · Matriz de pantallas", "Objetivo, usuario, datos, acción, estado"),
    ("41", "Anexo · Principios de UX", "Diez principios y la dirección visual"),
]

_mitad = len(_IDX) // 2 + 1
_a = "".join(
    f'<div class="wf-r" style="border-color:var(--line-soft);padding:.5mm 0;font-size:7.7pt">'
    f'<span class="nm" style="flex:0 0 7mm;color:var(--brand);font-weight:600">{n}</span>'
    f'<span style="flex:0 0 44mm;font-weight:620">{t}</span>'
    f'<span class="mini" style="flex:1;font-size:7pt">{d}</span></div>'
    for n, t, d in _IDX[:_mitad]
)
_b = "".join(
    f'<div class="wf-r" style="border-color:var(--line-soft);padding:.5mm 0;font-size:7.7pt">'
    f'<span class="nm" style="flex:0 0 7mm;color:var(--brand);font-weight:600">{n}</span>'
    f'<span style="flex:0 0 44mm;font-weight:620">{t}</span>'
    f'<span class="mini" style="flex:1;font-size:7pt">{d}</span></div>'
    for n, t, d in _IDX[_mitad:]
)

pagina(f"""<section class="hoja">
  <div class="sec"><span class="n">·</span><h2>Índice</h2>
    <p class="sub">41 secciones · una por página</p></div>
  <div class="g2" style="gap:8mm">
    <div>{_a}</div>
    <div>{_b}</div>
  </div>
  <div class="aviso ok" style="margin-top:3mm">
    <p style="margin-bottom:0"><b>APP CODE MODIFIED: NO.</b> Este informe no cambió una línea de la aplicación.
    Lo único que se agregó al repositorio son <code>docs/NORDELTA_APP_STRUCTURE_REPORT.md</code>,
    su versión HTML, este PDF y el generador <code>scripts/armar_informe_estructura.py</code>.
    Detalle en la sección 39.</p>
  </div>
</section>""")

# ═════════════════════════════════════════════════════════════════════════
#  01 · Executive summary
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("01", "Executive summary", "El hallazgo, la propuesta y los bloqueantes", """
<div class="g23">
  <div class="nada">
    <h3>El hallazgo</h3>
    <p>La aplicación que existe hoy resuelve <b>la mitad contable</b> del negocio:
    movimientos, partidas, cuenta corriente multi-moneda, balance, cierres y auditoría.
    Está construida, probada y verde.</p>
    <p>La última reunión reveló que <b>la mitad operativa —donde se va el día del
    operador— no está construida</b>: entre 300 y 600 transferencias diarias que hoy se
    procesan copiando y limpiando Excel a mano, sin ningún estado explícito y sin
    conciliación sistemática.</p>

    <h3 style="margin-top:3.4mm">La consecuencia arquitectónica</h3>
    <p>No hay que reescribir lo que existe. Hay que <b>construir la mitad que falta y
    coserla a la que ya está</b>. Y las dos mitades se tocan en un único punto.</p>
    <div class="aviso" style="margin-bottom:2.4mm">
      <p style="font-family:var(--mono);font-size:8.4pt;font-weight:700;color:var(--brand-lo)">
      una conciliación confirmada genera el movimiento contable</p>
    </div>
    <p class="mini">Todo lo que está aguas arriba de esa línea es nuevo. Todo lo que está
    aguas abajo ya funciona y no se toca.</p>
  </div>

  <div class="nada">
    <h3>Lo que proponemos</h3>
    <ol class="num" style="margin-bottom:3.4mm">
      <li><b>Dos módulos nuevos</b>: Acreditaciones y Conciliación, más la ingesta de
      Excel que los alimenta.</li>
      <li><b>Una arquitectura de información nueva</b> de cuatro grupos, organizada
      alrededor de las preguntas del operador, no de las tablas de la base.</li>
      <li><b>Una Home que es un centro de operaciones</b>: el pipeline del día primero,
      la plata después.</li>
      <li><b>Conservar el motor financiero completo</b> — 863 líneas de dominio, 976 de
      esquema, 273 tests — sin tocarlo.</li>
      <li><b>Vercel + Supabase Pro</b>, que es lo que el código ya supone, con una
      alternativa evaluada.</li>
    </ol>

    <div class="card no nada">
      <span class="rot" style="color:var(--neg)">Los tres bloqueantes</span>
      <p class="mini" style="color:var(--ink-2);margin-bottom:1.6mm">No se puede cerrar el
      esquema de la mitad nueva sin tres respuestas del cliente.</p>
      <p style="font-size:7.8pt;margin-bottom:1.2mm"><b>N1</b> · ¿A qué granularidad una
      conciliación confirmada impacta la cuenta corriente?</p>
      <p style="font-size:7.8pt;margin-bottom:1.2mm"><b>N2</b> · ¿«Ingresos y créditos»
      trae algún identificador de operación?</p>
      <p style="font-size:7.8pt;margin-bottom:0"><b>N3</b> · ¿Nordelta cobra comisión por
      la transferencia y se registra en la cuenta corriente?</p>
    </div>
  </div>
</div>

<div class="card wa" style="margin-top:4mm">
  <span class="rot" style="color:var(--warn)">Lo que hace falta antes de escribir código</span>
  <p style="margin-bottom:0"><b>Archivos reales.</b> Tres a cinco Excel de clientes
  distintos y tres a cinco descargas de «Ingresos y créditos». Sin esas muestras,
  cualquier parser y cualquier regla de matching que diseñemos es una apuesta. Es el
  primer punto del checklist de accesos y la primera tarea del roadmap.</p>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  02 · El hallazgo
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("02", "El hallazgo", "Dos mitades y una costura", """
<div class="tbl" style="margin-bottom:4mm">
<table>
  <thead><tr><th style="width:20%"></th>
    <th style="width:40%">Mitad operativa · <span style="color:var(--brand)">NUEVA</span></th>
    <th style="width:40%">Mitad contable · <span style="color:var(--pos)">EXISTE</span></th></tr></thead>
  <tbody>
    <tr><td><b>Naturaleza</b></td><td>Un pipeline con estados</td><td>Un libro mayor</td></tr>
    <tr><td><b>Volumen</b></td><td>300–600 filas por día</td><td>~15 movimientos por día</td></tr>
    <tr><td><b>La pregunta</b></td><td>¿Dónde está trabada la plata?</td><td>¿Cuánto nos debe este cliente?</td></tr>
    <tr><td><b>La verdad</b></td><td>Lo que el banco acreditó</td><td>El saldo calculado desde los movimientos</td></tr>
    <tr><td><b>La unidad</b></td><td>La transferencia</td><td>El movimiento con sus partidas</td></tr>
    <tr><td><b>El error típico</b></td><td>Un CUIT con un dígito cambiado</td><td>Una conversión con el tipo de cambio mal</td></tr>
    <tr><td><b>Quién decide</b></td><td>El operador, caso por caso</td><td>La regla, siempre igual</td></tr>
  </tbody>
</table>
</div>

<div class="g2">
  <div class="nada">
    <pre class="ascii" style="font-size:6.4pt;line-height:1.45">┌──────────── MITAD OPERATIVA · <i>NUEVA</i> ────────────┐
│                                                │
│   <b>INGESTA</b>        <b>ACREDITACIONES</b>   <b>CONCILIACIÓN</b>  │
│   ───────        ──────────────   ────────────  │
│   archivo →      bandeja con      enviado       │
│   normalizado →  estados →        contra        │
│   validado       exportable       acreditado    │
│                                                │
└────────────────────────┬───────────────────────┘
                         │
             ┌───────────▼───────────┐
             │     <i>LA COSTURA</i>       │
             │  una conciliación     │
             │  confirmada genera    │
             │  el movimiento        │
             └───────────┬───────────┘
                         │
┌────────────────────────▼───────────────────────┐
│          MITAD CONTABLE · <b>EXISTE</b>              │
│                                                │
│  <b>CARGA MANUAL</b>   <b>CUENTA CORRIENTE</b>   <b>BALANCE</b>    │
│  ────────────   ────────────────   ───────    │
│  movimiento +   saldo corrido      totales    │
│  partidas       por moneda         por moneda │
│                 cierres                       │
└────────────────────────┬───────────────────────┘
                         │
             ┌───────────▼───────────┐
             │      <b>AUDITORÍA</b>       │
             │  atraviesa las dos    │
             └───────────────────────┘</pre>
  </div>

  <div class="nada">
    <h3>Por qué la costura es una sola línea</h3>
    <p>Porque si cada transferencia fuera un movimiento contable, la cuenta corriente de
    un cliente activo tendría <b>600 filas por día</b> y sería ilegible.</p>
    <p>La conciliación <b>agrega</b>: N transferencias confirmadas producen <em>un</em>
    movimiento con sus partidas.</p>

    <div class="aviso wa" style="margin:3mm 0">
      <p><b>A qué nivel se agrupa es la decisión N1, y es bloqueante.</b></p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0">Una por transferencia,
      una por lote y cliente, o una por cliente y día. Hasta que se responda, el módulo se
      construye dejando la decisión aislada en un solo punto del código.</p>
    </div>

    <h3>Lo que esto implica para el plan</h3>
    <ul class="pl">
      <li>El motor financiero <b>no se toca</b>: pasa a ser el destino del pipeline nuevo.</li>
      <li>Las 273 pruebas existentes <b>siguen valiendo</b> sin reescribir ninguna.</li>
      <li>El riesgo se concentra <b>arriba de la línea</b>, donde no hay nada construido
      y donde faltan las muestras de archivos reales.</li>
      <li>Se puede entregar valor <b>antes</b> de que exista la conciliación: el archivo
      normalizado ya ahorra el paso más caro del flujo actual.</li>
    </ul>
  </div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  03 · Qué problema estamos resolviendo
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("03", "Qué problema estamos resolviendo", "Por qué el estado no existe como dato", """
<div class="g23">
  <div class="nada">
    <p>Nordelta es una operación financiera argentina con cuatro oficinas —Nordelta,
    Corrientes, Puertos y Remeros— cuyo trabajo diario se reparte en dos actividades
    distintas.</p>

    <h3 style="margin-top:3mm">La primera es contable</h3>
    <p>Registrar lo que cada contraparte debe o le deben, en cuatro monedas, con
    conversiones y comisiones, y poder cerrar una cuenta. Hoy vive en Google Sheets con
    Apps Script, BigQuery y n8n. <b>Es lo que la aplicación actual ya reemplaza.</b></p>

    <h3 style="margin-top:3mm">La segunda es operativa, y es la que consume el día</h3>
    <p>Un cliente manda un Excel con transferencias a hacer. Alguien lo limpia, lo
    normaliza, corrige CUIT, arma el archivo, lo carga en un sistema externo, espera,
    descarga los créditos, y después rastrea a mano qué se acreditó y qué no. Entre 300 y
    600 transferencias por día, <b>con colores y filtros como único sistema de estado</b>.</p>

    <div class="aviso" style="margin:3.4mm 0">
      <p style="margin-bottom:1.4mm"><b>El problema real no es que las planillas sean
      lentas.</b></p>
      <p style="margin-bottom:0">Es que el estado de la operación <b>no existe como
      dato</b>: vive en el color de una celda, en un filtro que alguien dejó puesto, y en
      la memoria del operador.</p>
    </div>

    <p class="mini">De ahí se derivan casi todos los síntomas: no se puede responder
    «cuánto falta acreditar de este cliente» sin recalcular a mano, no se puede saber quién
    cambió qué, y no se puede repartir el trabajo entre dos personas sin pisarse.</p>
  </div>

  <div class="nada">
    <div class="card pl" style="margin-bottom:3.4mm">
      <span class="rot">Las dos condiciones de adopción</span>
      <h4 style="margin-top:1.4mm">1 · Mantener la velocidad de Excel</h4>
      <p class="mini" style="color:var(--ink-2)">Los usuarios son rápidos con teclado. Un
      ERP lleno de formularios modales es más lento que lo que tienen y no se adopta. Esta
      es la razón por la que la pantalla de carga actual no se toca.</p>
      <h4 style="margin-top:2.4mm">2 · Agregar lo que Excel no puede dar</h4>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0">Estado explícito,
      trazabilidad, validación antes de procesar, consistencia entre oficinas e
      información en tiempo real.</p>
    </div>

    <h3>Las doce preguntas que el producto tiene que contestar</h3>
    <p class="mini" style="margin-bottom:1.8mm">La arquitectura de información de la
    sección 10 se organiza alrededor de estas, no alrededor de las tablas de la base.</p>
    <div class="tbl">
    <table>
      <tbody>
        <tr><td>¿Cuánto envió este cliente?</td><td>¿Cuánto se acreditó?</td></tr>
        <tr><td>¿Cuánto sigue pendiente?</td><td>¿Qué transferencias tienen errores?</td></tr>
        <tr><td>¿Qué CUIT está incorrecto?</td><td>¿Qué no conciliamos todavía?</td></tr>
        <tr><td>¿Qué cliente tiene diferencias?</td><td>¿A quién le debemos?</td></tr>
        <tr><td>¿Qué pasó hoy?</td><td>¿Cuál es el saldo de este cliente?</td></tr>
        <tr><td>¿Cuál es su cuenta corriente?</td><td>¿Qué movimientos movieron su saldo?</td></tr>
      </tbody>
    </table>
    </div>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  04 · Cómo funciona hoy
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("04", "Cómo funciona hoy", "Las dos cadenas: contable y de acreditaciones", """
<div class="g2">
  <div class="nada">
    <h3>La cadena contable · lo que la app ya reemplaza</h3>
    <pre class="ascii">62 hojas diarias por archivo
    ↓  Apps Script «consolidado», a botón, manual
2 hojas de consolidado por archivo
    ↓  vinculación a BigQuery, hoja por hoja,
       permiso a mano
4 tablas externas por mes en BigQuery
    ↓  4 queries en cadena, orquestadas por n8n
       desde un webhook
<b>Consolidado.Cheques-Transacciones</b>
    ↓
<b>Balance.balance_final</b>
    ↓
Sheet «Cuentas Corrientes»  ──┐
    └── un botón acá dispara el webhook ←┘
        que arranca todo</pre>
    <p class="mini" style="margin-top:2.4mm"><b>Nadie consume BigQuery para análisis.</b>
    Su único consumidor vivo es el Sheet que la aplicación reemplaza: no es un warehouse,
    es un motor de consolidación.</p>
    <p class="mini">El SQL que está adentro de los nodos HTTP de n8n es la única
    especificación funcional escrita que existe del sistema.</p>
  </div>

  <div class="nada">
    <h3>La cadena de acreditaciones · lo que falta construir</h3>
    <pre class="ascii"><b>CLIENTE</b>
   ↓ manda Excel
<b>GMAIL</b>  ·  ocasionalmente <b>WHATSAPP</b>
   ↓
operador copia la información            <i>manual</i>
   ↓
normaliza el Excel                       <i>manual</i>
corrige formatos                         <i>manual</i>
limpia CUIT                              <i>manual</i>
corrige errores                          <i>manual</i>
   ↓
prepara el archivo                       <i>manual</i>
   ↓
carga en el <b>SISTEMA EXTERNO</b>             <i>manual</i>
   ↓
se procesan las transferencias
   ↓ (más tarde)
descarga «Ingresos y créditos»           <i>manual</i>
   ↓
limpia el Excel otra vez                 <i>manual</i>
   ↓
rastrea operaciones                      <i>manual</i>
hace matching                            <i>manual</i>
separa por cliente                       <i>manual</i>
   ↓
calcula enviado · acreditado · pendiente <i>manual</i></pre>
    <div class="aviso no" style="margin-top:2.6mm">
      <p style="margin-bottom:0">De los quince pasos, <b>once son manuales</b>. Y el
      resultado —enviado, acreditado, pendiente por cliente— se recalcula desde cero cada
      vez que alguien pregunta.</p>
    </div>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  05 · Pain points
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("05", "Principales pain points", "Siete, y el que ordena el diseño", """
<div class="tbl zebra">
<table>
  <thead><tr><th style="width:4%"></th><th style="width:22%">Pain point</th>
    <th style="width:38%">Por qué duele</th><th style="width:36%">Qué lo resuelve</th></tr></thead>
  <tbody>
    <tr><td class="m"><b>A</b></td><td><b>Volumen</b><br><span class="mini">300–600 transferencias/día</span></td>
        <td>Cualquier paso manual se multiplica por 600</td>
        <td>Ingesta con validación y preview editable</td></tr>
    <tr><td class="m"><b>B</b></td><td><b>CUIT erróneo</b><br><span class="mini">con guiones, mal formateado, con dígitos cambiados</span></td>
        <td>Una transferencia a un CUIT inexistente se rechaza o —peor— va a otra persona</td>
        <td>Normalización + dígito verificador módulo 11 + «posible coincidencia»</td></tr>
    <tr><td class="m"><b>C</b></td><td><b>Importes repetidos</b></td>
        <td>No se puede asumir <code>importe = transferencia</code>: dos operaciones legítimas comparten monto</td>
        <td>Matching por tupla de señales con condición de unicidad, nunca por importe solo</td></tr>
    <tr><td class="m"><b>D</b></td><td><b>Acreditación no inmediata</b></td>
        <td>Lo enviado y lo acreditado son dos universos que se cruzan más tarde</td>
        <td>Dos ejes de estado separados: proceso y acreditación</td></tr>
    <tr><td class="m"><b>E</b></td><td><b>Acreditaciones parciales o progresivas</b></td>
        <td>El total enviado de un cliente difiere del acreditado en un momento dado</td>
        <td>Totales por cliente en vivo: enviado / acreditado / pendiente</td></tr>
    <tr><td class="m"><b>F</b></td><td><b>Canales dispersos</b><br><span class="mini">Gmail, WhatsApp, Excel, Drive</span></td>
        <td>No hay bandeja única: algo se puede perder y nadie se entera</td>
        <td>Una bandeja de acreditaciones, con el archivo origen archivado</td></tr>
    <tr style="background:var(--neg-wash) !important"><td class="m"><b>G</b></td>
        <td><b>Tracking manual</b><br><span class="mini" style="color:var(--neg)">colores, filtros, marcas, sumas a mano</span></td>
        <td>El estado no es un dato: no se puede consultar, ni auditar, ni repartir entre dos personas</td>
        <td><b>Estados explícitos y persistidos</b></td></tr>
  </tbody>
</table>
</div>

<div class="g2" style="margin-top:4mm">
  <div class="aviso no nada">
    <p><b>El pain point G es el que ordena todo el diseño.</b></p>
    <p style="margin-bottom:0">El resto son consecuencias suyas. Por eso el principio de
    UX número 5 dice: <em>el estado vive en el dato, no en el color de la celda</em>.</p>
  </div>
  <div class="card wa nada">
    <span class="rot" style="color:var(--warn)">Y los defectos del sistema contable actual</span>
    <p class="mini" style="color:var(--ink-2)">Documentados en <code>LEGACY_BUGS.md</code>
    y vigentes en producción. <b>Dos de ellos pierden plata</b>: una operación que mezcla
    efectivo y transferencia, y una que mezcla dólares con pesos convertidos. Se pueden
    cuantificar en pesos exactos apenas tengamos un export del histórico.</p>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Los otros cuatro: el saldo
    se muestra antes de terminar de calcularse, dos movimientos idénticos se colapsan en
    uno, la protección contra procesos simultáneos falla en abierto, y el cierre de cuenta
    puede variar entre corridas.</p>
  </div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  06 · Qué existe actualmente
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("06", "Qué existe actualmente en la app", "Auditado sobre el código, no sobre documentación previa", f"""
<div class="g4" style="margin-bottom:3.6mm">
  <div class="card pl" style="text-align:center">
    <div class="med" style="color:var(--pos)">273</div>
    <div class="mini" style="margin-top:1mm"><code>npm test</code><br>13 archivos · 54 salteados</div></div>
  <div class="card pl" style="text-align:center">
    <div class="med" style="color:var(--pos)">0</div>
    <div class="mini" style="margin-top:1mm"><code>tsc --noEmit</code><br>sin errores de tipo</div></div>
  <div class="card pl" style="text-align:center">
    <div class="med" style="color:var(--pos)">0</div>
    <div class="mini" style="margin-top:1mm"><code>eslint --max-warnings=0</code><br>sin advertencias</div></div>
  <div class="card pl" style="text-align:center">
    <div class="med" style="color:var(--pos)">11</div>
    <div class="mini" style="margin-top:1mm"><code>next build</code><br>rutas compiladas</div></div>
</div>

<div class="g3" style="margin-bottom:3mm">
  {captura("inicio", "Inicio", "· resumen del día por moneda")}
  {captura("carga", "Carga", "· grilla con pegado desde Excel")}
  {captura("cuenta", "Cuenta corriente", "· tira de saldos y libro")}
</div>
<div class="g3">
  {captura("cuentas", "Cuentas", "· saldo por contraparte")}
  {captura("balance", "Balance", "· totales por moneda")}
  {captura("auditoria", "Auditoría", "· solo los campos que cambiaron")}
</div>

<p class="mini" style="margin-top:3mm">Rutas reales: <code>/</code> · <code>/login</code> ·
<code>/inicio</code> · <code>/carga</code> · <code>/cuentas</code> ·
<code>/cuentas/[id]</code> · <code>/balance</code> · <code>/ajustes</code> ·
<code>/auditoria</code> · <code>/api/export</code>. Nueve pantallas más la portada, todas
navegables con dataset de demostración determinístico.</p>"""))

# ═════════════════════════════════════════════════════════════════════════
#  07 · El motor financiero
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("07", "El motor financiero que ya está", "Volumen de código y garantías verificadas", """
<div class="g23">
  <div class="nada">
    <div class="tbl">
    <table>
      <thead><tr><th>Área</th><th class="r">Líneas</th><th class="r">Arch.</th><th>Qué es</th></tr></thead>
      <tbody>
        <tr><td class="m">src/app</td><td class="num">3026</td><td class="num">24</td><td>rutas, pantallas y Server Actions</td></tr>
        <tr><td class="m">tests</td><td class="num">3146</td><td class="num">20</td><td>273 tests, con paridad contra PostgreSQL 18 real</td></tr>
        <tr><td class="m">src/components</td><td class="num">1815</td><td class="num">7</td><td>sistema de diseño, grilla, riel</td></tr>
        <tr><td class="m">supabase/migrations</td><td class="num">976</td><td class="num">4</td><td>esquema, vistas, RLS, operaciones atómicas</td></tr>
        <tr><td class="m">src/lib/data</td><td class="num">932</td><td class="num">3</td><td>capa de acceso + almacén de demostración</td></tr>
        <tr><td class="m">src/lib/migracion</td><td class="num">910</td><td class="num">4</td><td>importador del histórico, cero pérdida silenciosa</td></tr>
        <tr><td class="m">src/lib/domain</td><td class="num">863</td><td class="num">7</td><td>dinero, tipo de cambio, saldos, parseo</td></tr>
        <tr><td class="m">src/lib/observabilidad</td><td class="num">219</td><td class="num">2</td><td>medición sin registrar importes ni secretos</td></tr>
        <tr><td class="m">src/lib/supabase</td><td class="num">36</td><td class="num">2</td><td>clientes de navegador y servidor</td></tr>
      </tbody>
    </table>
    </div>
    <p class="mini" style="margin-top:2.4mm"><b>Ninguna de estas áreas se reescribe.</b>
    Lo más agresivo que propone este informe es partir <code>src/lib/data/index.ts</code>
    en tres módulos y extraer un componente reutilizable de la grilla.</p>
  </div>

  <div class="nada">
    <h3>Las garantías que ya están verificadas</h3>
    <ul class="pl">
      <li><b>Modelo movimiento + partidas.</b> Un movimiento tiene N partidas, una por
      pata monetaria. Reemplaza la fila ancha de dieciséis columnas del legacy, donde el
      medio de pago estaba codificado en cuál columna llenabas.</li>
      <li><b>Cuatro monedas</b> —ARS, USD, EUR, BRL— que nunca se suman entre sí.</li>
      <li><b>Redondeo idéntico a Postgres.</b> Replica el medio-lejos-de-cero de
      <code>round(numeric)</code> con épsilon relativo acotado, y hay tests de paridad
      contra PostgreSQL 18 corriendo en WASM.</li>
      <li><b>Conversión y comisión</b> en el mismo orden que la columna generada de la
      base: la comisión se aplica <em>antes</em> de dividir por el tipo de cambio.</li>
      <li><b>Orden canónico del saldo corrido</b>: fecha → ajuste de cierre al final →
      orden → id. Resuelve el defecto por el que el cierre variaba entre corridas.</li>
      <li><b>Seguridad por fila</b> en las cuatro vistas, con
      <code>security_invoker = true</code>. Sin eso, una vista se salta el RLS.</li>
      <li><b>Auditoría por triggers</b> sobre movimientos, partidas y contrapartes, con
      valor anterior, valor nuevo y motivo.</li>
    </ul>

    <div class="aviso wa nada" style="margin-top:1mm">
      <span class="rot" style="color:var(--warn)">Lo que existe y todavía no se probó</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1.2mm">Los <b>54 tests de
      Supabase</b> están escritos y nunca corrieron: necesitan una instancia real. Están
      <code>READY TO TEST</code>, no <code>TESTED</code>. La distinción se mantiene.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0">El <b>modo
      demostración</b> usa un almacén en memoria. Ejercita los mismos caminos de código
      que la versión con base, pero no aplica RLS ni valida invariantes: esas garantías son
      de Postgres.</p>
    </div>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  08 · Qué conservamos
# ═════════════════════════════════════════════════════════════════════════
_REUSE = [
    ("lib/domain · dinero · fx · saldos", "keep", "REUSE AS-IS", "Verificado contra PostgreSQL real. Tocarlo es riesgo puro."),
    ("lib/domain · parseo · contrapartes", "keep", "REUSE AS-IS", "La interpretación de categorías y la normalización de nombres sirven igual para la ingesta."),
    ("lib/format · parseMonto", "keep", "REUSE AS-IS", "Acepta <code>1.234,56</code>, <code>(1.500)</code>, <code>$ 1.500</code>. Es lo que necesita la ingesta."),
    ("supabase/migrations 0001–0004", "keep", "KEEP + ADD", "El esquema contable no se toca. La mitad operativa se agrega al lado, en 4 migraciones nuevas."),
    ("lib/migracion · importador", "red", "REUSE + GENERALIZE", "Ya tiene 5 estados que garantizan cero pérdida silenciosa. Es el contrato que necesita la ingesta de Excel."),
    ("components/ui · 21 componentes", "keep", "REUSE AS-IS", "Sistema consolidado: tokens, 7 niveles de tipografía, variante oscura."),
    ("components/grid · CargaGrid", "red", "REFACTOR", "El preview de la importación <b>es</b> una grilla editable con errores por celda, pegado y deshacer. <b>La mejor palanca del proyecto.</b>"),
    ("components/shell · Rail", "red", "REUSE + EXTEND", "Ya soporta grupos. Faltan los ítems nuevos y los contadores de pendientes."),
    ("lib/data/index.ts", "red", "REFACTOR", "Hoy es un módulo plano para un dominio. Pasa a contabilidad / acreditaciones / conciliación. Mismo patrón, más archivos."),
    ("lib/data · memoria · dataset", "red", "REUSE + EXTEND", "Sumar el dataset operativo para poder demostrar los módulos nuevos sin datos reales."),
    ("lib/observabilidad", "keep", "REUSE AS-IS", "Nunca registra importes, saldos, nombres ni tokens."),
    ("lib/auth · proxy.ts", "keep", "REUSE AS-IS", "La frontera de seguridad es RLS + <code>exigirSesion()</code>, no el proxy. Solo sumar rutas al matcher."),
    ("app · /cuentas · /cuentas/[id]", "red", "REUSE + EXTEND", "El libro funciona. Se le suma el resumen enviado / acreditado / pendiente en pestañas."),
    ("app · /balance", "keep", "REUSE AS-IS", "Cumple su función."),
    ("app · /carga", "keep", "REUSE AS-IS", "Es el activo de velocidad del producto. No se toca."),
    ("app · /auditoria", "red", "REUSE + EXTEND", "El diff por campo ya está y está testeado. Solo hay que registrar las entidades nuevas."),
    ("app · /ajustes", "fus", "EXISTE — FUSIONAR", "Es una acción sobre una cuenta, no una sección. El enlace profundo ya existe."),
    ("app · /inicio", "red", "EXISTE — REDISEÑAR", "Hoy responde «qué pasó hoy» en lo contable. Falta el pipeline operativo."),
    ("app · portada", "red", "REUSE + AJUSTAR", "Reconstruida hace poco. Solo falta que el relato incluya la conciliación."),
    ("api/export", "red", "REUSE + EXTEND", "Mismo formato: <code>;</code> + BOM UTF-8, números en formato argentino."),
    ("tests · 273", "keep", "KEEP", "Ni un test de dominio se reescribe. Se agregan los de los módulos nuevos."),
]
_ET = {"keep": "et-keep", "red": "et-red", "new": "et-new", "fus": "et-fus", "del": "et-del"}
_filas_reuse = "".join(
    f'<tr><td class="m">{a}</td>'
    f'<td><span class="et {_ET[k]}">{e}</span></td>'
    f'<td>{d}</td></tr>'
    for a, k, e, d in _REUSE
)

pagina(hoja("08", "Qué conservamos", "Matriz de reutilización · 21 áreas auditadas", f"""
<div class="g23">
  <div class="tbl micro">
  <table>
    <thead><tr><th style="width:30%">Área</th><th style="width:19%">Acción</th>
      <th style="width:51%">Por qué</th></tr></thead>
    <tbody>{_filas_reuse}</tbody>
  </table>
  </div>

  <div class="nada">
    <div class="card ok" style="margin-bottom:3mm">
      <span class="rot" style="color:var(--pos)">Lo que se descarta</span>
      <p style="font-size:11pt;font-weight:680;margin:1.2mm 0 1.2mm">Nada.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0">Ninguna pieza del trabajo
      existente se tira. Lo más agresivo que propone este informe es <b>mover Ajustes de
      la navegación a la pantalla del cliente</b>, y <b>rediseñar la Home</b>.</p>
    </div>

    <h3>La palanca más grande</h3>
    <p class="mini">El preview de la importación de Excel <b>es</b> una grilla editable con
    errores por celda, pegado desde el portapapeles y deshacer — exactamente lo que
    <code>CargaGrid</code> ya hace y tiene probado.</p>
    <p class="mini">Se propone extraer un <code>GrillaEditable</code> genérico y que las
    dos pantallas lo usen. Es la mejor relación entre esfuerzo y resultado de todo el
    proyecto: el comportamiento ya está escrito.</p>

    <h3 style="margin-top:2.6mm">La segunda palanca</h3>
    <p class="mini" style="margin-bottom:0"><code>lib/migracion/importador.ts</code> ya
    implementa cinco estados que garantizan que ninguna fila desaparece en silencio. Se
    escribió para el CSV del histórico legacy, y es <b>exactamente el contrato</b> que
    necesita la ingesta de Excel.</p>
  </div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  09 · Qué cambia
# ═════════════════════════════════════════════════════════════════════════
_CAMBIA = [
    ("Portada", "Hero con el producto real, tres pilares, vista de carga, cierre",
     "Igual, sumando la capacidad de conciliación al relato", "red"),
    ("Ingreso", "Dos paneles, modo demostración sin contraseña",
     "Igual, más selector de oficina al entrar <span class='et et-val'>TO VALIDATE</span>", "red"),
    ("Home", "Neto del día por moneda, actividad reciente, requiere atención, accesos",
     "<b>Centro de operaciones</b>: pipeline del día, conciliación, estado por cliente, y después la plata", "red"),
    ("Navegación", "Inicio · Carga · Cuentas · Balance · Ajustes · Auditoría",
     "Cuatro grupos: Operación · Cuentas · Control · Configuración. <b>Ajustes sale del riel</b>", "red"),
    ("Carga", "Grilla AG Grid, pegado desde Excel, impacto en vivo",
     "<b>Sin cambios.</b> Convive con la ingesta de archivos bajo el grupo Operación", "keep"),
    ("Acreditaciones", "<span style='color:var(--neg)'>no existe</span>",
     "<b>Módulo nuevo</b>: bandeja de lo que los clientes mandaron, con estados explícitos", "new"),
    ("Conciliación", "<span style='color:var(--neg)'>no existe</span>",
     "<b>Módulo nuevo</b>: enviado contra acreditado, con matching asistido", "new"),
    ("Importación", "Solo el importador del histórico legacy, por línea de comandos",
     "<b>Pantalla nueva</b>: subir Excel, validar, previsualizar, corregir, confirmar", "new"),
    ("Cuentas", "Listado con saldo por moneda y estado",
     "Igual, más filtro cliente / proveedor y columna de pendiente de acreditación", "red"),
    ("Cuenta corriente", "Tira de saldos, libro con saldo corrido, corte de cierre, panel de partidas",
     "Igual, dentro de una pantalla de cliente con pestañas: Resumen · Cuenta corriente · Transferencias · Errores", "keep"),
    ("Balance", "Totales por moneda + tabla + export",
     "<b>Sin cambios.</b>", "keep"),
    ("Ajustes", "Pantalla propia con selector de contraparte",
     "Acción dentro del cliente. Misma lectura vertical actual → ajuste → resultante", "fus"),
    ("Auditoría", "Filtros, tabla, panel con solo los campos que cambiaron",
     "Igual, sumando lotes, transferencias y decisiones de conciliación", "red"),
    ("Configuración", "<span style='color:var(--neg)'>no existe</span>",
     "<b>Pantalla nueva</b>: oficinas, usuarios y roles, mapeo de columnas por cliente, tolerancias de matching", "new"),
]
_ETQ = {"keep": ("et-keep", "MANTENER"), "red": ("et-red", "AJUSTAR"),
        "new": ("et-new", "NUEVA"), "fus": ("et-fus", "FUSIONAR")}
_filas_cambia = "".join(
    f'<tr><td><b>{n}</b></td><td class="mini">{h}</td><td>{pr}</td>'
    f'<td class="c"><span class="et {_ETQ[k][0]}">{_ETQ[k][1]}</span></td></tr>'
    for n, h, pr, k in _CAMBIA
)

pagina(hoja("09", "Qué cambia", "Hoy contra la propuesta, pantalla por pantalla", f"""
<div class="tbl zebra">
<table>
  <thead><tr><th style="width:13%"></th><th style="width:31%">Hoy</th>
    <th style="width:44%">Propuesta</th><th style="width:12%" class="c">Veredicto</th></tr></thead>
  <tbody>{_filas_cambia}</tbody>
</table>
</div>
<div class="g3" style="margin-top:3.6mm">
  <div class="card ok nada"><span class="rot" style="color:var(--pos)">Sin cambios</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Carga · Balance · Cuenta
    corriente. Las tres funcionan y responden lo que tienen que responder.</p></div>
  <div class="card br nada"><span class="rot" style="color:var(--brand)">Nuevo</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Acreditaciones ·
    Conciliación · Importación · Configuración. Cuatro pantallas donde hoy no hay nada.</p></div>
  <div class="card wa nada"><span class="rot" style="color:var(--warn)">Se ajusta</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Home es el rediseño de
    fondo. El resto son extensiones sobre pantallas que ya andan.</p></div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  10 · Arquitectura de información
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("10", "Arquitectura de información propuesta", "Cinco decisiones de estructura, con su razón", """
<div class="g32">
  <div class="nada">
    <div class="card pl" style="margin-bottom:3.4mm">
      <span class="rot">El criterio</span>
      <p style="margin:1.2mm 0 1.6mm">La estructura se organiza alrededor de <b>las
      preguntas que alguien hace</b>, no alrededor de las tablas de la base. Cada pantalla
      responde una pregunta y se llama como la pregunta.</p>
      <div class="tbl" style="background:var(--surface)">
      <table>
        <tbody>
          <tr><td class="mini">¿Qué pasó hoy? ¿Dónde está trabado el trabajo?</td><td><b>Inicio</b></td></tr>
          <tr><td class="mini">¿Qué me mandaron y qué está listo para enviar?</td><td><b>Acreditaciones</b></td></tr>
          <tr><td class="mini">¿Qué envié y qué se acreditó?</td><td><b>Conciliación</b></td></tr>
          <tr><td class="mini">¿Cómo cargo lo que no vino en un archivo?</td><td><b>Carga</b></td></tr>
          <tr><td class="mini">¿Cuánto nos debe cada uno?</td><td><b>Cuentas</b></td></tr>
          <tr><td class="mini">¿Qué pasó con este cliente?</td><td><b>Cliente</b></td></tr>
          <tr><td class="mini">¿Cuánto hay en total, por moneda?</td><td><b>Balance</b></td></tr>
          <tr><td class="mini">¿Quién cambió qué?</td><td><b>Auditoría</b></td></tr>
        </tbody>
      </table>
      </div>
    </div>

    <h3>Grupos del riel</h3>
    <pre class="ascii">(sin grupo)   <b>Inicio</b>
OPERACIÓN     <b>Acreditaciones</b> · <b>Conciliación</b> · <b>Carga</b>
CUENTAS       <b>Cuentas</b> · <b>Balance</b>
CONTROL       <b>Auditoría</b> · <b>Configuración</b></pre>
    <p class="mini" style="margin-top:2mm;margin-bottom:0">Los ítems de Operación llevan
    contador de pendientes en el riel: es la única forma de que el operador sepa que hay
    trabajo sin entrar a mirar.</p>
  </div>

  <div class="nada">
    <ol class="num">
      <li><b>Acreditaciones y Conciliación son dos pantallas, no una.</b>
        <span class="mini" style="display:block">Comparten datos pero responden preguntas
        distintas, en momentos distintos del día: a la mañana se recibe y se envía, a la
        tarde se concilia. Fusionarlas obligaría a un selector de modo, que es exactamente
        el «filtro que alguien dejó puesto» que estamos tratando de eliminar. Van cruzadas
        por enlaces profundos en las dos direcciones.</span></li>

      <li><b>Importar no es una sección: es una acción de Acreditaciones.</b>
        <span class="mini" style="display:block">Vive en
        <code>/acreditaciones/importar</code> como un flujo de pasos. Nadie entra a la
        aplicación a «usar el importador»; entra a procesar lo que le mandó un cliente.</span></li>

      <li><b>Cliente y cuenta corriente son una sola pantalla con pestañas.</b>
        <span class="mini" style="display:block">La operación es información <b>del mismo
        cliente</b>, y separarla obligaría a saltar entre dos pantallas para responder
        «¿le debemos, o le falta acreditar?». La alternativa —una pantalla operativa y otra
        contable— se descarta porque duplica la búsqueda y la cabecera.</span></li>

      <li><b>Ajustes sale de la navegación.</b>
        <span class="mini" style="display:block">Un ajuste es una acción sobre <b>una</b>
        cuenta. Tenerlo como ítem de menú obliga a elegir la contraparte de nuevo, cuando
        lo natural es llegar desde su libro. El enlace profundo ya existe.</span></li>

      <li><b>«Clientes» y «Contrapartes» son la misma tabla.</b>
        <span class="mini" style="display:block">En el modelo una contraparte puede ser
        cliente, proveedor o los dos: el esquema ya tiene <code>es_cliente</code> y
        <code>es_proveedor</code>. Crear dos entradas de navegación para la misma tabla es
        cómo empiezan los duplicados. Una sola pantalla, <b>Cuentas</b>, con filtro por
        tipo.</span></li>
    </ol>

    <div class="aviso" style="margin-top:1mm">
      <p style="margin-bottom:0">La hipótesis inicial tenía un grupo <b>Finanzas</b> con
      Balance y Ajustes. Se descarta: Ajustes deja de ser pantalla, y Balance solo no
      justifica un grupo. Queda bajo <b>Cuentas</b>, que es desde donde se lo consulta.</p>
    </div>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  11 · Sitemap
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("11", "Sitemap", "El árbol completo · en negro lo que ya existe", """
<div class="g23">
  <pre class="ascii"><b>/</b>                                   Portada · pública
│
└── <b>/login</b>                          Ingreso
    │
    └── APP · requiere sesión
        │
        ├── <b>/inicio</b>                 Centro de operaciones
        │
        ├── OPERACIÓN
        │   ├── <i>/acreditaciones</i>                 Bandeja
        │   │   ├── <i>/importar</i>                   Ingesta de Excel · pasos
        │   │   ├── <i>/lote/[id]</i>                  Un archivo recibido
        │   │   └── <i>/[id]</i>                       Una transferencia · panel
        │   │
        │   ├── <i>/conciliacion</i>                   Enviado vs acreditado
        │   │   ├── <i>/importar</i>                   Ingesta de «Ingresos y créditos»
        │   │   └── <i>/[id]</i>                       Un caso a resolver
        │   │
        │   └── <b>/carga</b>                          Grilla diaria
        │
        ├── CUENTAS
        │   ├── <b>/cuentas</b>                        Listado
        │   │   └── <b>/[id]</b>                       Cliente
        │   │       ├── <b>?tab=resumen</b>            Enviado · acreditado · pendiente
        │   │       ├── <b>?tab=cuenta</b>             Cuenta corriente
        │   │       ├── <i>?tab=transferencias</i>     Historial operativo
        │   │       ├── <i>?tab=errores</i>            CUIT y validaciones
        │   │       └── <b>/ajustar</b>                Ajuste a cero · se muda acá
        │   │
        │   └── <b>/balance</b>                        Balance general
        │
        ├── CONTROL
        │   ├── <b>/auditoria</b>                      Registro de cambios
        │   └── <i>/configuracion</i>
        │       ├── <i>/oficinas</i>
        │       ├── <i>/usuarios</i>                   Roles y alcance
        │       ├── <i>/clientes-archivos</i>          Mapeo de columnas por cliente
        │       └── <i>/conciliacion</i>               Tolerancias de matching
        │
        └── <b>/api/export</b>                         CSV · se extiende</pre>

  <div class="nada">
    <div class="card pl" style="margin-bottom:3mm">
      <span class="rot">Cómo leerlo</span>
      <p class="mini" style="color:var(--ink-2);margin:1.4mm 0 1mm">
      <b style="color:var(--ink)">En negro</b> · existe hoy y se conserva.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0">
      <em>En azul</em> · nuevo.</p>
    </div>

    <div class="g2" style="gap:3mm">
      <div class="card ok nada" style="text-align:center">
        <div class="med" style="color:var(--pos)">10</div>
        <p class="mini" style="color:var(--ink-2);margin:1mm 0 0">rutas que ya existen</p>
      </div>
      <div class="card br nada" style="text-align:center">
        <div class="med" style="color:var(--brand)">13</div>
        <p class="mini" style="color:var(--ink-2);margin:1mm 0 0">rutas nuevas</p>
      </div>
    </div>

    <h3 style="margin-top:3.4mm">Profundidad</h3>
    <p class="mini">Ninguna pantalla queda a más de <b>tres clics</b> desde Inicio, y las
    dos más frecuentes —Acreditaciones y Conciliación— quedan a uno.</p>

    <h3 style="margin-top:3mm">Las subrutas de cliente son pestañas, no páginas</h3>
    <p class="mini" style="margin-bottom:0">Se implementan como parámetro de búsqueda
    sobre la misma ruta para que la cabecera con los cuatro números operativos no se
    recargue al cambiar de pestaña, y para que un enlace a una pestaña específica se pueda
    compartir.</p>
  </div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  12 · Módulos principales
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("12", "Módulos principales", "Siete módulos, y una sola costura entre las dos mitades", """
<div class="flujo" style="margin-bottom:2mm">
  <div class="nodo br"><div class="t">Ingesta</div>
    <div class="d">Leer un archivo, normalizarlo, validarlo y no perder nada en silencio</div></div>
  <div class="fl">→</div>
  <div class="nodo br"><div class="t">Acreditaciones</div>
    <div class="d">Ser la bandeja única de lo que los clientes mandaron, con estado explícito</div></div>
  <div class="fl">→</div>
  <div class="nodo br"><div class="t">Conciliación</div>
    <div class="d">Comparar enviado contra acreditado y registrar la decisión con su evidencia</div></div>
  <div class="fl">→</div>
  <div class="nodo"><div class="t">Cuentas</div>
    <div class="d">Saldo por contraparte y por moneda, libro y cierres</div></div>
  <div class="fl">→</div>
  <div class="nodo"><div class="t">Balance</div>
    <div class="d">Totales por moneda, sin mezclar</div></div>
</div>
<div class="g2" style="gap:4mm;margin-bottom:3.6mm">
  <div class="mini" style="text-align:center;color:var(--brand);font-weight:640">
    ↑ NUEVO · la mitad operativa</div>
  <div class="mini" style="text-align:center;color:var(--pos);font-weight:640">
    ↑ EXISTE · la mitad contable, alimentada también por Carga manual</div>
</div>

<div class="g23">
  <div class="tbl">
  <table>
    <thead><tr><th style="width:20%">Módulo</th><th style="width:60%">Responsabilidad</th>
      <th style="width:20%" class="c">Estado</th></tr></thead>
    <tbody>
      <tr><td><b>Ingesta</b></td><td>Leer un archivo, normalizarlo, validarlo y no perder nada en silencio</td><td class="c"><span class="et et-new">NUEVO</span></td></tr>
      <tr><td><b>Acreditaciones</b></td><td>Ser la bandeja única de lo que los clientes mandaron, con estado explícito</td><td class="c"><span class="et et-new">NUEVO</span></td></tr>
      <tr><td><b>Conciliación</b></td><td>Comparar enviado contra acreditado y registrar la decisión con su evidencia</td><td class="c"><span class="et et-new">NUEVO</span></td></tr>
      <tr><td><b>Carga manual</b></td><td>Registrar movimientos que no vienen de un archivo, a velocidad de Excel</td><td class="c"><span class="et et-keep">EXISTE</span></td></tr>
      <tr><td><b>Cuentas</b></td><td>Saldo por contraparte y por moneda, libro y cierres</td><td class="c"><span class="et et-keep">EXISTE</span></td></tr>
      <tr><td><b>Balance</b></td><td>Totales por moneda, sin mezclar</td><td class="c"><span class="et et-keep">EXISTE</span></td></tr>
      <tr><td><b>Auditoría</b></td><td>Quién, qué, cuándo, valor anterior y nuevo — en las dos mitades</td><td class="c"><span class="et et-red">EXTENDER</span></td></tr>
    </tbody>
  </table>
  </div>

  <div class="nada">
    <div class="aviso">
      <span class="rot" style="color:var(--brand)">La costura</span>
      <p style="font-family:var(--mono);font-size:8pt;font-weight:700;color:var(--brand-lo);margin:1.4mm 0 1.6mm">
      una conciliación confirmada<br>genera el movimiento contable</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0">Es el único punto donde
      las dos mitades se tocan. Todo el resto de la integración es lectura: la pantalla de
      cliente muestra las dos cosas, pero no las mezcla.</p>
    </div>

    <h3 style="margin-top:3.4mm">Por qué es una sola línea</h3>
    <p class="mini">Si cada transferencia fuera un movimiento contable, la cuenta corriente
    de un cliente activo tendría 600 filas por día y sería ilegible. La conciliación
    <b>agrega</b>: N transferencias confirmadas producen un movimiento con sus partidas.</p>

    <h3 style="margin-top:3mm">Y por qué eso es una decisión, no una implementación</h3>
    <p class="mini" style="margin-bottom:0">A qué nivel se agrupa —por transferencia, por
    lote y cliente, o por cliente y día— es la decisión <b>N1</b> y es bloqueante. Hasta
    que se responda, el módulo se construye dejando la decisión aislada en un solo punto
    del código, para que cambiarla después sea cambiar una función y no rehacer el
    módulo.</p>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  13 · Home
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("13", "Home", "Centro de operaciones · wireframe", """
<div class="g23">
  <div class="wf">
    <div class="wf-top">
      <span class="ti">Hoy</span>
      <span class="me">lunes 7 de septiembre de 2026 · 418 transferencias · <span class="dot" style="background:var(--pos)"></span> saldos al día</span>
      <span style="margin-left:auto" class="me">Nordelta ▾&nbsp;&nbsp;usuario ▾</span>
    </div>
    <div class="wf-body">
      <div class="wf-side">
        <div class="s-i on">▣ Inicio</div>
        <div class="s-g">Operación</div>
        <div class="s-i">▤ Acreditaciones<span class="b">26</span></div>
        <div class="s-i">⇄ Conciliación<span class="b">12</span></div>
        <div class="s-i">▦ Carga</div>
        <div class="s-g">Cuentas</div>
        <div class="s-i">◎ Cuentas</div>
        <div class="s-i">▥ Balance</div>
        <div class="s-g">Control</div>
        <div class="s-i">◇ Auditoría</div>
        <div class="s-i">⚙ Configuración</div>
      </div>
      <div class="wf-main">
        <div class="wf-blk">
          <span class="rot">Pipeline del día</span>
          <div class="pipe">
            <div><div class="k">Recibidas</div><div class="v">418</div><div class="s">$ 84,2 M</div></div>
            <div><div class="k">Validadas</div><div class="v">392</div><div class="s">$ 79,1 M</div></div>
            <div><div class="k">Listas</div><div class="v">392</div><div class="s">$ 79,1 M</div></div>
            <div><div class="k">Enviadas</div><div class="v">341</div><div class="s">$ 68,4 M</div></div>
            <div><div class="k">Acreditadas</div><div class="v" style="color:var(--pos)">259</div><div class="s">$ 51,9 M</div></div>
            <div><div class="k">Pendientes</div><div class="v">82</div><div class="s">$ 16,5 M</div></div>
            <div class="alerta"><div class="k">Error</div><div class="v">26</div><div class="s">$ 5,1 M</div></div>
          </div>
          <p class="mini" style="margin:1.4mm 0 0;font-size:6.8pt">cada etapa es un enlace a la bandeja ya filtrada</p>
        </div>

        <div style="display:grid;grid-template-columns:1.15fr 1fr;gap:2mm">
          <div class="wf-blk br">
            <span class="rot" style="color:var(--brand)">Conciliación</span>
            <div class="wf-r"><span class="nm" style="flex:0 0 8mm;font-weight:640">247</span><span>match exacto</span><span style="margin-left:auto" class="mini">confirmados</span></div>
            <div class="wf-r"><span class="nm" style="flex:0 0 8mm;font-weight:700;color:var(--brand)">12</span><span><b>posible match</b></span><span style="margin-left:auto" class="mini">a decidir</span></div>
            <div class="wf-r"><span class="nm" style="flex:0 0 8mm;font-weight:640">82</span><span>sin match</span><span style="margin-left:auto" class="mini">pendientes</span></div>
            <div style="margin-top:1.6mm"><span class="btn pri">Conciliar 12</span>
              <span class="mini" style="margin-left:1.6mm;font-size:6.6pt">acción primaria de la pantalla</span></div>
          </div>
          <div class="wf-blk">
            <span class="rot">Requiere atención</span>
            <div class="wf-r"><span class="nm" style="flex:0 0 7mm;font-weight:640;color:var(--neg)">26</span><span>CUIT inválido</span></div>
            <div class="wf-r"><span class="nm" style="flex:0 0 7mm;font-weight:640">9</span><span>CUIT desconocido</span></div>
            <div class="wf-r"><span class="nm" style="flex:0 0 7mm;font-weight:640">4</span><span>importe fuera de rango</span></div>
            <div class="wf-r"><span class="nm" style="flex:0 0 7mm;font-weight:640">2</span><span>archivo sin cliente asignado</span></div>
            <div class="wf-r"><span class="nm" style="flex:0 0 7mm;font-weight:640;color:var(--warn)">1</span><span>lote sin enviar de ayer</span></div>
          </div>
        </div>

        <div class="wf-blk">
          <span class="rot">Estado por cliente <span style="text-transform:none;letter-spacing:0">· ordenado por pendiente ↓</span></span>
          <div class="wf-h"><span style="flex:1">Cliente</span><span style="flex:0 0 15mm;text-align:right">Enviado</span>
            <span style="flex:0 0 15mm;text-align:right">Acreditado</span><span style="flex:0 0 15mm;text-align:right">Pendiente</span>
            <span style="flex:0 0 7mm;text-align:right">Err</span><span style="flex:0 0 18mm">Estado</span></div>
          <div class="wf-r"><span style="flex:1;font-weight:620">Cliente A</span><span class="nm" style="flex:0 0 15mm;text-align:right">$ 24,0 M</span>
            <span class="nm" style="flex:0 0 15mm;text-align:right">$ 12,4 M</span><span class="nm" style="flex:0 0 15mm;text-align:right;font-weight:640">$ 11,6 M</span>
            <span class="nm" style="flex:0 0 7mm;text-align:right">3</span><span style="flex:0 0 18mm"><span class="dot" style="background:var(--warn)"></span> parcial</span></div>
          <div class="wf-r"><span style="flex:1;font-weight:620">Cliente B</span><span class="nm" style="flex:0 0 15mm;text-align:right">$ 18,2 M</span>
            <span class="nm" style="flex:0 0 15mm;text-align:right">$ 18,2 M</span><span class="nm" style="flex:0 0 15mm;text-align:right;color:var(--ink-4)">—</span>
            <span class="nm" style="flex:0 0 7mm;text-align:right;color:var(--ink-4)">—</span><span style="flex:0 0 18mm"><span class="dot" style="background:var(--pos)"></span> completo</span></div>
          <div class="wf-r"><span style="flex:1;font-weight:620">Cliente C</span><span class="nm" style="flex:0 0 15mm;text-align:right">$ 9,4 M</span>
            <span class="nm" style="flex:0 0 15mm;text-align:right">$ 4,5 M</span><span class="nm" style="flex:0 0 15mm;text-align:right;font-weight:640">$ 4,9 M</span>
            <span class="nm" style="flex:0 0 7mm;text-align:right;color:var(--neg)">12</span><span style="flex:0 0 18mm"><span class="dot" style="background:var(--neg)"></span> con errores</span></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2mm">
          <div class="wf-blk pl">
            <span class="rot">Neto del día por moneda</span>
            <div style="display:flex;gap:3mm">
              <div><div class="rot">ARS</div><div class="nm" style="color:var(--pos);font-weight:640">+6,45 M</div></div>
              <div><div class="rot">USD</div><div class="nm" style="color:var(--pos);font-weight:640">+18.286</div></div>
              <div><div class="rot">EUR</div><div class="nm" style="color:var(--pos);font-weight:640">+3.400</div></div>
              <div><div class="rot">BRL</div><div class="nm" style="color:var(--pos);font-weight:640">+2.600</div></div>
            </div>
          </div>
          <div class="wf-blk pl">
            <span class="rot">Actividad reciente</span>
            <div class="mini" style="font-size:6.8pt">10:42 conciliación confirmada · Cliente A</div>
            <div class="mini" style="font-size:6.8pt">10:31 lote importado · 218 filas</div>
            <div class="mini" style="font-size:6.8pt">09:58 movimiento cargado · Puertos</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="nada">
    <h3>Qué tiene que responder</h3>
    <p class="mini">En orden de urgencia: <b>¿dónde está trabado el trabajo?</b> después
    <b>¿qué necesita mi decisión?</b> después <b>¿a quién afecta?</b> y al final
    <b>¿cuánta plata se movió?</b></p>
    <p class="mini">Eso descarta la Home de cuatro tarjetas y un gráfico: las tarjetas no
    dicen dónde está el trabajo, y un gráfico de barras no se acciona.</p>

    <h3 style="margin-top:3mm">Las cinco decisiones de diseño</h3>
    <ul class="pl">
      <li><b>El pipeline es una tira, no seis tarjetas.</b> Las cifras son etapas de un
      mismo flujo; dibujarlas como tira muestra dónde se acumula el trabajo, que es justo
      la pregunta.</li>
      <li><b>Cada número es un enlace</b> a la bandeja filtrada. Un número que no se puede
      accionar no merece estar en la Home.</li>
      <li><b>Conciliación tiene la acción primaria.</b> Es lo único que requiere decisión
      humana.</li>
      <li><b>La plata va abajo.</b> No porque no importe: el saldo está siempre disponible
      en Cuentas y Balance, el trabajo trabado no.</li>
      <li><b>Sin gráficos.</b> Ninguna de las preguntas de arriba se responde mejor con un
      gráfico que con una cifra y su etiqueta.</li>
    </ul>

    <div class="card pl nada" style="margin-top:1mm">
      <span class="rot">Lo que se conserva de la Home actual</span>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0">El neto del día por
      moneda y la actividad reciente. Bajan de posición pero no cambian: ya responden bien
      su pregunta.</p>
    </div>
  </div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  14 · Acreditaciones · estados
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("14", "Acreditaciones · estados", "Dos ejes, no uno", """
<div class="aviso no" style="margin-bottom:3.6mm">
  <p style="margin-bottom:1.2mm"><b>El problema con la lista de estados de la
  conversación inicial.</b> Recibida · Pendiente de revisión · Con error · Lista para
  enviar · Enviada · Acreditada · Pendiente mezcla dos cosas distintas en un solo enum.</p>
  <p style="margin-bottom:0">Se rompe rápido: <b>una transferencia puede estar «enviada»
  y «pendiente de acreditación» al mismo tiempo.</b> Y «Pendiente» aparece dos veces
  queriendo decir cosas distintas.</p>
</div>

<div class="g2">
  <div class="nada">
    <div class="card br">
      <span class="rot" style="color:var(--brand)">Eje 1 · Estado de proceso</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 2mm">Dónde está la
      transferencia en el camino hacia el sistema externo.</p>
      <pre class="ascii limpio"><b>recibida</b> ──→ <b>validada</b> ──→ <b>lista</b> ──→ <b>enviada</b>
    │            │
    └────────────┴──→ <b>con_error</b> ──→ (corregida) ──┐
                          │                        │
                          │                        └──→ validada
                          └──→ <b>descartada</b>   ← requiere motivo</pre>
    </div>

    <div class="card ok" style="margin-top:3mm">
      <span class="rot" style="color:var(--pos)">Eje 2 · Estado de acreditación</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 2mm">Sólo aplica desde
      <code>enviada</code>. Lo determina la conciliación, no el operador.</p>
      <pre class="ascii limpio"><b>pendiente</b> ──→ <b>acreditada</b>
    │
    └──→ <b>rechazada</b>   ← el sistema externo la devolvió</pre>
    </div>

    <div class="card pl" style="margin-top:3mm">
      <span class="rot">Y el total por cliente es la suma</span>
      <div class="pipe" style="margin-top:1.4mm;background:var(--surface)">
        <div><div class="k">Enviado</div><div class="v" style="font-size:9pt">$ 24,0 M</div></div>
        <div><div class="k">Acreditado</div><div class="v" style="font-size:9pt;color:var(--pos)">$ 12,4 M</div></div>
        <div><div class="k">Pendiente</div><div class="v" style="font-size:9pt">$ 11,6 M</div></div>
      </div>
      <p class="mini" style="color:var(--ink-2);margin:1.6mm 0 0">La <b>parcialidad vive
      acá</b>, a nivel agregado. Es la lectura del pain point E.</p>
    </div>

    <div class="aviso wa" style="margin-top:3mm">
      <span class="et et-val">TO VALIDATE</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1mm"><b>N4</b> · Si una
      transferencia individual puede acreditarse parcialmente, el eje 2 necesita un monto
      acreditado además del estado.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0"><b>N6</b> · Las etiquetas
      exactas, y si hace falta un paso de aprobación antes de <code>lista → enviada</code>.</p>
    </div>
  </div>

  <div class="nada">
    <h3>Los datos de una transferencia</h3>
    <div class="tbl">
    <table>
      <thead><tr><th style="width:24%">Campo</th><th style="width:36%">Origen</th>
        <th style="width:40%">Nota</th></tr></thead>
      <tbody>
        <tr><td><b>Cliente</b></td><td>Del lote, o de una columna del archivo</td><td>Debe resolver a una contraparte</td></tr>
        <tr><td><b>Archivo origen</b></td><td>El lote</td><td>El original queda archivado</td></tr>
        <tr><td><b>Fecha</b></td><td>Del lote o del archivo</td><td></td></tr>
        <tr><td><b>CUIT</b></td><td>Del archivo</td><td>Se guarda el original <b>y</b> el normalizado</td></tr>
        <tr><td><b>Titular</b></td><td>Del archivo</td><td>Para el contraste con el CUIT</td></tr>
        <tr><td><b>Importe</b></td><td>Del archivo</td><td>Parseado con el formato argentino</td></tr>
        <tr><td><b>Moneda</b></td><td>Del archivo o por defecto</td><td><span class="et et-val">N9</span> ¿siempre ARS?</td></tr>
        <tr><td><b>Banco / CBU</b></td><td>Del archivo</td><td>Señal de matching</td></tr>
        <tr><td><b>Referencia externa</b></td><td>Del sistema externo, si la da</td><td><span class="blk">N2</span> bloqueante</td></tr>
        <tr><td><b>Estado de proceso</b></td><td>Del sistema</td><td>Eje 1</td></tr>
        <tr><td><b>Estado de acreditación</b></td><td>De la conciliación</td><td>Eje 2</td></tr>
        <tr><td><b>Errores</b></td><td>De la validación</td><td>Una lista, no un booleano</td></tr>
        <tr><td><b>Observaciones</b></td><td>Del operador</td><td>Texto libre</td></tr>
      </tbody>
    </table>
    </div>
    <p class="mini" style="margin-top:2.4mm;margin-bottom:0"><b>Errores es una lista, no un
    booleano</b>, porque una fila puede tener el CUIT mal <em>y</em> el importe ilegible,
    y el operador tiene que ver las dos cosas antes de decidir si corrige o descarta.</p>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  15 · Acreditaciones · pantalla
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("15", "Acreditaciones · pantalla", "La bandeja única · wireframe", """
<div class="wf" style="margin-bottom:3.4mm">
  <div class="wf-top">
    <span class="ti">Acreditaciones</span>
    <span class="me">418 transferencias · 26 con error · 82 pendientes de acreditar</span>
    <span style="margin-left:auto;display:flex;gap:1.4mm">
      <span class="btn">Exportar normalizado</span><span class="btn pri">Importar archivo</span></span>
  </div>
  <div class="wf-body">
    <div class="wf-side">
      <div class="s-i">▣ Inicio</div>
      <div class="s-g">Operación</div>
      <div class="s-i on">▤ Acreditaciones<span class="b" style="color:#F1F6FF">26</span></div>
      <div class="s-i">⇄ Conciliación<span class="b">12</span></div>
      <div class="s-i">▦ Carga</div>
      <div class="s-g">Cuentas</div>
      <div class="s-i">◎ Cuentas</div>
      <div class="s-i">▥ Balance</div>
      <div class="s-g">Control</div>
      <div class="s-i">◇ Auditoría</div>
      <div class="s-i">⚙ Configuración</div>
    </div>
    <div class="wf-main">
      <div class="wf-blk pl">
        <div class="wf-bar" style="margin-bottom:1.6mm">
          <span class="inp" style="max-width:44mm">⌕ buscar CUIT, titular, importe</span>
          <span class="pill on">Todas 418</span><span class="pill">Con error 26</span>
          <span class="pill">Listas 392</span><span class="pill">Enviadas 341</span>
          <span class="pill">Pendientes 82</span>
        </div>
        <div class="wf-bar">
          <span class="pill">Cliente ▾</span><span class="pill">Lote ▾</span>
          <span class="pill">Fecha ▾</span><span class="pill">Banco ▾</span>
          <span class="mini" style="margin-left:auto;font-size:6.6pt">página 1 de 9 · 50 por página</span>
        </div>
      </div>

      <div class="wf-blk" style="padding:0">
        <div class="wf-h" style="padding:1.4mm 2.2mm">
          <span style="flex:0 0 4mm">☐</span><span style="flex:0 0 24mm">CUIT</span>
          <span style="flex:1">Titular</span><span style="flex:0 0 22mm;text-align:right">Importe</span>
          <span style="flex:0 0 18mm">Banco</span><span style="flex:0 0 18mm">Proceso</span>
          <span style="flex:0 0 22mm">Acreditación</span></div>

        <div class="wf-r" style="padding:1.2mm 2.2mm"><span style="flex:0 0 4mm">☐</span>
          <span class="nm" style="flex:0 0 24mm">20-12345678-9</span>
          <span style="flex:1">Nombre del titular</span>
          <span class="nm" style="flex:0 0 22mm;text-align:right">$ 240.000,00</span>
          <span style="flex:0 0 18mm">Galicia</span>
          <span style="flex:0 0 18mm"><span class="dot" style="background:var(--ink-4)"></span> enviada</span>
          <span style="flex:0 0 22mm"><span class="dot" style="background:var(--warn)"></span> pendiente</span></div>

        <div class="wf-r" style="padding:1.2mm 2.2mm"><span style="flex:0 0 4mm">☐</span>
          <span class="nm" style="flex:0 0 24mm">27-98765432-1</span>
          <span style="flex:1">Otro titular</span>
          <span class="nm" style="flex:0 0 22mm;text-align:right">$ 85.500,00</span>
          <span style="flex:0 0 18mm">Nación</span>
          <span style="flex:0 0 18mm"><span class="dot" style="background:var(--ink-4)"></span> enviada</span>
          <span style="flex:0 0 22mm;color:var(--pos)"><span class="dot" style="background:var(--pos)"></span> acreditada</span></div>

        <div style="background:var(--neg-wash)">
          <div class="wf-r" style="padding:1.2mm 2.2mm;border-color:transparent"><span style="flex:0 0 4mm">☐</span>
            <span class="nm" style="flex:0 0 24mm;color:var(--neg)">30-1234567-8</span>
            <span style="flex:1">Titular tercero</span>
            <span class="nm" style="flex:0 0 22mm;text-align:right">$ 120.000,00</span>
            <span style="flex:0 0 18mm;color:var(--ink-4)">—</span>
            <span style="flex:0 0 18mm;color:var(--neg)"><span class="dot" style="background:var(--neg)"></span> con error</span>
            <span style="flex:0 0 22mm;color:var(--ink-4)">—</span></div>
          <div style="padding:0 2.2mm 1.4mm 30mm;font-size:6.7pt;color:var(--neg)">
            └─ CUIT inválido · tiene 10 dígitos y el verificador no cierra
            &nbsp;&nbsp;<span class="btn" style="font-size:6.2pt;padding:.3mm 1.4mm">Corregir</span></div>
        </div>

        <div class="wf-r" style="padding:1.2mm 2.2mm"><span style="flex:0 0 4mm">☐</span>
          <span class="nm" style="flex:0 0 24mm">23-45678901-4</span>
          <span style="flex:1">Cuarto titular</span>
          <span class="nm" style="flex:0 0 22mm;text-align:right">$ 310.000,00</span>
          <span style="flex:0 0 18mm">BBVA</span>
          <span style="flex:0 0 18mm"><span class="dot" style="background:var(--brand)"></span> lista</span>
          <span style="flex:0 0 22mm;color:var(--ink-4)">—</span></div>

        <div class="wf-r" style="padding:1.2mm 2.2mm;color:var(--ink-4)">
          <span style="flex:0 0 4mm">☐</span><span style="flex:1">…</span></div>
      </div>

      <div class="wf-blk pl" style="display:flex;align-items:baseline;gap:3mm">
        <span class="nm" style="font-weight:640">418 filas</span>
        <span style="color:var(--neg)"><span class="dot" style="background:var(--neg)"></span> 26 con error</span>
        <span class="mini">Seleccionadas: 0</span>
        <span style="margin-left:auto" class="nm"><span class="rot">ARS</span> <b>$ 84.213.500,00</b></span>
      </div>
    </div>
  </div>
</div>

<div class="g4">
  <div class="card pl nada"><span class="rot">Paginación por servidor</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Desde el día uno. 600 filas
    por día son 15.000 por mes: una tabla sin paginar no sobrevive el segundo mes.</p></div>
  <div class="card pl nada"><span class="rot">El error se muestra en la fila</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Debajo, no en un ícono con
    tooltip. El operador tiene que barrer la lista y ver qué está mal sin hacer clic.</p></div>
  <div class="card pl nada"><span class="rot">Selección múltiple</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Porque las acciones son de
    lote: marcar como enviadas, exportar, descartar con motivo.</p></div>
  <div class="card br nada"><span class="rot" style="color:var(--brand)">Exportar normalizado</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Este botón, solo, elimina el
    paso más caro del flujo actual. Es el <b>primer valor entregable</b> del proyecto.</p></div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  16 · Importación · flujo
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("16", "Importación de archivos · flujo", "Ocho pasos que reemplazan la limpieza manual", """
<div class="g32">
  <div class="nada">
    <pre class="ascii"><b>1  ELEGIR ARCHIVO</b>
   .xlsx / .xls / .csv · arrastrar o buscar
        ↓
<b>2  IDENTIFICAR CLIENTE</b>
   sugerido por el nombre del archivo o el
   mapeo guardado · confirmable a mano
        ↓
<b>3  MAPEAR COLUMNAS</b>
   se aplica el mapeo guardado de ese cliente.
   Si es la primera vez, se mapea una vez y queda.
        ↓
<b>4  NORMALIZAR</b>
   CUIT sin guiones · importe en formato argentino
   fecha · banco · titular
        ↓
<b>5  VALIDAR</b>
   columnas faltantes · CUIT · importes
   duplicados dentro del archivo
   duplicados contra lo ya recibido (hash)
        ↓
<b>6  PREVIEW EDITABLE</b>
   grilla con el valor original y el normalizado,
   errores marcados por celda, contador por tipo
        ↓
<b>7  EL OPERADOR CORRIGE</b>
   en la misma grilla, con teclado
        ↓
<b>8  CONFIRMAR</b>
   entra a la bandeja.
   El archivo original se archiva.</pre>
  </div>

  <div class="nada">
    <h3>Las tres reglas de la ingesta</h3>
    <ol class="num" style="margin-bottom:3.4mm">
      <li><b>Se guarda el original y el normalizado.</b>
        <span class="mini" style="display:block">Siempre las dos columnas. Si más adelante
        hay una discusión sobre qué mandó el cliente, la respuesta está en la base y no en
        un mail.</span></li>
      <li><b>Ninguna fila se descarta en silencio.</b>
        <span class="mini" style="display:block">Es el mismo contrato de cinco estados que
        ya implementa <code>lib/migracion/importador.ts</code> para el histórico legacy, y
        es el activo que se reutiliza acá.</span></li>
      <li><b>El archivo original se archiva.</b>
        <span class="mini" style="display:block">En Storage, referenciado por el lote, con
        su hash para no procesar dos veces lo mismo.</span></li>
    </ol>

    <div class="card wa" style="margin-bottom:3.4mm">
      <span class="et et-val">TO VALIDATE · N11</span>
      <h4 style="margin-top:1.4mm">Mapeo de columnas por cliente</h4>
      <p class="mini" style="color:var(--ink-2);margin-bottom:1.2mm">Si cada cliente manda
      su propio formato de Excel, hace falta un mapeo por cliente. <b>El diseño lo asume</b>
      porque es robusto en los dos escenarios: si todos mandan el mismo formato, hay un
      solo mapeo por defecto y nadie lo nota.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0">El mapeo se aprende la
      primera vez y queda guardado en Configuración. Si un archivo llega con columnas que
      no coinciden, el paso 3 lo señala <b>en lugar de adivinar</b>.</p>
    </div>

    <h3>Ingesta futura desde email</h3>
    <p class="mini">No entra al MVP. Pero la arquitectura no la vuelve difícil: alcanza con
    que exista <code>contraparte_canales</code> desde el principio.</p>
    <pre class="ascii" style="margin-bottom:2.4mm">email recibido
   ↓ identificación del remitente
   ↓ cliente asociado  ← contraparte_canales
   ↓ archivo adjunto
   ↓ procesamiento automático
bandeja de acreditaciones · estado «recibida»</pre>
    <p class="mini" style="margin-bottom:0">El lote queda en <code>recibida</code> y el
    resto del flujo es idéntico al manual: <b>la automatización no salta ningún paso de
    validación</b>, sólo evita la subida del archivo.</p>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  17 · Importación · preview
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("17", "Importación · preview editable", "Donde se corrige antes de procesar · wireframe", """
<div class="wf" style="margin-bottom:3.4mm">
  <div class="wf-top">
    <span class="ti">Importar archivo</span>
    <span class="me">transferencias-septiembre.xlsx · Cliente A · 218 filas</span>
    <span style="margin-left:auto" class="me">Paso 3 de 3</span>
  </div>
  <div class="wf-body">
    <div class="wf-main" style="padding:2.4mm">
      <div class="wf-blk pl" style="display:flex;align-items:center;gap:4mm">
        <span><span class="dot" style="background:var(--pos)"></span> <b class="nm">192</b> listas</span>
        <span><span class="dot" style="background:var(--neg)"></span> <b class="nm">22</b> con error</span>
        <span><span class="dot" style="background:var(--ink-4)"></span> <b class="nm">4</b> duplicadas</span>
        <span style="margin-left:auto" class="wf-bar">
          <span class="pill on">Todas 218</span><span class="pill">Con error 22</span>
          <span class="pill">Duplicadas 4</span></span>
      </div>

      <div class="wf-blk" style="padding:0">
        <div class="wf-h" style="padding:1.4mm 2.2mm">
          <span style="flex:0 0 6mm">#</span>
          <span style="flex:0 0 26mm">CUIT (original)</span>
          <span style="flex:0 0 26mm">CUIT normalizado</span>
          <span style="flex:1">Titular</span>
          <span style="flex:0 0 24mm;text-align:right">Importe</span>
          <span style="flex:0 0 20mm">Estado</span></div>

        <div class="wf-r" style="padding:1.2mm 2.2mm"><span class="nm" style="flex:0 0 6mm;color:var(--ink-4)">1</span>
          <span class="nm" style="flex:0 0 26mm;color:var(--ink-3)">20-12345678-9</span>
          <span class="nm" style="flex:0 0 26mm">20123456789</span>
          <span style="flex:1">Titular A</span>
          <span class="nm" style="flex:0 0 24mm;text-align:right">$ 240.000,00</span>
          <span style="flex:0 0 20mm;color:var(--pos)"><span class="dot" style="background:var(--pos)"></span> lista</span></div>

        <div class="wf-r" style="padding:1.2mm 2.2mm"><span class="nm" style="flex:0 0 6mm;color:var(--ink-4)">2</span>
          <span class="nm" style="flex:0 0 26mm;color:var(--ink-3)">27.98765432.1</span>
          <span class="nm" style="flex:0 0 26mm">27987654321</span>
          <span style="flex:1">Titular B</span>
          <span class="nm" style="flex:0 0 24mm;text-align:right">$ 85.500,00</span>
          <span style="flex:0 0 20mm;color:var(--pos)"><span class="dot" style="background:var(--pos)"></span> lista</span></div>

        <div style="background:var(--neg-wash)">
          <div class="wf-r" style="padding:1.2mm 2.2mm;border-color:transparent">
            <span class="nm" style="flex:0 0 6mm;color:var(--ink-4)">3</span>
            <span class="nm" style="flex:0 0 26mm;color:var(--ink-3)">30-1234567-8</span>
            <span class="nm" style="flex:0 0 26mm;color:var(--neg);font-weight:640">⚠ 3012345678</span>
            <span style="flex:1">Titular C</span>
            <span class="nm" style="flex:0 0 24mm;text-align:right">$ 120.000,00</span>
            <span style="flex:0 0 20mm;color:var(--neg)"><span class="dot" style="background:var(--neg)"></span> error</span></div>
          <div style="padding:0 2.2mm 1.4mm 32mm;font-size:6.7pt;color:var(--neg)">
            └─ tiene 10 dígitos, falta 1 · el verificador no cierra</div>
        </div>

        <div style="background:var(--neg-wash)">
          <div class="wf-r" style="padding:1.2mm 2.2mm;border-color:transparent">
            <span class="nm" style="flex:0 0 6mm;color:var(--ink-4)">4</span>
            <span class="nm" style="flex:0 0 26mm;color:var(--ink-3)">20-11111111-2</span>
            <span class="nm" style="flex:0 0 26mm">20111111112</span>
            <span style="flex:1">Titular D</span>
            <span class="nm" style="flex:0 0 24mm;text-align:right;color:var(--neg);font-weight:640">⚠ "cien mil"</span>
            <span style="flex:0 0 20mm;color:var(--neg)"><span class="dot" style="background:var(--neg)"></span> error</span></div>
          <div style="padding:0 2.2mm 1.4mm 32mm;font-size:6.7pt;color:var(--neg)">
            └─ no se pudo leer como número</div>
        </div>

        <div style="background:var(--sunken)">
          <div class="wf-r" style="padding:1.2mm 2.2mm;border-color:transparent">
            <span class="nm" style="flex:0 0 6mm;color:var(--ink-4)">5</span>
            <span class="nm" style="flex:0 0 26mm;color:var(--ink-3)">23-45678901-4</span>
            <span class="nm" style="flex:0 0 26mm">23456789014</span>
            <span style="flex:1">Titular E</span>
            <span class="nm" style="flex:0 0 24mm;text-align:right">$ 310.000,00</span>
            <span style="flex:0 0 20mm;color:var(--ink-3)"><span class="dot" style="background:var(--ink-4)"></span> duplicada</span></div>
          <div style="padding:0 2.2mm 1.4mm 32mm;font-size:6.7pt;color:var(--ink-3)">
            └─ igual a la fila 89 de este archivo</div>
        </div>

        <div class="wf-r" style="padding:1.2mm 2.2mm;color:var(--ink-4)">
          <span class="nm" style="flex:0 0 6mm">…</span><span style="flex:1">213 filas más</span></div>
      </div>

      <div class="wf-blk br">
        <p style="font-size:7.4pt;margin:0 0 1.6mm">Se van a importar <b>192 de 218</b>.
        Las 22 con error y las 4 duplicadas quedan registradas y visibles:
        <b>ninguna fila se descarta en silencio</b>.</p>
        <div class="wf-bar">
          <span class="btn pri">Confirmar 192</span>
          <span class="btn">Importar todas y revisar después</span>
          <span class="btn">Cancelar</span>
          <span class="mini" style="margin-left:auto;font-size:6.6pt">Tab · Enter · ⌘Z para deshacer</span>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="g3">
  <div class="card br nada"><span class="rot" style="color:var(--brand)">Es la misma grilla que Carga</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Errores por celda, pegado
    desde el portapapeles, deshacer con <code>⌘Z</code>, navegación con teclado. Se extrae
    un <code>GrillaEditable</code> de <code>CargaGrid</code> y las dos pantallas lo usan.</p></div>
  <div class="card pl nada"><span class="rot">Original y normalizado, lado a lado</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">El operador ve qué mandó el
    cliente y qué entendió el sistema. Es lo que hace verificable la normalización en lugar
    de tener que confiar en ella.</p></div>
  <div class="card pl nada"><span class="rot">Dos formas de confirmar</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Confirmar sólo las buenas, o
    importar todo y revisar después. La segunda existe porque a veces el archivo hay que
    mandarlo ya y los errores se resuelven en paralelo.</p></div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  18 · Validación de CUIT
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("18", "Validación de CUIT", "Cinco resultados y una regla que no se cruza", """
<div class="g23">
  <div class="nada">
    <div class="card pl" style="margin-bottom:3.4mm">
      <p style="margin-bottom:0">El CUIT argentino tiene once dígitos y <b>el último es un
      verificador módulo 11</b>. Eso permite detectar la mayoría de los errores de tipeo
      de forma determinística, <b>sin consultar nada externo y sin inventar ninguna regla
      de negocio</b>.</p>
    </div>

    <div class="tbl">
    <table>
      <thead><tr><th style="width:16%">Resultado</th><th style="width:44%">Qué significa</th>
        <th style="width:40%">Qué hace el sistema</th></tr></thead>
      <tbody>
        <tr><td><span class="et et-keep">EXACTO</span></td>
            <td>Once dígitos, verificador correcto, y ya conocido para este cliente</td>
            <td>Sigue sin marca</td></tr>
        <tr><td><span class="et et-keep">NORMALIZADO</span></td>
            <td>Venía con guiones, puntos o espacios; limpio es válido</td>
            <td>Sigue, guardando el original</td></tr>
        <tr><td><span class="et et-del">INVÁLIDO</span></td>
            <td>No tiene once dígitos, o el verificador no cierra</td>
            <td><b>Bloquea</b>: no se envía así</td></tr>
        <tr><td><span class="et et-red">DESCONOCIDO</span></td>
            <td>Es válido, pero no lo vimos antes para este cliente</td>
            <td>Advierte, no bloquea</td></tr>
        <tr><td><span class="et et-new">SIMILAR</span></td>
            <td>Inválido, y a uno o dos dígitos de un CUIT conocido de ese cliente</td>
            <td><b>Sugiere</b> una corrección. Nunca la aplica sola</td></tr>
      </tbody>
    </table>
    </div>

    <div class="aviso no" style="margin-top:3.4mm">
      <span class="rot" style="color:var(--neg)">La regla que no se cruza</span>
      <p style="font-family:var(--mono);font-size:8.4pt;font-weight:700;color:var(--neg);margin:1.4mm 0 1.6mm">
      Un CUIT sospechoso genera «posible coincidencia».<br>Nunca un match confirmado.</p>
      <p style="margin-bottom:0">Corregir un CUIT solo, aunque el sistema esté casi seguro,
      significa <b>mandar plata a otra persona</b>. La sugerencia se muestra con las dos
      versiones al lado y la corrección la aplica una persona.</p>
    </div>
  </div>

  <div class="nada">
    <h3>Cómo se ve una sugerencia</h3>
    <div class="wf" style="margin-bottom:3.4mm">
      <div class="wf-main" style="padding:2.6mm">
        <div class="wf-blk wa" style="background:var(--warn-wash);border-color:var(--warn-line)">
          <span class="rot" style="color:var(--warn)">Posible coincidencia</span>
          <div style="display:grid;grid-template-columns:1fr 5mm 1fr;gap:2mm;align-items:center;margin-top:1.8mm">
            <div style="background:var(--surface);border:.6pt solid var(--line);border-radius:1.6mm;padding:1.8mm">
              <div class="rot">Vino en el archivo</div>
              <div class="nm" style="font-size:9pt;color:var(--neg);font-weight:640;margin-top:.8mm">30-1234567-8</div>
              <div class="mini" style="font-size:6.6pt">10 dígitos · verificador no cierra</div>
            </div>
            <div style="text-align:center;color:var(--ink-4)">→</div>
            <div style="background:var(--surface);border:.6pt solid var(--pos-line);border-radius:1.6mm;padding:1.8mm">
              <div class="rot" style="color:var(--pos)">CUIT conocido de este cliente</div>
              <div class="nm" style="font-size:9pt;color:var(--pos);font-weight:640;margin-top:.8mm">30-12345678-1</div>
              <div class="mini" style="font-size:6.6pt">usado 14 veces · último el 03/09</div>
            </div>
          </div>
          <div class="wf-bar" style="margin-top:2mm">
            <span class="btn pri">Aplicar la corrección</span>
            <span class="btn">Dejar como está</span>
            <span class="btn">Descartar la fila</span>
          </div>
        </div>
      </div>
    </div>

    <h3>Lo que la validación detecta sin preguntarle a nadie</h3>
    <ul class="pl">
      <li><b>Formato</b>: guiones, puntos, espacios, comillas de Excel.</li>
      <li><b>Longitud</b>: once dígitos exactos.</li>
      <li><b>Prefijo</b>: los dos primeros dígitos tienen un conjunto válido conocido.</li>
      <li><b>Verificador</b>: módulo 11 sobre los diez primeros dígitos.</li>
      <li><b>Distancia</b>: uno o dos dígitos de diferencia contra el histórico del cliente.</li>
    </ul>

    <div class="aviso wa nada" style="margin-top:1mm">
      <span class="et et-val">TO VALIDATE · N7</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 0">Cuando el CUIT está mal,
      ¿lo corrige Nordelta o hay que pedirle el archivo de nuevo al cliente? Cambia si la
      corrección en el preview es suficiente, o si hace falta un estado
      <code>devuelto al cliente</code>.</p>
    </div>
  </div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  19 · Conciliación · pantalla
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("19", "Conciliación · pantalla", "Enviado contra acreditado · wireframe", """
<div class="g23">
  <div class="wf">
    <div class="wf-top">
      <span class="ti">Conciliación</span>
      <span class="me">341 enviadas · 259 acreditadas</span>
      <span style="margin-left:auto"><span class="btn pri">Importar créditos</span></span>
    </div>
    <div class="wf-body">
      <div class="wf-main" style="padding:2.4mm">
        <div class="wf-blk pl">
          <div class="wf-bar">
            <span class="pill on">A decidir 12</span><span class="pill">Sin match 82</span>
            <span class="pill">Confirmadas 247</span><span class="pill">Con error 7</span>
            <span style="margin-left:auto" class="mini" style="font-size:6.6pt">Cliente ▾ Fecha ▾ Banco ▾</span>
          </div>
        </div>

        <div class="wf-blk">
          <div style="display:flex;align-items:baseline;margin-bottom:1.8mm">
            <span class="rot">Caso 1 de 12</span>
            <span class="mini" style="margin-left:auto;font-size:6.6pt">← → para navegar · Enter confirma</span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2.4mm">
            <div style="border:.7pt solid var(--line);border-radius:1.8mm;overflow:hidden">
              <div style="background:var(--raised);padding:1.4mm 2mm;border-bottom:.6pt solid var(--line)">
                <span class="rot">Enviada</span></div>
              <div style="padding:1.8mm 2mm">
                <div class="wf-r"><span class="mini" style="flex:0 0 16mm">Cliente</span><span style="flex:1;font-weight:620">Cliente A</span></div>
                <div class="wf-r"><span class="mini" style="flex:0 0 16mm">CUIT</span><span class="nm" style="flex:1">20-12345678-9</span></div>
                <div class="wf-r"><span class="mini" style="flex:0 0 16mm">Monto</span><span class="nm" style="flex:1;font-weight:620">$ 240.000,00</span><span style="color:var(--pos)">✓</span></div>
                <div class="wf-r"><span class="mini" style="flex:0 0 16mm">Fecha</span><span class="nm" style="flex:1">05/09/2026</span><span style="color:var(--pos)">✓</span></div>
                <div class="wf-r"><span class="mini" style="flex:0 0 16mm">Banco</span><span style="flex:1">Galicia</span><span style="color:var(--pos)">✓</span></div>
                <div class="wf-r"><span class="mini" style="flex:0 0 16mm">Titular</span><span style="flex:1">Titular A</span><span style="color:var(--pos)">✓</span></div>
                <div class="wf-r"><span class="mini" style="flex:0 0 16mm">Referencia</span><span style="flex:1;color:var(--ink-4)">—</span></div>
              </div>
            </div>

            <div style="border:.7pt solid var(--line);border-radius:1.8mm;overflow:hidden">
              <div style="background:var(--raised);padding:1.4mm 2mm;border-bottom:.6pt solid var(--line)">
                <span class="rot">Acreditación</span></div>
              <div style="padding:1.8mm 2mm">
                <div class="wf-r"><span class="mini" style="flex:0 0 16mm">Cliente</span><span style="flex:1;color:var(--ink-4)">— sin asignar</span></div>
                <div class="wf-r" style="background:var(--neg-wash)"><span class="mini" style="flex:0 0 16mm">CUIT</span><span class="nm" style="flex:1;color:var(--neg);font-weight:640">20-12345678-0</span><span style="color:var(--neg)">⚠</span></div>
                <div class="wf-r"><span class="mini" style="flex:0 0 16mm">Monto</span><span class="nm" style="flex:1;font-weight:620">$ 240.000,00</span><span style="color:var(--pos)">✓</span></div>
                <div class="wf-r"><span class="mini" style="flex:0 0 16mm">Fecha</span><span class="nm" style="flex:1">05/09/2026</span><span style="color:var(--pos)">✓</span></div>
                <div class="wf-r"><span class="mini" style="flex:0 0 16mm">Banco</span><span style="flex:1">Galicia</span><span style="color:var(--pos)">✓</span></div>
                <div class="wf-r"><span class="mini" style="flex:0 0 16mm">Titular</span><span style="flex:1">TITULAR A</span><span style="color:var(--pos)">✓</span></div>
                <div class="wf-r"><span class="mini" style="flex:0 0 16mm">Referencia</span><span style="flex:1;color:var(--ink-4)">—</span></div>
              </div>
            </div>
          </div>

          <div class="wf-blk wa" style="margin-top:2mm;background:var(--warn-wash);border-color:var(--warn-line);text-align:center">
            <div style="font-family:var(--mono);font-size:8.4pt;font-weight:700;color:var(--warn)">
              POSIBLE MATCH · 5 de 6 señales</div>
            <div class="mini" style="color:var(--ink-2);margin-top:.8mm">difiere 1 dígito de CUIT · sin referencia externa</div>
            <div style="margin-top:1.4mm;padding-top:1.4mm;border-top:.6pt solid var(--warn-line);color:var(--neg);font-size:7.2pt">
              ⚠ hay <b>otra transferencia</b> abierta con el mismo monto y la misma fecha</div>
          </div>

          <div class="wf-bar" style="margin-top:2mm">
            <span class="btn pri">Confirmar</span><span class="btn">Rechazar</span>
            <span class="btn">Buscar otra coincidencia</span><span class="btn">Dejar pendiente</span>
          </div>
          <p class="mini" style="margin:1.6mm 0 0;font-size:6.7pt">Al confirmar se registra
          quién, cuándo, y <b>qué señales había en ese momento</b>.</p>
        </div>
      </div>
    </div>
  </div>

  <div class="nada">
    <h3>Los cuatro resultados</h3>
    <div class="tbl" style="margin-bottom:3.4mm">
    <table>
      <thead><tr><th style="width:34%">Resultado</th><th style="width:44%">Criterio</th>
        <th style="width:22%">Decide</th></tr></thead>
      <tbody>
        <tr><td><span class="et et-keep">MATCH EXACTO</span></td>
            <td>La tupla identifica <b>una sola</b> transferencia, sin ambigüedad</td>
            <td>El sistema, y queda auditado</td></tr>
        <tr><td><span class="et et-red">POSIBLE MATCH</span></td>
            <td>Coincide en parte, o coincide con más de una</td>
            <td><b>La persona</b></td></tr>
        <tr><td><span class="et et-fus">SIN MATCH</span></td>
            <td>No hay candidato</td><td>Queda pendiente y visible</td></tr>
        <tr><td><span class="et et-del">ERROR</span></td>
            <td>La acreditación no se puede interpretar</td><td>Va a revisión</td></tr>
      </tbody>
    </table>
    </div>

    <h3>Las cinco decisiones de diseño</h3>
    <ul class="pl">
      <li><b>Se muestran las señales, no un porcentaje solo.</b> Un «96 %» no le dice al
      operador qué mirar. Seis señales con su tilde o su alerta, sí.</li>
      <li><b>Se avisa cuando hay ambigüedad.</b> Si otra transferencia también encaja, el
      operador tiene que saberlo antes de confirmar. Es el pain point C.</li>
      <li><b>Un caso a la vez, con teclado.</b> Doce casos se resuelven más rápido de uno
      en uno con <code>Enter</code> que en una tabla con checkboxes.</li>
      <li><b>Buscar otra coincidencia</b> abre la búsqueda contra todas las transferencias
      abiertas del cliente, no sólo las candidatas.</li>
      <li><b>Toda confirmación queda auditada con su evidencia.</b> No sólo «confirmado por
      X»: también qué señales había. Sin eso, dentro de tres meses no se puede reconstruir
      por qué se confirmó.</li>
    </ul>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  20 · Matching
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("20", "Matching", "Señales, unicidad, y lo que no vamos a hacer", """
<div class="g2">
  <div class="nada">
    <h3>Las señales, y cuánto pesa cada una</h3>
    <div class="tbl" style="margin-bottom:3.4mm">
    <table>
      <thead><tr><th style="width:34%">Señal</th><th style="width:22%">Fuerza</th>
        <th style="width:44%">Nota</th></tr></thead>
      <tbody>
        <tr><td><b>Referencia externa</b></td><td><span class="et et-keep">DECISIVA</span></td>
            <td>Si el sistema externo la da. <span class="blk">N2</span></td></tr>
        <tr><td><b>CUIT</b> exacto</td><td><span class="et et-keep">FUERTE</span></td>
            <td>Con verificador válido</td></tr>
        <tr><td><b>Importe</b> exacto</td><td><span class="et et-red">MEDIA</span></td>
            <td><b>Nunca alcanza solo</b>: los importes se repiten</td></tr>
        <tr><td><b>Fecha</b> en ventana</td><td><span class="et et-red">MEDIA</span></td>
            <td>La ventana es configurable</td></tr>
        <tr><td><b>Banco</b></td><td><span class="et et-fus">DÉBIL</span></td>
            <td>Confirma, no identifica</td></tr>
        <tr><td><b>Titular</b> normalizado</td><td><span class="et et-fus">DÉBIL</span></td>
            <td>Sirve de contraste, no de clave</td></tr>
        <tr><td><b>CUIT</b> a 1–2 dígitos</td><td><span class="et et-del">SOSPECHA</span></td>
            <td>Genera sugerencia, jamás confirmación</td></tr>
      </tbody>
    </table>
    </div>

    <div class="aviso">
      <span class="rot" style="color:var(--brand)">La condición que importa</span>
      <p style="margin:1.2mm 0 0"><b>La unicidad.</b> Si dos transferencias abiertas
      comparten CUIT, importe y fecha, <b>no hay auto-match</b>: hay dos sugerencias. Sin
      esa condición, el sistema reproduciría el pain point C con más velocidad.</p>
    </div>
  </div>

  <div class="nada">
    <h3>La regla de auto-match</h3>
    <pre class="ascii" style="margin-bottom:3.4mm"><b>AUTO-MATCH SEGURO</b>
  hay referencia externa coincidente
      — o —
  CUIT exacto + importe exacto + fecha en ventana
      <i>Y la tupla identifica UNA SOLA transferencia abierta</i>

<b>SUGERENCIA</b>   (todo lo demás con al menos dos señales)
  el operador decide

<b>SIN MATCH</b>
  ninguna señal fuerte</pre>

    <div class="card no" style="margin-bottom:3.4mm">
      <span class="rot" style="color:var(--neg)">Lo que no vamos a hacer</span>
      <ul class="pl" style="margin:1.4mm 0 0;color:var(--ink-2)">
        <li>Confirmar automáticamente por importe y fecha.</li>
        <li>Corregir un CUIT solos.</li>
        <li><b>Prometer un porcentaje de automatización antes de medirlo contra archivos
        reales.</b></li>
      </ul>
    </div>

    <div class="card wa">
      <span class="rot" style="color:var(--warn)">Por qué no se puede prometer un número todavía</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1mm">La tasa de auto-match
      depende enteramente de si existe la referencia externa (<b>N2</b>), y eso no lo
      sabemos.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0"><b>Con</b> referencia: el
      matching es casi determinístico y la conciliación pasa a ser revisión por excepción.
      <b>Sin</b> referencia: depende de heurísticas y el volumen de sugerencias puede ser
      alto. Es el riesgo número 1 del proyecto.</p>
    </div>

    <p class="mini" style="margin-top:3mm;margin-bottom:0">Un auto-match es
    <b>reversible y queda auditado igual que uno manual</b>. No hay decisión del sistema
    que no se pueda deshacer y explicar.</p>
  </div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  21 · Clientes
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("21", "Clientes", "Una pantalla con pestañas, y por qué · wireframe", """
<div class="g23">
  <div class="wf">
    <div class="wf-top">
      <span class="me">← Cuentas</span>
      <span class="ti" style="margin-left:2mm">Cliente A</span>
      <span class="me">Cliente · 118 movimientos · <span class="dot" style="background:var(--pos)"></span> con cierre registrado</span>
      <span style="margin-left:auto"><span class="btn">Ajustar a cero</span></span>
    </div>
    <div class="wf-body">
      <div class="wf-main" style="padding:2.4mm">
        <div class="wf-blk" style="padding:0">
          <div class="pipe" style="border:0">
            <div><div class="k">Enviado</div><div class="v">$ 24.010.500</div><div class="s">186 transferencias</div></div>
            <div><div class="k">Acreditado</div><div class="v" style="color:var(--pos)">$ 12.400.000</div><div class="s">142 transferencias</div></div>
            <div><div class="k">Pendiente</div><div class="v" style="color:var(--warn)">$ 11.610.500</div><div class="s">41 transferencias</div></div>
            <div class="alerta"><div class="k">Errores</div><div class="v">3</div><div class="s">CUIT</div></div>
          </div>
        </div>

        <div class="wf-bar">
          <span class="pill on">Resumen</span><span class="pill">Cuenta corriente</span>
          <span class="pill">Transferencias</span><span class="pill">Errores</span>
        </div>

        <div class="wf-blk">
          <span class="rot">Saldo de cuenta corriente</span>
          <div class="pipe" style="margin-top:1.4mm">
            <div><div class="k">ARS</div><div class="v" style="font-size:9.4pt;color:var(--pos)">$ 4.182.500</div></div>
            <div><div class="k">USD</div><div class="v" style="font-size:9.4pt;color:var(--neg)">−US$ 2.400</div></div>
            <div><div class="k">EUR</div><div class="v" style="font-size:9.4pt;color:var(--ink-4)">—</div></div>
            <div><div class="k">BRL</div><div class="v" style="font-size:9.4pt;color:var(--ink-4)">—</div></div>
          </div>
        </div>

        <div class="wf-blk">
          <div style="display:flex;align-items:baseline"><span class="rot">Últimos movimientos</span>
            <span class="mini" style="margin-left:auto;font-size:6.6pt;color:var(--brand)">ver la cuenta completa →</span></div>
          <div class="wf-r" style="margin-top:1mm"><span class="nm" style="flex:0 0 16mm;color:var(--ink-3)">02/09/2026</span>
            <span style="flex:1">Comisión de transferencia</span>
            <span class="nm" style="flex:0 0 22mm;text-align:right;color:var(--neg)">−$ 177.500,00</span></div>
          <div class="wf-r"><span class="nm" style="flex:0 0 16mm;color:var(--ink-3)">01/09/2026</span>
            <span style="flex:1">Cobro USD al cambio del día</span>
            <span class="nm" style="flex:0 0 22mm;text-align:right;color:var(--pos)">+$ 2.610.000,00</span></div>
          <div class="wf-r"><span class="nm" style="flex:0 0 16mm;color:var(--ink-3)">29/08/2026</span>
            <span style="flex:1">Pago proveedor · transferencia</span>
            <span class="nm" style="flex:0 0 22mm;text-align:right;color:var(--neg)">−$ 1.450.000,00</span></div>
        </div>

        <div class="wf-blk pl">
          <div style="display:flex;align-items:baseline"><span class="rot">Acreditaciones abiertas</span>
            <span class="mini" style="margin-left:auto;font-size:6.6pt;color:var(--brand)">ver todas →</span></div>
          <p style="margin:1.2mm 0 0;font-size:7.4pt">41 transferencias pendientes por
          <b class="nm">$ 11.610.500,00</b> · la más antigua del 28/08</p>
        </div>
      </div>
    </div>
  </div>

  <div class="nada">
    <h3>La decisión: una pantalla</h3>
    <p class="mini">La operación y el libro contable son información <b>del mismo
    cliente</b>, y las preguntas se cruzan todo el tiempo: «¿le debemos, o es que le falta
    acreditar?». Separarlas en dos pantallas obliga a buscar dos veces y duplica la
    cabecera.</p>

    <div class="aviso no" style="margin:3mm 0">
      <span class="rot" style="color:var(--neg)">Cuidado con la confusión</span>
      <p style="margin:1.2mm 0 1.2mm"><b>«Pendiente de acreditar» no es lo mismo que
      «saldo de cuenta corriente».</b></p>
      <p style="margin-bottom:0">Uno es plata en tránsito en el sistema externo; el otro es
      lo que las dos partes se deben. Por eso los cuatro números operativos van en la
      cabecera y el saldo va adentro de su pestaña: <b>nunca en la misma tira</b>.</p>
    </div>

    <h3>Las cuatro pestañas</h3>
    <div class="tbl" style="margin-bottom:3mm">
    <table>
      <tbody>
        <tr><td style="width:32%"><b>Resumen</b></td><td>Saldo, últimos movimientos y acreditaciones abiertas</td></tr>
        <tr><td><b>Cuenta corriente</b></td><td>El libro completo con saldo corrido y cierres · <span class="et et-keep">EXISTE</span></td></tr>
        <tr><td><b>Transferencias</b></td><td>Historial operativo con los dos ejes de estado</td></tr>
        <tr><td><b>Errores</b></td><td>CUIT y validaciones pendientes de resolver</td></tr>
      </tbody>
    </table>
    </div>

    <div class="card wa nada">
      <span class="et et-val">TO VALIDATE · N8</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 0">¿Los clientes que mandan
      archivos de transferencias son las mismas contrapartes que tienen cuenta corriente?
      <b>Si son universos distintos, la pantalla se parte en dos y esta decisión se
      revierte.</b> Es la única decisión de estructura de este informe que depende de una
      respuesta que no tenemos.</p>
    </div>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  22 · Cuenta corriente
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("22", "Cuenta corriente", "La cadena completa del dato", f"""
<div class="g32">
  <div class="nada">
    <pre class="ascii"><b>ARCHIVO DEL CLIENTE</b>
      ↓  ingesta · normaliza · valida
<i>TRANSFERENCIA</i>            ← estado de proceso
      ↓  envío al sistema externo
<i>ACREDITACIÓN</i>             ← lo que el banco devolvió
      ↓  conciliación · decisión humana
         con evidencia
════════════ <i>LA COSTURA</i> ════════════
      ↓
<b>MOVIMIENTO</b>               ← granularidad: N1
      ↓  una partida por pata monetaria
<b>PARTIDA</b>                  ← moneda y monto de impacto
      ↓  saldo corrido en orden canónico
<b>CUENTA CORRIENTE</b>
      ↓  suma por moneda, sin mezclar
<b>BALANCE</b>

  <b>AUDITORÍA</b> registra cada paso donde
  decidió una persona</pre>

    <div class="aviso ok" style="margin-top:3mm">
      <p style="margin-bottom:0"><b>Todo lo que está debajo de MOVIMIENTO ya existe, está
      probado y no se toca.</b> El proyecto de esta etapa es construir lo de arriba y
      conectar la flecha.</p>
    </div>
  </div>

  <div class="nada">
    {captura("cuenta", "La pantalla existente", "· se conserva y pasa a ser una pestaña del cliente")}

    <h3 style="margin-top:3mm">Por qué se conserva</h3>
    <p class="mini">Responde lo que tiene que responder: fecha, concepto, impacto, moneda,
    saldo corrido y cierres, con el detalle de partidas en un panel. El corte de cierre
    aparece como una banda en el hilo del libro, después de la operación que dejó las
    cuatro monedas en cero.</p>

    <h3 style="margin-top:3mm">Trazabilidad hacia atrás</h3>
    <p class="mini">Un movimiento generado por una conciliación tiene que poder abrirse
    <b>hasta el archivo original del cliente</b>. El esquema ya tiene
    <code>movimientos.origen jsonb</code>, que hoy usa el importador legacy y sirve para
    esto sin cambiar la tabla.</p>
    <p class="mini" style="margin-bottom:0">Se propone además un <code>lote_id</code>
    nullable para poder hacer el join sin leer JSON. Es una columna nullable: no rompe nada
    ni exige migrar datos.</p>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  23 · Carga manual y Balance
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("23", "Carga manual y Balance", "Lo que no se toca", f"""
<div class="g2">
  <div class="nada">
    <h3>Carga manual · <span class="et et-keep">SIN CAMBIOS</span></h3>
    {captura("carga", "", "", 176)}
    <p class="mini" style="margin-top:2mm">Es el activo de velocidad del producto y se
    acaba de pulir: la grilla entra completa a 1280 px, el impacto queda fijado a la
    derecha, el pegado desde Excel interpreta categorías, medios y montos en formato
    argentino, y hay deshacer con <code>⌘Z</code>.</p>

    <h4 style="margin-top:2.4mm">Cómo convive con la ingesta de archivos</h4>
    <div class="tbl">
    <table>
      <thead><tr><th style="width:22%"></th><th style="width:39%">Importar archivo</th>
        <th style="width:39%">Carga manual</th></tr></thead>
      <tbody>
        <tr><td><b>Origen</b></td><td>Un cliente mandó un Excel</td><td>Alguien registra algo que pasó</td></tr>
        <tr><td><b>Volumen</b></td><td>Cientos de filas</td><td>Unidades</td></tr>
        <tr><td><b>Produce</b></td><td>Transferencias a enviar</td><td>Movimientos contables</td></tr>
        <tr><td><b>Cuándo</b></td><td>A la mañana, por lote</td><td>Durante el día</td></tr>
      </tbody>
    </table>
    </div>
    <p class="mini" style="margin-top:2mm;margin-bottom:0">No compiten: <b>producen cosas
    distintas</b>. Una transferencia no es un movimiento hasta que se concilia. Las dos
    viven bajo el grupo <b>Operación</b>.</p>
  </div>

  <div class="nada">
    <h3>Balance · <span class="et et-keep">SIN CAMBIOS</span></h3>
    {captura("balance", "", "", 176)}

    <div class="tbl" style="margin-top:2.4mm">
    <table>
      <tbody>
        <tr><td style="width:30%"><b>Quién lo usa</b></td><td>Supervisor y administración. No el operador en su día</td></tr>
        <tr><td><b>Cuándo</b></td><td>Al cierre del día, y cuando alguien pregunta un total</td></tr>
        <tr><td><b>Desde dónde</b></td><td>Riel, grupo Cuentas. Y desde Inicio</td></tr>
        <tr><td><b>Qué necesita</b></td><td>Ver los totales por moneda, filtrar, buscar, exportar</td></tr>
      </tbody>
    </table>
    </div>

    <div class="aviso no" style="margin-top:3mm">
      <p style="margin-bottom:1.2mm"><b>La regla que no se negocia.</b> Las cuatro monedas
      nunca se suman entre sí. No hay «total general» porque no significa nada.</p>
      <p style="margin-bottom:0">Si el negocio pide un total consolidado, hace falta una
      cotización de referencia con fecha, y eso es la decisión <b>D5</b>. No se inventa.</p>
    </div>

    <h4 style="margin-top:3mm">La palanca de reutilización</h4>
    <p class="mini" style="margin-bottom:0">El preview de la importación <b>es</b> la misma
    grilla que Carga: errores por celda, pegado, deshacer. Se extrae un
    <code>GrillaEditable</code> genérico y las dos pantallas lo usan. El comportamiento ya
    está escrito y probado.</p>
  </div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  24 · Ajustes y Auditoría
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("24", "Ajustes y Auditoría", "Lo que se muda y lo que se extiende", f"""
<div class="g2">
  <div class="nada">
    <h3>Ajustes · <span class="et et-fus">SE MUDA</span></h3>
    {captura("ajustes", "", "", 168)}
    <p class="mini" style="margin-top:2mm"><b>La funcionalidad se conserva completa</b>: la
    lectura vertical <code>SALDO ACTUAL → + AJUSTE → = SALDO RESULTANTE</code>, la
    propuesta automática del negativo de cada saldo, y el aviso de que la cuenta queda
    cerrada cuando las cuatro monedas dan cero.</p>

    <div class="aviso" style="margin:2.6mm 0">
      <p style="margin-bottom:1.2mm"><b>Lo que cambia es dónde vive.</b> Sale del riel y
      pasa a ser una acción del cliente, en su pantalla.</p>
      <p style="margin-bottom:0">Razón: un ajuste es siempre sobre <b>una</b> cuenta, y
      tenerlo como ítem de menú obliga a elegir la contraparte otra vez cuando ya estabas
      mirándola. El enlace profundo <code>?cuenta=&lt;id&gt;</code> ya existe.</p>
    </div>

    <p class="mini" style="margin-bottom:0">Un ajuste <b>no toca ningún saldo</b>: genera
    un movimiento contable explícito con categoría de ajuste y una partida por moneda con
    saldo. Esa propiedad es la que lo hace auditable, y no se cambia.</p>
  </div>

  <div class="nada">
    <h3>Auditoría · <span class="et et-red">SE EXTIENDE</span></h3>
    {captura("auditoria", "", "", 168)}
    <p class="mini" style="margin-top:2mm">Ya responde quién, qué, cuándo, valor anterior y
    valor nuevo, y el panel muestra <b>sólo los campos que cambiaron</b> — con nueve tests
    que lo cubren. No muestra JSON crudo al usuario.</p>

    <h4 style="margin-top:2.6mm">Lo que hay que agregar</h4>
    <div class="tbl">
    <table>
      <thead><tr><th style="width:26%">Entidad nueva</th><th style="width:74%">Qué registrar</th></tr></thead>
      <tbody>
        <tr><td><b>Lote</b></td><td>Quién lo importó, de qué archivo, cuántas filas entraron y cuántas quedaron con error</td></tr>
        <tr><td><b>Transferencia</b></td><td>Cada corrección de CUIT o importe, con el valor original</td></tr>
        <tr><td><b>Envío</b></td><td>Quién marcó un lote como enviado, y cuándo</td></tr>
        <tr style="background:var(--brand-wash)"><td><b>Conciliación</b></td>
            <td>Quién confirmó o rechazó, <b>y qué señales había</b> en ese momento</td></tr>
        <tr><td><b>Descarte</b></td><td>Quién descartó una fila y con qué motivo</td></tr>
      </tbody>
    </table>
    </div>

    <div class="aviso" style="margin-top:2.6mm">
      <p style="margin-bottom:0"><b>La conciliación es la más importante.</b> Es la única
      decisión humana del sistema que mueve un saldo sin que nadie escriba un importe. Sin
      la evidencia guardada, dentro de tres meses no se puede reconstruir por qué se
      confirmó.</p>
    </div>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  25 · User flows 1 y 2
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("25", "User flows · 1 y 2", "Recepción y conciliación", """
<div class="g2">
  <div class="nada">
    <h3>Flow 1 · Recepción</h3>
    <pre class="ascii">Cliente manda archivo
  (Gmail / WhatsApp / entrega directa)
      ↓
Operador abre <b>Acreditaciones → Importar</b>
      ↓
Elegir archivo → identificar cliente
      → aplicar mapeo de columnas
      ↓
Normalizar: CUIT, importes, fechas, banco
      ↓
   <b>VALIDAR</b> ─────────────┐
      ↓                     ↓
    <i>OK</i>                  <i>ERROR</i>
      ↓                     ↓
      │           preview con la fila marcada
      │                     ↓
      │           corregir en la grilla
      │                     ↓
      │              ┌──────┴──────┐
      │              ↓             ↓
      │          revalidar     descartar
      │              │        con motivo
      │              │             │
      └──────────────┴─────────────┘
      ↓
<b>CONFIRMAR</b>
  las filas OK entran
  las de error quedan visibles
      ↓
Bandeja de acreditaciones · estado <b>lista</b>
      ↓
<b>Exportar normalizado</b> → sistema externo
      ↓
Marcar lote como <b>enviado</b>
      <i>¿requiere aprobación? · N6</i></pre>
  </div>

  <div class="nada">
    <h3>Flow 2 · Conciliación</h3>
    <pre class="ascii">Descargar «Ingresos y créditos»
  del sistema externo
      ↓
<b>Conciliación → Importar créditos</b>
      ↓
Normalizar y validar
      ↓
   <b>MATCHING ASISTIDO</b>
      ↓
 ┌──────────┬───────────┬─────────┬───────┐
 ↓          ↓           ↓         ↓       ↓
<b>MATCH</b>    <b>POSIBLE</b>     <b>SIN MATCH</b>  <b>ERROR</b>
<b>EXACTO</b>   <b>MATCH</b>          ↓         ↓
 ↓          ↓        queda      revisión
auto-    el operador pendiente
confirm.   decide    y visible
auditado    ↓
 │    ┌─────┴─────┬──────────┐
 │    ↓           ↓          ↓
 │ Confirmar  Rechazar  Buscar otra
 │    │           │          │
 └────┴───────────┘     vuelve al caso
      ↓
transferencia <b>ACREDITADA</b>
      ↓
genera <b>MOVIMIENTO</b> contable
  <i>granularidad: N1</i>
      ↓
<b>CUENTA CORRIENTE</b> → <b>BALANCE</b>
      ↓
<b>AUDITORÍA</b> con las señales del momento</pre>
  </div>
</div>

<div class="g2" style="margin-top:3.4mm">
  <div class="card pl nada">
    <span class="rot">Lo que este flujo elimina</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Siete de los once pasos
    manuales del proceso actual: copiar, normalizar, corregir formatos, limpiar CUIT,
    corregir errores, preparar el archivo y separar por cliente.</p>
  </div>
  <div class="card pl nada">
    <span class="rot">Lo que sigue siendo humano, a propósito</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Decidir un posible match,
    corregir un CUIT sospechoso, y autorizar el envío de un lote. Las tres mueven plata:
    no se automatizan.</p>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  26 · User flows 3, 4 y 5
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("26", "User flows · 3, 4 y 5", "Cliente, carga manual y ajuste", """
<div class="g3">
  <div class="nada">
    <h3>Flow 3 · Cliente</h3>
    <pre class="ascii">Buscar cliente
 (Cuentas, o el
  buscador global)
      ↓
<b>Pantalla del cliente</b>
 cabecera con los
 cuatro números
      ↓
<b>ENVIADO</b>
   ──
<b>ACREDITADO</b>
   ──
<b>PENDIENTE</b>
   ──
<b>ERRORES</b>
      ↓
 ┌────┴────┐
 ↓         ↓
<b>Resumen</b>  <b>Cuenta</b>
        <b>corriente</b>
 ↓         ↓
<b>Transf.</b>  <b>Errores</b>
 ↓
<b>Ajustar a cero</b></pre>
  </div>

  <div class="nada">
    <h3>Flow 4 · Carga manual</h3>
    <pre class="ascii"><b>Operación → Carga</b>
 elegir fecha y oficina
      ↓
Escribir con teclado
  — o —
pegar un bloque
desde Excel
      ↓
<b>Validación en vivo</b>
 por celda: monto,
 tipo de cambio,
 comisión, contraparte
      ↓
<b>Impacto calculado</b>
 a la derecha, en vivo
 «no impacta» cuando
 corresponde
      ↓
<b>GUARDAR</b>
 atómico: cabecera +
 partidas, o nada
      ↓
<b>MOVIMIENTO</b> + <b>PARTIDAS</b>
      ↓
<b>CUENTA CORRIENTE</b>
 saldo recalculado
      ↓
<b>BALANCE</b>
      ↓
<b>AUDITORÍA</b></pre>
  </div>

  <div class="nada">
    <h3>Flow 5 · Ajuste y cierre</h3>
    <pre class="ascii"><b>Cliente</b>
      ↓
<b>Cuenta corriente</b>
      ↓
<b>Ajustar a cero</b>
      ↓
El sistema propone el
negativo de cada saldo
con su moneda
      ↓
<b>Previsualizar</b>
 SALDO ACTUAL
      +
   AJUSTE
      =
 SALDO RESULTANTE
      ↓
¿las cuatro monedas
   dan cero?
   ↓        ↓
  <i>sí</i>       <i>no</i>
   ↓        ↓
Registrar el ajuste
   ↓        ↓
<b>MOVIMIENTO</b> con
categoría de ajuste
   ↓        ↓
<b>CUENTA</b>   queda
<b>CERRADA</b>  saldo
   ↓
corte visible
en el libro
   ↓
<b>AUDITORÍA</b>
con el motivo</pre>
  </div>
</div>

<div class="g2" style="margin-top:3.4mm">
  <div class="aviso ok nada">
    <p style="margin-bottom:0"><b>Los flows 3, 4 y 5 ya funcionan hoy</b> —salvo la
    cabecera operativa del flow 3 y la mudanza del ajuste. Están en este informe porque
    son la mitad del producto y quien lo revise tiene que poder verlos completos.</p>
  </div>
  <div class="card pl nada">
    <span class="rot">Lo único que se agrega al flow 4</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Nada. La carga manual queda
    exactamente como está. Aparece acá para mostrar que <b>los movimientos pueden nacer de
    dos lugares</b> —de una conciliación o de una carga— y que aguas abajo el camino es el
    mismo.</p>
  </div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  27 · Arquitectura técnica
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("27", "Arquitectura técnica", "Conservar el stack, y qué se agrega", """
<div class="g23">
  <div class="nada">
    <div class="aviso ok" style="margin-bottom:3mm">
      <p style="margin-bottom:0"><b>Se auditó lo que hay y no hay ninguna razón fuerte
      para cambiarlo.</b> El stack actual es moderno, chico y adecuado al problema.</p>
    </div>
    <div class="tbl">
    <table>
      <thead><tr><th style="width:14%">Capa</th><th style="width:26%">Hoy</th>
        <th style="width:16%">Propuesta</th><th style="width:44%">Por qué</th></tr></thead>
      <tbody>
        <tr><td><b>Frontend</b></td><td class="mini">Next.js 16.3.4 · App Router · React 19.2 · TS 5</td>
            <td><span class="et et-keep">CONSERVAR</span></td>
            <td>Los Server Components dejan las consultas del lado del servidor: menos datos financieros viajando al navegador</td></tr>
        <tr><td><b>Estilos</b></td><td class="mini">Tailwind CSS 4 · <code>@theme</code> · sin config JS</td>
            <td><span class="et et-keep">CONSERVAR</span></td>
            <td>Los tokens ya están definidos en CSS y funcionan, con variante oscura</td></tr>
        <tr><td><b>Grilla</b></td><td class="mini">AG Grid Community 36</td>
            <td><span class="et et-keep">CONSERVAR</span></td>
            <td>El portapapeles de rango es Enterprise; el pegado está hecho a mano y funciona</td></tr>
        <tr><td><b>Backend</b></td><td class="mini">Server Actions + funciones <code>security invoker</code></td>
            <td><span class="et et-keep">CONSERVAR</span></td>
            <td>Las operaciones compuestas son atómicas en la base, no en el cliente</td></tr>
        <tr><td><b>Base</b></td><td class="mini">PostgreSQL 18 (Supabase)</td>
            <td><span class="et et-keep">CONSERVAR</span></td>
            <td>Columnas generadas, enums y CHECK hacen imposibles los estados inválidos</td></tr>
        <tr><td><b>Auth</b></td><td class="mini">Supabase Auth + <code>@supabase/ssr</code></td>
            <td><span class="et et-keep">CONSERVAR</span></td>
            <td>Se integra con RLS: el usuario de la sesión <b>es</b> el sujeto de la política</td></tr>
        <tr style="background:var(--brand-wash)"><td><b>Storage</b></td><td class="mini">—</td>
            <td><span class="et et-new">AGREGAR</span></td>
            <td>Supabase Storage: los archivos originales tienen que archivarse</td></tr>
        <tr><td><b>Tests</b></td><td class="mini">Vitest 5 + PGlite (PostgreSQL 18 en WASM)</td>
            <td><span class="et et-keep">CONSERVAR</span></td>
            <td>La paridad TS ↔ Postgres se verifica contra Postgres real, no contra un mock</td></tr>
        <tr style="background:var(--brand-wash)"><td><b>Excel</b></td><td class="mini">—</td>
            <td><span class="et et-new">AGREGAR</span></td>
            <td>Lectura de <code>.xlsx</code> del lado del servidor. El archivo no pasa por ningún servicio de terceros</td></tr>
        <tr><td><b>Observab.</b></td><td class="mini">Módulo propio, sin secretos</td>
            <td><span class="et et-red">CONSERVAR +</span></td>
            <td>Sumar el error tracking que provee el hosting</td></tr>
      </tbody>
    </table>
    </div>
  </div>

  <div class="nada">
    <h3>Lo que se agrega, y nada más</h3>
    <ol class="num" style="margin-bottom:3.4mm">
      <li><b>Lectura de <code>.xlsx</code></b> del lado del servidor.</li>
      <li><b>Supabase Storage</b> para archivar los originales, con política de acceso.</li>
      <li><b>Paginación por servidor</b> en acreditaciones y conciliación. Es la única
      concesión que exige el volumen.</li>
      <li><b>Un job diario</b> para el dump lógico de respaldo independiente.</li>
    </ol>

    <div class="card no" style="margin-bottom:3.4mm">
      <span class="rot" style="color:var(--neg)">Lo que NO vamos a hacer</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1mm">Nada de microservicios,
      colas, Kafka, CQRS ni event sourcing. El volumen —600 filas por día, 15.000 por
      mes— entra cómodo en <b>una sola base Postgres</b> con índices razonables. Meter
      infraestructura distribuida acá agregaría puntos de falla y ninguna capacidad.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0">Tampoco dashboards de BI
      por defecto: no hay ninguna pregunta del producto que un gráfico responda mejor que
      una cifra.</p>
    </div>

    <div class="aviso wa nada">
      <span class="rot" style="color:var(--warn)">Nota sobre el volumen</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1mm">La estimación anterior
      del proyecto era de <b>~50.000 filas/año</b>. Con 300–600 transferencias diarias el
      orden real es <b>90.000–180.000 filas/año sólo de transferencias</b>, más las
      acreditaciones.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0">Sigue siendo chico para
      Postgres —menos de 1 GB a varios años— pero <b>cambia el diseño de la interfaz</b>:
      sin paginación por servidor, las tablas de la mitad operativa no sobreviven el
      segundo mes.</p>
    </div>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  28 · Infraestructura
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("28", "Infraestructura y hosting", "Recomendación", """
<div class="g2" style="margin-bottom:3.6mm">
  <div class="card br nada">
    <span class="rot" style="color:var(--brand)">Recomendación</span>
    <div class="tbl" style="margin:1.6mm 0 2mm;background:var(--surface)">
    <table>
      <tbody>
        <tr><td style="width:42%"><b>Frontend</b><br><span class="mini">Next.js</span></td>
            <td><b>Vercel</b> · plan Pro</td><td class="num">~20 USD/mes</td></tr>
        <tr><td><b>Base · Auth · Storage</b></td><td><b>Supabase</b> · plan Pro</td><td class="num">~25 USD/mes</td></tr>
        <tr><td><b>Respaldo independiente</b></td><td>Dump lógico diario a almacenamiento propio</td><td class="num">~0</td></tr>
        <tr style="background:var(--brand-wash)"><td colspan="2"><b>Total</b></td>
            <td class="num"><b>~45 USD/mes</b></td></tr>
      </tbody>
    </table>
    </div>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0"><b>Por qué.</b> Es lo que el
    código ya supone: <code>@supabase/ssr</code>, RLS con <code>security_invoker</code>,
    Server Actions de Next 16. Elegir otra cosa significaría reescribir la autenticación y
    la seguridad por fila —la parte más delicada de lo que ya está hecho— sin ganar nada.</p>
  </div>

  <div class="nada">
    <div class="aviso no" style="margin-bottom:3mm">
      <span class="rot" style="color:var(--neg)">Por qué Pro y no Free</span>
      <p style="margin:1.2mm 0 0">No es por volumen: entrarían de sobra en Free. Es porque
      <b>el plan gratuito pausa el proyecto tras una semana de inactividad y no tiene
      ningún backup</b>. Para una financiera eso no es una opción.</p>
    </div>

    <h3>Respaldos</h3>
    <div class="tbl">
    <table>
      <tbody>
        <tr><td style="width:32%"><b>Supabase Pro</b></td>
            <td>Backup diario, retención 7 días</td></tr>
        <tr><td><b>PITR</b></td>
            <td>+100 USD/mes. <b>No al arrancar.</b> Recomendado desde el momento en que
            entren datos reales de clientes y el histórico migrado</td></tr>
        <tr style="background:var(--pos-wash)"><td><b>Dump independiente</b></td>
            <td>Recomendado <b>desde el día uno</b>: un dump lógico diario a
            almacenamiento propio. Protege contra la pérdida de la cuenta, que ningún
            backup del proveedor cubre</td></tr>
      </tbody>
    </table>
    </div>
  </div>
</div>

<h3>Ambientes</h3>
<div class="tbl" style="margin-bottom:3.4mm">
<table>
  <thead><tr><th style="width:16%">Ambiente</th><th style="width:26%">Frontend</th>
    <th style="width:28%">Base</th><th style="width:30%">Datos</th></tr></thead>
  <tbody>
    <tr><td><b>Producción</b></td><td>Vercel · dominio propio</td><td class="m">nordelta-prod</td><td>Reales</td></tr>
    <tr><td><b>Staging</b></td><td>Vercel · preview por rama</td><td class="m">nordelta-staging</td><td>Copia anonimizada</td></tr>
    <tr><td><b>Desarrollo</b></td><td>Local</td><td>Modo demostración, en memoria</td><td>Sintéticos y determinísticos</td></tr>
  </tbody>
</table>
</div>

<div class="aviso ok">
  <p style="margin-bottom:0">El modo demostración <b>ya funciona sin base</b>, así que se
  puede desarrollar y demostrar el producto sin tocar datos reales ni pagar un ambiente
  más. Es una ventaja que ya está construida y conviene no perderla.</p>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  29 · Hosting · alternativa
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("29", "Hosting · alternativa evaluada", "VPS propio, con pros y contras", """
<p style="max-width:200mm">Ya tienen infraestructura en Hostinger —n8n corre en
<code>srv949269.hstgr.cloud</code>— así que un VPS propio es una opción real y no
teórica. Se evaluó en serio.</p>

<div class="tbl" style="margin:3.4mm 0">
<table>
  <thead><tr><th style="width:22%"></th>
    <th style="width:39%">Vercel + Supabase · <span style="color:var(--brand)">RECOMENDADO</span></th>
    <th style="width:39%">VPS propio con Docker</th></tr></thead>
  <tbody>
    <tr><td><b>Costo</b></td><td>~45 USD/mes</td><td>~15–25 USD/mes</td></tr>
    <tr><td><b>Puesta en marcha</b></td><td>Horas</td><td>Días</td></tr>
    <tr><td><b>Backups</b></td><td>Incluidos y probados por el proveedor</td>
        <td><b>Los hacés vos, y los probás vos</b></td></tr>
    <tr><td><b>TLS, actualizaciones, monitoreo</b></td><td>Incluidos</td><td>Tuyos</td></tr>
    <tr><td><b>Auth + seguridad por fila</b></td>
        <td>Integrados, y ya usados por el código que existe</td>
        <td>Supabase self-hosted (mantenimiento propio) o construirlo desde cero</td></tr>
    <tr><td><b>Escalar</b></td><td>Automático</td><td>Manual</td></tr>
    <tr><td><b>Vendor lock-in</b></td>
        <td>Medio: <b>Postgres es estándar y el dump es portable</b>. Lo atado es Auth y Storage</td>
        <td>Bajo</td></tr>
    <tr><td><b>Necesita</b></td><td>Nadie de infraestructura</td>
        <td><b>Alguien que se ocupe</b>, de forma continua</td></tr>
  </tbody>
</table>
</div>

<div class="g23">
  <div class="aviso nada">
    <span class="rot" style="color:var(--brand)">Veredicto</span>
    <p style="margin:1.2mm 0 1.2mm">Sin una persona dedicada a infraestructura, el VPS
    transfiere al equipo de producto trabajo que no es de producto — y <b>el primer backup
    que no se probó se descubre el día que hace falta</b>.</p>
    <p style="margin-bottom:0">Los 20–30 USD de diferencia mensual no justifican ese riesgo
    en una operación financiera. Si más adelante aparece alguien de infra y el costo
    empieza a pesar, la migración es posible: los datos son Postgres estándar.</p>
  </div>

  <div class="nada">
    <div class="card pl" style="margin-bottom:3mm">
      <span class="rot">Tercera opción, descartada</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 0"><b>Vercel + Neon +
      Auth.js.</b> Se descarta porque pierde Storage y la integración de auth con RLS, que
      es justo lo que el código ya aprovecha. Cambiaría trabajo hecho por trabajo nuevo,
      sin ninguna ventaja.</p>
    </div>

    <div class="card pl nada">
      <span class="rot">Sobre el lock-in, con precisión</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1mm">Conviene decirlo sin
      exagerar en ninguna dirección: <b>la base es PostgreSQL estándar y las migraciones
      son SQL plano</b>, así que los datos y el esquema son portables a cualquier
      Postgres.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0">Lo que quedaría atado a
      Supabase es autenticación y almacenamiento de archivos. Migrar eso sería un proyecto
      de días, no de meses.</p>
    </div>
  </div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  30 · Arquitectura de datos
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("30", "Arquitectura de datos", "El flujo y la costura · propuesta conceptual", """
<div class="aviso wa" style="margin-bottom:3.4mm">
  <p style="margin-bottom:0"><b>Nada de esto se aplicó.</b> Es la propuesta conceptual. El
  esquema actual —cuatro migraciones, 976 líneas— no se modificó.</p>
</div>

<div class="g32">
  <pre class="ascii" style="font-size:6pt;line-height:1.4">   <b>CLIENTE</b>                          <b>SISTEMA EXTERNO</b>
      │                                    │
      │ archivo                            │ «Ingresos
      ↓                                    ↓  y créditos»
┌───────────┐                       ┌──────────────┐
│  <i>lotes</i>    │ archivo, hash,      │<i>lotes_credito</i>│
│           │ canal, quién,         │              │
│           │ cuándo, Storage       │              │
└─────┬─────┘                       └──────┬───────┘
      ↓                                    ↓
┌────────────┐                      ┌──────────────┐
│<i>lote_filas</i> │ fila cruda +        │<i>acreditaciones</i>│
│            │ normalizada +       │              │
│            │ errores             │              │
└─────┬──────┘ nada se pierde      └──────┬───────┘
      │ validación                        │
      ↓                                   │
┌────────────────┐                        │
│<i>transferencias</i>│ estado_proceso        │
│                │ estado_acreditacion    │
│                │ cuit + norm + valido   │
└───────┬────────┘                        │
        └──────────────┬──────────────────┘
                       ↓
              ┌─────────────────┐
              │ <i>conciliaciones</i> │ transferencia ↔ acreditación
              │                 │ tipo · señales · quién · cuándo
              └────────┬────────┘
                       │ confirmada
        ══════════ <i>LA COSTURA</i> ══════════
                       ↓
              ┌─────────────────┐
              │  <b>movimientos</b>    │ <b>EXISTE</b> · granularidad = N1
              └────────┬────────┘
                       ↓
              ┌─────────────────┐
              │    <b>partidas</b>     │ <b>EXISTE</b> · una por pata monetaria
              └────────┬────────┘
                       ↓
              ┌─────────────────┐
              │   <b>v_cta_cte</b>     │ <b>EXISTE</b> · saldo corrido
              └────────┬────────┘
                       ↓
              ┌─────────────────┐
              │   <b>v_balance</b>     │ <b>EXISTE</b> · totales por moneda
              └─────────────────┘

 <b>contrapartes</b> ── referenciada por transferencias y movimientos
 <b>auditoria</b>    ── registra toda decisión humana de las dos mitades</pre>

  <div class="nada">
    <h3>Las relaciones que importan</h3>
    <pre class="ascii" style="margin-bottom:3mm">lote           1 ── N  lote_filas
lote_filas     1 ── 1  transferencia  (las válidas)
lote           N ── 1  contraparte
transferencia  N ── 1  contraparte
transferencia  1 ── 0..1 conciliacion
acreditacion   1 ── 0..1 conciliacion
<i>conciliacion   N ── 0..1 movimiento</i>   ← la costura
movimiento     1 ── N  partida        <b>EXISTE</b>
movimiento     N ── 1  contraparte    <b>EXISTE</b></pre>

    <div class="aviso">
      <p style="margin-bottom:1.2mm">La relación <b>conciliación N ── 1 movimiento</b> es
      la que expresa la agregación: varias conciliaciones confirmadas pueden apuntar al
      mismo movimiento contable.</p>
      <p style="margin-bottom:0">Si <b>N1</b> resuelve «una por transferencia», el N pasa a
      ser 1 <b>y no hay que cambiar nada más</b>. Por eso la relación se modela así desde
      el principio: absorbe las tres respuestas posibles.</p>
    </div>

    <h3 style="margin-top:3.4mm">Sobre el esquema existente</h3>
    <p class="mini">No cambia. Lo único que se propone agregarle es un
    <code>movimientos.lote_id</code> nullable, para poder hacer el join hacia atrás sin
    leer el <code>origen jsonb</code> que ya existe. Es una columna nullable: no rompe nada
    ni exige migrar datos.</p>

    <h3 style="margin-top:3mm">Índices que va a necesitar el volumen</h3>
    <p class="mini" style="margin-bottom:0">Concreto, porque el volumen lo exige.
    <code>transferencias</code> por <code>(contraparte_id, estado_acreditacion)</code>, por
    <code>(cuit_norm, importe, fecha)</code> para el matching, y por <code>lote_id</code>.
    <code>acreditaciones</code> por <code>(cuit, importe, fecha)</code> y por
    <code>referencia_externa</code>.</p>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  31 · Tablas nuevas
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("31", "Arquitectura de datos · tablas", "Ocho tablas nuevas · el esquema contable no se toca", """
<div class="tbl compacta">
<table>
  <thead><tr><th style="width:16%">Tabla</th><th style="width:34%">Para qué</th>
    <th style="width:50%">Campos principales</th></tr></thead>
  <tbody>
    <tr><td class="m"><b>lotes</b></td>
        <td>Un archivo recibido de un cliente</td>
        <td class="mini"><code>contraparte_id</code> · <code>canal</code> ·
        <code>archivo_ref</code> · <code>hash</code> · <code>recibido_por</code> ·
        <code>estado</code> · contadores de filas</td></tr>
    <tr><td class="m"><b>lote_filas</b></td>
        <td>La fila tal como vino <b>y</b> normalizada, con sus errores. Es lo que garantiza
        que nada desaparece en silencio</td>
        <td class="mini"><code>lote_id</code> · <code>nro_fila</code> ·
        <code>crudo jsonb</code> · <code>normalizado jsonb</code> ·
        <code>errores jsonb</code> · <code>estado</code></td></tr>
    <tr style="background:var(--brand-wash)"><td class="m"><b>transferencias</b></td>
        <td>La orden de transferencia, ya normalizada. <b>Es la tabla central de la mitad
        operativa</b></td>
        <td class="mini"><code>lote_id</code> · <code>contraparte_id</code> ·
        <code>cuit</code> + <code>cuit_norm</code> + <code>cuit_valido</code> ·
        <code>titular</code> · <code>importe</code> · <code>moneda</code> ·
        <code>banco</code> · <code>referencia_externa</code> ·
        <code>estado_proceso</code> · <code>estado_acreditacion</code></td></tr>
    <tr><td class="m"><b>lotes_credito</b></td>
        <td>Un archivo «Ingresos y créditos» descargado del sistema externo</td>
        <td class="mini"><code>archivo_ref</code> · <code>hash</code> ·
        <code>importado_por</code> · contadores</td></tr>
    <tr><td class="m"><b>acreditaciones</b></td>
        <td>Una línea de crédito del sistema externo</td>
        <td class="mini"><code>lote_credito_id</code> · <code>cuit</code> ·
        <code>importe</code> · <code>fecha</code> · <code>banco</code> ·
        <code>referencia_externa</code> · <code>crudo jsonb</code></td></tr>
    <tr style="background:var(--brand-wash)"><td class="m"><b>conciliaciones</b></td>
        <td>El vínculo <b>y la decisión</b>, con su evidencia. Es lo que hace auditable la
        costura</td>
        <td class="mini"><code>transferencia_id</code> · <code>acreditacion_id</code> ·
        <code>tipo</code> (auto/manual) · <code>señales jsonb</code> ·
        <code>estado</code> · <code>decidido_por</code> · <code>decidido_en</code> ·
        <code>movimiento_id</code></td></tr>
    <tr><td class="m"><b>contraparte_canales</b></td>
        <td>Direcciones y remitentes de cada cliente. <b>Habilita la ingesta futura desde
        email sin rediseñar nada</b></td>
        <td class="mini"><code>contraparte_id</code> · <code>tipo</code> ·
        <code>valor</code> · <code>activo</code></td></tr>
    <tr><td class="m"><b>mapeos_columnas</b></td>
        <td>Cómo se leen los archivos de cada cliente</td>
        <td class="mini"><code>contraparte_id</code> · <code>mapeo jsonb</code> ·
        <code>version</code> · <code>creado_por</code></td></tr>
  </tbody>
</table>
</div>

<div class="g3" style="margin-top:3mm">
  <div class="card pl nada">
    <span class="rot">Por qué <code>crudo jsonb</code> en dos tablas</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Porque la fila original del
    archivo es <b>evidencia</b>. Si dentro de tres meses hay una discusión sobre qué mandó
    el cliente o qué devolvió el banco, la respuesta tiene que estar en la base y no en un
    adjunto de correo.</p>
  </div>
  <div class="card pl nada">
    <span class="rot">Por qué <code>señales jsonb</code> y no un score</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Un número no se puede
    auditar. Guardar qué señales coincidían en el momento de confirmar permite reconstruir
    la decisión, y también <b>medir después</b> qué señales sirvieron de verdad.</p>
  </div>
  <div class="card pl nada">
    <span class="rot">Cuatro migraciones nuevas</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0"><code>0005</code> lotes e
    ingesta · <code>0006</code> transferencias y estados · <code>0007</code> acreditaciones
    y conciliaciones · <code>0008</code> RLS y vistas de las tablas nuevas. Las cuatro
    existentes no se editan.</p>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  32 · Integraciones
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("32", "Integraciones", "Mapa de sistemas externos", """
<div class="tbl" style="margin-bottom:3.4mm">
<table>
  <thead><tr><th style="width:17%">Sistema</th><th style="width:31%">Rol hoy</th>
    <th style="width:22%">Destino</th><th style="width:30%">Cuándo</th></tr></thead>
  <tbody>
    <tr><td><b>Gmail</b></td><td>Los clientes mandan los Excel acá</td>
        <td><span class="et et-new">INTEGRATE</span> lectura para ingesta automática</td>
        <td>Fase 6. En el MVP el archivo se sube a mano</td></tr>
    <tr><td><b>WhatsApp</b></td><td>Canal ocasional para archivos</td>
        <td><span class="et et-val">TO VALIDATE</span></td>
        <td>Decisión <b>N12</b>. Si es excepción, se registra el canal a mano</td></tr>
    <tr style="background:var(--pos-wash)"><td><b>Excel</b></td>
        <td>Formato de intercambio con los clientes</td>
        <td><span class="et et-keep">KEEP PERMANENTLY</span></td>
        <td>Los clientes no van a cambiar. <b>La app tiene que leerlo bien</b></td></tr>
    <tr><td><b>Drive</b></td><td>Donde se guardan los archivos</td>
        <td><span class="et et-red">REPLACE</span> por Supabase Storage</td>
        <td>Fase 2. Migrar el histórico de archivos es opcional</td></tr>
    <tr style="background:var(--neg-wash)"><td><b>Sistema externo de transferencias</b></td>
        <td>Se le carga el archivo y se le descargan los créditos</td>
        <td><span class="et et-new">INTEGRATE</span> si tiene API; si no, <span class="et et-keep">KEEP</span> con archivos</td>
        <td><b>Bloqueante para el diseño</b>: hay que saber qué exporta</td></tr>
    <tr><td><b>Google Sheets</b><br><span class="mini">Caja diaria, Cheques, Cierres, Clientes, Cuentas Corrientes</span></td>
        <td>El sistema contable actual</td>
        <td><span class="et et-del">REPLACE</span></td>
        <td>Fase 5, con marcha en paralelo</td></tr>
    <tr><td><b>Apps Script</b><br><span class="mini">6 archivos</span></td>
        <td>Consolidación y cierres</td>
        <td><span class="et et-del">REPLACE</span></td>
        <td>Fase 5. Ya está reimplementado y probado</td></tr>
    <tr><td><b>BigQuery</b><br><span class="mini">financiera-nordelta-f</span></td>
        <td>Motor de consolidación, no warehouse</td>
        <td><span class="et et-del">REMOVE EVENTUALLY</span></td>
        <td>Fase 5. Su único consumidor vivo es el Sheet que se reemplaza</td></tr>
    <tr><td><b>n8n</b><br><span class="mini">srv949269.hstgr.cloud</span></td>
        <td>Orquesta las 4 queries de BigQuery</td>
        <td><span class="et et-del">REMOVE EVENTUALLY</span> sólo para Nordelta</td>
        <td>Fase 5. <b>Ojo</b>: de 415 workflows sólo 6 son de Nordelta. No se toca el resto</td></tr>
  </tbody>
</table>
</div>

<div class="g2">
  <div class="aviso no nada">
    <span class="rot" style="color:var(--neg)">La integración que define el proyecto</span>
    <p style="margin:1.2mm 0 1.2mm"><b>El sistema externo de transferencias.</b> Todo el
    módulo de conciliación depende de qué formato tiene «Ingresos y créditos» y de si trae
    un identificador de operación (<b>N2</b>).</p>
    <p style="margin-bottom:0">Con identificador, el matching es casi determinístico. Sin
    él, depende de heurísticas y el volumen de sugerencias sube mucho. <b>No se puede
    estimar el ahorro de tiempo de la conciliación sin ver ese archivo.</b></p>
  </div>
  <div class="card wa nada">
    <span class="rot" style="color:var(--warn)">Nota de seguridad</span>
    <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1mm">El token de la API de n8n
    se pegó en una conversación de chat. <b>Hay que rotarlo.</b></p>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Nunca se escribió en ningún
    archivo ni commit —verificado— pero estuvo expuesto en un canal que no es un gestor de
    secretos.</p>
  </div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  33 · Accesos necesarios
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("33", "Accesos necesarios", "Checklist para el cliente · sin contraseñas en este documento", """
<div class="card no" style="margin-bottom:3.4mm">
  <span class="rot" style="color:var(--neg)">Bloqueantes para diseñar · sin esto no se escribe código</span>
  <div class="tbl" style="margin-top:1.6mm;background:var(--surface)">
  <table>
    <thead><tr><th style="width:5%"></th><th style="width:32%">Qué</th>
      <th style="width:48%">Para qué</th><th style="width:15%" class="c">Prioridad</th></tr></thead>
    <tbody>
      <tr><td>☐</td><td><b>3–5 Excel reales de clientes distintos</b></td>
          <td>Diseñar el parser y el mapeo de columnas. Sin esto, cualquier ingesta es una apuesta</td>
          <td class="c"><span class="blk">BLOQUEANTE</span></td></tr>
      <tr><td>☐</td><td><b>3–5 descargas reales de «Ingresos y créditos»</b></td>
          <td>Diseñar el matching y saber si hay identificador de operación (<b>N2</b>)</td>
          <td class="c"><span class="blk">BLOQUEANTE</span></td></tr>
      <tr><td>☐</td><td><b>Nombre y URL del sistema externo</b> de transferencias</td>
          <td>Saber si tiene API, export programable, o sólo pantalla</td>
          <td class="c"><span class="blk">BLOQUEANTE</span></td></tr>
    </tbody>
  </table>
  </div>
  <p class="mini" style="color:var(--ink-2);margin:1.8mm 0 0">Los archivos pueden venir
  <b>anonimizados en los nombres</b>, pero con la estructura de columnas intacta y los CUIT
  con su forma real: se pueden alterar dígitos manteniendo el formato.</p>
</div>

<div class="g2">
  <div class="nada">
    <h3>Para construir</h3>
    <div class="tbl">
    <table>
      <tbody>
        <tr><td style="width:7%">☐</td><td style="width:40%"><b>Gmail</b> operativo, lectura</td>
            <td>Ver la forma real de los mails y, en fase 6, la ingesta automática</td></tr>
        <tr><td>☐</td><td><b>Drive</b>, carpeta de archivos</td>
            <td>Entender la organización actual y evaluar migrar el histórico</td></tr>
        <tr><td>☐</td><td><b>Sheets</b>: Caja diaria 1 y 2, Cheques, los 6 de cierre, Clientes, Cuentas Corrientes</td>
            <td>Migración del histórico y marcha en paralelo</td></tr>
        <tr><td>☐</td><td><b>BigQuery</b> <code>financiera-nordelta-f</code>, lectura</td>
            <td>Export del histórico y cuantificar los defectos 5 y 6 en pesos</td></tr>
        <tr><td>☑</td><td><b>n8n</b> — ya lo tenemos</td>
            <td>Sólo leer los 6 workflows. <b>Rotar el token</b></td></tr>
        <tr><td>☑</td><td><b>Apps Script</b> — ya los tenemos (6 archivos)</td>
            <td>Ya analizados</td></tr>
        <tr><td>☐</td><td><b>Lista de usuarios</b> con oficina y rol</td>
            <td>Definir permisos · decisión <b>D9</b></td></tr>
        <tr><td>☐</td><td><b>Export del histórico</b> 2025–2026</td>
            <td>Migración y cuantificación de los defectos</td></tr>
      </tbody>
    </table>
    </div>
  </div>

  <div class="nada">
    <h3>Para poner en producción</h3>
    <div class="tbl" style="margin-bottom:3.4mm">
    <table>
      <tbody>
        <tr><td style="width:7%">☐</td><td style="width:40%"><b>Dominio o subdominio</b></td>
            <td>Publicar la aplicación</td></tr>
        <tr><td>☐</td><td><b>Quién paga y administra</b> Vercel y Supabase</td>
            <td>Titularidad de las cuentas, que no debería ser nuestra</td></tr>
        <tr><td>☐</td><td><b>Un contacto técnico</b> del lado del cliente</td>
            <td>Para DNS y accesos</td></tr>
        <tr style="background:var(--warn-wash)"><td>☐</td>
            <td><b>Política de retención de archivos</b></td>
            <td>Los CUIT de terceros son datos personales. Hay que definir cuánto se
            guardan y quién los ve</td></tr>
      </tbody>
    </table>
    </div>

    <div class="card wa nada">
      <span class="rot" style="color:var(--warn)">Sobre los datos de terceros</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1mm">Se van a almacenar CUIT
      y nombres de titulares que <b>no son clientes de Nordelta</b>: son los destinatarios
      de las transferencias de sus clientes.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0">La seguridad por fila ya
      existe y cubre el acceso. Lo que falta definir es <b>retención</b> y <b>quién puede
      ver los archivos originales</b>. Es una decisión del cliente, no técnica, y conviene
      tomarla antes de cargar el primer archivo real.</p>
    </div>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  34 · MVP
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("34", "MVP", "Alcance, fase 2 y futuro", """
<div class="aviso" style="margin-bottom:3.4mm">
  <p style="margin-bottom:1.2mm"><b>El criterio.</b> El MVP de esta etapa no es «todo el
  sistema». Es el mínimo que demuestre valor real en la operación diaria. Y como la mitad
  contable ya está construida, <b>el MVP se define por la mitad operativa</b>.</p>
  <p style="margin-bottom:0">El valor demostrable más rápido es <b>el archivo
  normalizado</b>: hoy alguien limpia un Excel a mano dos veces por lote. Una pantalla que
  lo hace en un minuto, con los errores señalados antes de procesar, ya paga el proyecto
  sin que exista todavía la conciliación.</p>
</div>

<div class="g3">
  <div class="nada">
    <h3 style="color:var(--brand)">MVP</h3>
    <div class="tbl micro">
    <table>
      <tbody>
        <tr><td style="width:38%"><b>Portada</b></td><td class="mini">Existe. Ajustar el relato</td></tr>
        <tr><td><b>Ingreso</b></td><td class="mini">Existe</td></tr>
        <tr style="background:var(--brand-wash)"><td><b>Home</b></td>
            <td class="mini">Rediseñada: pipeline del día, conciliación, estado por cliente</td></tr>
        <tr style="background:var(--brand-wash)"><td><b>Importar Excel</b></td>
            <td class="mini">Archivo → mapeo → normalización → validación → preview editable → confirmar</td></tr>
        <tr style="background:var(--brand-wash)"><td><b>Acreditaciones</b></td>
            <td class="mini">Bandeja con los dos ejes de estado, filtros, paginación, descarte con motivo</td></tr>
        <tr style="background:var(--brand-wash)"><td><b>Exportar normalizado</b></td>
            <td class="mini"><b>El valor inmediato del proyecto</b></td></tr>
        <tr style="background:var(--brand-wash)"><td><b>Importar créditos</b></td>
            <td class="mini">Ingesta de «Ingresos y créditos»</td></tr>
        <tr style="background:var(--brand-wash)"><td><b>Conciliación</b></td>
            <td class="mini">Matching asistido, cuatro resultados, confirmación con evidencia</td></tr>
        <tr style="background:var(--brand-wash)"><td><b>Cliente</b></td>
            <td class="mini">Cabecera operativa + cuatro pestañas</td></tr>
        <tr><td><b>Cuenta corriente</b></td><td class="mini">Existe</td></tr>
        <tr><td><b>Carga manual</b></td><td class="mini">Existe</td></tr>
        <tr><td><b>Balance</b></td><td class="mini">Existe</td></tr>
        <tr><td><b>Auditoría</b></td><td class="mini">Existe + las 5 entidades nuevas</td></tr>
        <tr style="background:var(--brand-wash)"><td><b>Configuración</b></td>
            <td class="mini">Mínima: mapeo de columnas y ventana de fechas del matching</td></tr>
      </tbody>
    </table>
    </div>
    <div class="card wa nada" style="margin-top:2mm">
      <span class="rot" style="color:var(--warn)">Condicional</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 0">La <b>generación
      automática del movimiento contable</b> desde una conciliación confirmada entra al MVP
      <b>si N1 y N3 están respondidas</b>. Si no, la conciliación queda registrada y el
      movimiento se carga a mano: es un paso más, pero no bloquea el resto.</p>
    </div>
  </div>

  <div class="nada">
    <h3>Fase 2</h3>
    <ul class="pl">
      <li>Ingesta automática desde Gmail</li>
      <li>Matching automático seguro, con la tasa real medida</li>
      <li>Cheques con estado de cobro y rechazo · decisión <b>D7</b></li>
      <li>Notificaciones de lote sin enviar y de pendientes viejos</li>
      <li>Roles y permisos completos · decisión <b>D9</b></li>
      <li>Migración del histórico y marcha en paralelo</li>
    </ul>

    <h3 style="margin-top:3.4mm">Futuro</h3>
    <ul class="pl">
      <li>WhatsApp como canal formal</li>
      <li>API directa del sistema externo, si existe</li>
      <li>Préstamos como entidad, <b>si se confirma que existen</b> · decisión <b>D4</b></li>
      <li>Consolidación multi-moneda con cotización de referencia · decisión <b>D5</b></li>
    </ul>
  </div>

  <div class="nada">
    <div class="card no">
      <span class="rot" style="color:var(--neg)">Fuera de alcance, explícitamente</span>
      <ul class="pl" style="margin:1.4mm 0 0;color:var(--ink-2)">
        <li>Dashboards de BI</li>
        <li>Aplicación móvil</li>
        <li>Portal para que el cliente cargue solo</li>
        <li>Reportes configurables</li>
        <li><b>Cualquier automatización de decisiones de matching ambiguas</b></li>
      </ul>
    </div>

    <div class="card ok" style="margin-top:3mm">
      <span class="rot" style="color:var(--pos)">Lo que el MVP hereda gratis</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 0">Motor financiero
      multi-moneda · saldo corrido y cierres · auditoría con diff por campo · exportación
      en formato argentino · seguridad por fila · sistema de diseño completo · 273 tests ·
      modo demostración sin base.</p>
    </div>

    <p class="mini" style="margin-top:3mm;margin-bottom:0"><b>Eso es lo que hace que este
    MVP sea alcanzable.</b> No se arranca de cero: se arranca desde la mitad de abajo ya
    construida y probada.</p>
  </div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  35 · Roadmap
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("35", "Roadmap", "Seis fases · las duraciones son estimaciones sujetas a la fase 0", """
<div class="flujo" style="margin-bottom:2.6mm">
  <div class="nodo wa" style="background:var(--warn-wash);border-color:var(--warn-line)">
    <div class="t">F0 · Accesos</div><div class="d">1–2 sem · en paralelo · sin código</div></div>
  <div class="fl">→</div>
  <div class="nodo"><div class="t">F1 · Shell y Home</div><div class="d">1–2 sem</div></div>
  <div class="fl">→</div>
  <div class="nodo br"><div class="t">F2 · Ingesta</div><div class="d">3–4 sem · primer valor</div></div>
  <div class="fl">→</div>
  <div class="nodo br"><div class="t">F3 · Conciliación</div><div class="d">3–4 sem · mayor riesgo</div></div>
  <div class="fl">→</div>
  <div class="nodo br"><div class="t">F4 · La costura</div><div class="d">1–2 sem</div></div>
  <div class="fl">→</div>
  <div class="nodo"><div class="t">F6 · Automatizar</div><div class="d">2–3 sem</div></div>
</div>

<div class="g23" style="margin-bottom:2.6mm">
  <pre class="ascii">F0 accesos ─┬─ F1 shell ── F2 ingesta ── F3 conciliación ── F4 costura ─┬─ F6 automatizar
            │                                                          │
            └──────────────── F5 Supabase real + histórico ────────────┘</pre>
  <div class="card pl nada">
    <span class="rot">La fase 5 corre en paralelo</span>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Puede arrancar desde el final
    de la fase 2: no depende de la conciliación. Es la única paralelizable, y conviene
    hacerlo porque tiene dependencias externas —accesos a BigQuery y Sheets— que pueden
    demorar.</p>
  </div>
</div>

<div class="tbl compacta">
<table>
  <thead><tr><th style="width:5%"></th><th style="width:18%">Fase</th><th style="width:9%">Estimado</th>
    <th style="width:34%">Objetivo</th><th style="width:34%">Depende de</th></tr></thead>
  <tbody>
    <tr style="background:var(--warn-wash)"><td class="m"><b>F0</b></td><td><b>Accesos y definiciones</b></td>
        <td class="mini">1–2 sem</td>
        <td>Tener los archivos reales y las tres respuestas bloqueantes</td>
        <td><b>El cliente.</b> Es la única fase que no depende de nosotros</td></tr>
    <tr><td class="m"><b>F1</b></td><td><b>Shell, navegación y Home</b></td>
        <td class="mini">1–2 sem</td>
        <td>Que la estructura nueva sea navegable, aunque los módulos estén vacíos</td>
        <td>Aprobación de este informe. <b>Nada más</b></td></tr>
    <tr style="background:var(--brand-wash)"><td class="m"><b>F2</b></td><td><b>Ingesta y Acreditaciones</b></td>
        <td class="mini">3–4 sem</td>
        <td>Eliminar la limpieza manual del Excel. <b>Primer valor real</b></td>
        <td>F0 (archivos reales) · F1</td></tr>
    <tr style="background:var(--brand-wash)"><td class="m"><b>F3</b></td><td><b>Conciliación</b></td>
        <td class="mini">3–4 sem</td>
        <td>Reemplazar el matching manual con colores y filtros</td>
        <td>F2 · <b>N2 respondida</b></td></tr>
    <tr style="background:var(--brand-wash)"><td class="m"><b>F4</b></td><td><b>La costura</b></td>
        <td class="mini">1–2 sem</td>
        <td>Que una conciliación confirmada genere el movimiento contable</td>
        <td>F3 · <b>N1 y N3 respondidas</b></td></tr>
    <tr><td class="m"><b>F5</b></td><td><b>Supabase real, histórico y paralelo</b></td>
        <td class="mini">3–5 sem</td>
        <td>Datos reales, con el sistema viejo todavía andando</td>
        <td>F4 · accesos a BigQuery y Sheets · <b>D1 y D2</b></td></tr>
    <tr><td class="m"><b>F6</b></td><td><b>Automatizaciones</b></td>
        <td class="mini">2–3 sem</td>
        <td>Sacar los pasos manuales que quedaron</td>
        <td>F3 y F5 con datos reales corriendo</td></tr>
  </tbody>
</table>
</div>

<p class="mini" style="margin-top:2.6mm;max-width:200mm;margin-bottom:0"><b>Sobre las
duraciones.</b> Semanas de una persona dedicada, y son estimaciones, no compromisos. La
fase 3 es la que más puede moverse, por la razón del riesgo número 1.</p>"""))

# ═════════════════════════════════════════════════════════════════════════
#  36 · Roadmap · detalle
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("36", "Roadmap · detalle por fase", "Entregables, riesgos y cómo lo valida el cliente", """
<div class="g3" style="gap:3.6mm">
  <div class="nada">
    <div class="card wa" style="margin-bottom:3mm">
      <span class="rot" style="color:var(--warn)">F0 · Accesos y definiciones</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1mm"><b>Entregables</b> ·
      Muestras de Excel y de créditos analizadas · N1, N2, N3 respondidas · mapeo de
      columnas de los clientes principales documentado.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:1mm"><b>Riesgo</b> · Que las
      muestras no lleguen. Sin ellas la fase 2 arranca a ciegas.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0"><b>Validación</b> ·
      Reunión de treinta minutos revisando un archivo real en pantalla.</p>
    </div>

    <div class="card pl" style="margin-bottom:3mm">
      <span class="rot">F1 · Shell, navegación y Home</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1mm"><b>Entregables</b> ·
      Riel con los cuatro grupos · rutas nuevas con estados vacíos · Home rediseñada con el
      pipeline · Ajustes movido al cliente.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:1mm"><b>Riesgo</b> · Bajo. Es
      reordenar lo que existe.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0"><b>Validación</b> · El
      cliente navega la estructura y confirma que <b>los nombres son los suyos</b>.</p>
    </div>

    <div class="card br nada">
      <span class="rot" style="color:var(--brand)">F2 · Ingesta y Acreditaciones</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1mm"><b>Entregables</b> ·
      Tablas <code>lotes</code>, <code>lote_filas</code>, <code>transferencias</code> ·
      lectura de <code>.xlsx</code> · normalización y validación de CUIT ·
      <code>GrillaEditable</code> extraída de <code>CargaGrid</code> · preview editable ·
      bandeja con estados · exportar normalizado.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:1mm"><b>Riesgo</b> · Que los
      archivos sean más heterogéneos de lo previsto. Mitigación: el mapeo por cliente lo
      absorbe.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0"><b>Validación</b> · El
      operador procesa un lote real y <b>compara el tiempo contra su método actual, con
      cronómetro</b>. Ya hay un protocolo escrito para esto.</p>
    </div>
  </div>

  <div class="nada">
    <div class="card br" style="margin-bottom:3mm">
      <span class="rot" style="color:var(--brand)">F3 · Conciliación</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1mm"><b>Entregables</b> ·
      Tablas <code>lotes_credito</code>, <code>acreditaciones</code>,
      <code>conciliaciones</code> · ingesta de créditos · motor de señales · pantalla de
      decisión · totales por cliente.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:1mm"><b>Riesgo</b> ·
      <b>El más alto del proyecto.</b> Sin identificador de operación, la tasa de
      sugerencias puede ser alta y el ahorro menor al esperado. Mitigación: medir sobre
      datos reales antes de prometer un número.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0"><b>Validación</b> ·
      Conciliar un día real en paralelo con el método actual y comparar <b>fila por
      fila</b>.</p>
    </div>

    <div class="card br" style="margin-bottom:3mm">
      <span class="rot" style="color:var(--brand)">F4 · La costura</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1mm"><b>Entregables</b> ·
      Generación del movimiento con la granularidad de <b>N1</b> · trazabilidad hacia el
      archivo original · auditoría de la decisión con su evidencia.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:1mm"><b>Riesgo</b> · Si N1
      cambia después de implementado, hay que rehacer movimientos ya generados. Mitigación:
      la decisión queda aislada en un solo punto del código.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0"><b>Validación</b> · Un
      movimiento generado se abre hasta el archivo del cliente, y el saldo coincide con el
      cálculo manual.</p>
    </div>

    <div class="card pl nada">
      <span class="rot">F5 · Supabase real, histórico y paralelo</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1mm"><b>Entregables</b> ·
      Proyecto de producción y staging · <b>los 54 tests corridos contra base real</b> ·
      histórico 2025–2026 migrado y conciliado · runbook de marcha en paralelo ejecutado.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:1mm"><b>Riesgo</b> ·
      Diferencias con el legacy por los defectos 5 y 6, que <b>hacen que el legacy esté
      mal, no el sistema nuevo</b>. Hay que poder explicar cada diferencia.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0"><b>Validación</b> · El
      criterio y las tolerancias ya están escritos en
      <code>RECONCILIATION_STRATEGY.md</code>.</p>
    </div>
  </div>

  <div class="nada">
    <div class="card pl" style="margin-bottom:3mm">
      <span class="rot">F6 · Automatizaciones</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1mm"><b>Entregables</b> ·
      Ingesta desde Gmail · matching automático seguro con su tasa medida ·
      notificaciones.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:1mm"><b>Riesgo</b> ·
      Automatizar sobre reglas no validadas. Mitigación: <b>no se automatiza nada cuya tasa
      de acierto no se haya medido en producción</b>.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0"><b>Validación</b> · Una
      semana de operación con la ingesta automática y revisión manual en paralelo.</p>
    </div>

    <div class="aviso no" style="margin-bottom:3mm">
      <span class="rot" style="color:var(--neg)">El riesgo que no está en ninguna fase</span>
      <p style="margin:1.2mm 0 0">Construir la conciliación <b>antes</b> de tener los
      archivos reales. Sería el error más caro posible: tres o cuatro semanas de trabajo
      sobre supuestos. <b>Por eso la fase 0 existe y no tiene código.</b></p>
    </div>

    <div class="card ok nada">
      <span class="rot" style="color:var(--pos)">Lo que se puede empezar sin esperar nada</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 0">La <b>fase 1</b>. Es
      reordenar navegación y rediseñar la Home sobre datos que ya existen: no depende de
      ningún acceso ni de ninguna decisión del cliente más allá de aprobar este informe.</p>
    </div>
  </div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  37 · Decisiones pendientes
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("37", "Decisiones pendientes", "Doce nuevas, y las que siguen abiertas de la etapa anterior", """
<div class="g23">
  <div class="nada">
    <h3>Nuevas · del flujo de acreditaciones</h3>
    <div class="tbl micro">
    <table>
      <thead><tr><th style="width:6%">#</th><th style="width:52%">Pregunta</th>
        <th style="width:14%" class="c">Prioridad</th><th style="width:28%">Bloquea</th></tr></thead>
      <tbody>
        <tr style="background:var(--neg-wash)"><td class="m"><b>N1</b></td>
            <td>¿A qué granularidad una conciliación confirmada impacta la cuenta corriente?
            Una por transferencia, una por lote y cliente, o una por cliente y día</td>
            <td class="c"><span class="blk">BLOCKER</span></td>
            <td>Fase 4 · y el esquema de <code>conciliaciones</code></td></tr>
        <tr style="background:var(--neg-wash)"><td class="m"><b>N2</b></td>
            <td>¿«Ingresos y créditos» trae algún identificador de operación?</td>
            <td class="c"><span class="blk">BLOCKER</span></td>
            <td>Fase 3 · define si el matching es determinístico o heurístico</td></tr>
        <tr style="background:var(--neg-wash)"><td class="m"><b>N3</b></td>
            <td>¿Nordelta cobra comisión por la transferencia? ¿Se registra en la cuenta
            corriente del cliente?</td>
            <td class="c"><span class="blk">BLOCKER</span></td>
            <td>Fase 4 · define si el movimiento tiene una o dos partidas</td></tr>
        <tr><td class="m"><b>N4</b></td>
            <td>¿Una transferencia individual puede acreditarse parcialmente, o la
            parcialidad es sólo agregada por cliente?</td>
            <td class="c"><span class="hi">HIGH</span></td><td>El eje 2 de estados</td></tr>
        <tr><td class="m"><b>N5</b></td>
            <td>¿Qué pasa con una transferencia enviada que nunca se acredita? ¿Hay plazo?
            ¿Se devuelve?</td>
            <td class="c"><span class="hi">HIGH</span></td>
            <td>Un estado terminal que hoy no existe</td></tr>
        <tr><td class="m"><b>N6</b></td>
            <td>¿Quién autoriza el envío de un lote? ¿Hay paso de aprobación?</td>
            <td class="c"><span class="hi">HIGH</span></td><td>Fase 2 y los roles</td></tr>
        <tr><td class="m"><b>N7</b></td>
            <td>Con el CUIT mal, ¿corrige Nordelta o se le pide el archivo de nuevo al
            cliente?</td>
            <td class="c"><span class="hi">HIGH</span></td>
            <td>Si hace falta un estado «devuelto al cliente»</td></tr>
        <tr><td class="m"><b>N8</b></td>
            <td>¿Los clientes de acreditaciones son las mismas contrapartes de la cuenta
            corriente?</td>
            <td class="c"><span class="et et-red">MEDIUM</span></td>
            <td>Si la pantalla de cliente es una o dos</td></tr>
        <tr><td class="m"><b>N9</b></td><td>¿Las transferencias son siempre en pesos?</td>
            <td class="c"><span class="et et-red">MEDIUM</span></td>
            <td>El campo moneda de <code>transferencias</code></td></tr>
        <tr><td class="m"><b>N10</b></td>
            <td>¿Cuántos clientes mandan archivos por día, y cuántos archivos cada uno?</td>
            <td class="c"><span class="et et-red">MEDIUM</span></td>
            <td>Dimensionar la bandeja y la paginación</td></tr>
        <tr><td class="m"><b>N11</b></td>
            <td>¿Cada cliente manda su propio formato de Excel, o es siempre el mismo?</td>
            <td class="c"><span class="et et-red">MEDIUM</span></td>
            <td>Si el mapeo por cliente es obligatorio</td></tr>
        <tr><td class="m"><b>N12</b></td><td>¿WhatsApp es excepción o canal regular?</td>
            <td class="c"><span class="et et-fus">LOW</span></td>
            <td>Si se registra el canal a mano</td></tr>
      </tbody>
    </table>
    </div>
  </div>

  <div class="nada">
    <h3>Anteriores · siguen abiertas</h3>
    <p class="mini" style="margin-bottom:1.6mm">Detalle completo en
    <code>OPEN_BUSINESS_DECISIONS.md</code>. Las que afectan a esta etapa:</p>
    <div class="tbl micro" style="margin-bottom:2.6mm">
    <table>
      <tbody>
        <tr style="background:var(--neg-wash)"><td class="m" style="width:12%"><b>D1</b></td>
            <td>¿Sigue vigente el asiento espejo del proveedor de transferencia?</td>
            <td class="c" style="width:20%"><span class="blk">BLOCKER</span></td></tr>
        <tr style="background:var(--neg-wash)"><td class="m"><b>D2</b></td>
            <td>¿Qué es un «full pago» y qué lo distingue?</td>
            <td class="c"><span class="blk">BLOCKER</span></td></tr>
        <tr><td class="m"><b>D5</b></td><td>¿De dónde sale el tipo de cambio? ¿Hay que preservar cotizaciones?</td>
            <td class="c"><span class="hi">HIGH</span></td></tr>
        <tr><td class="m"><b>D7</b></td><td>¿Cuándo impacta contablemente un cheque? ¿Existe el rechazo?</td>
            <td class="c"><span class="hi">HIGH</span></td></tr>
        <tr><td class="m"><b>D8</b></td><td>¿Qué debe pasar al editar un movimiento histórico?</td>
            <td class="c"><span class="hi">HIGH</span></td></tr>
        <tr><td class="m"><b>D9</b></td><td>¿Quiénes usan el sistema y qué ve cada uno?</td>
            <td class="c"><span class="et et-red">MEDIUM</span></td></tr>
        <tr><td class="m"><b>Resto</b></td>
            <td>D3 · D4 · D6 · D10 a D14 — ver el documento · de HIGH a LOW</td>
            <td class="c"></td></tr>
      </tbody>
    </table>
    </div>

    <div class="aviso no" style="margin-bottom:3mm">
      <span class="rot" style="color:var(--neg)">D1 merece un párrafo</span>
      <p style="margin:1.2mm 0 0">La query de 2025 emitía un movimiento espejo a nombre del
      proveedor de la transferencia, y esa rama <b>no existe</b> en la de 2026. Si tenía que
      seguir existiendo, <b>faltan asientos de proveedor desde enero de 2026</b> — y eso es
      un incidente, no una decisión de diseño.</p>
    </div>

    <h3>Roles · propuesta preliminar</h3>
    <p class="mini"><span class="et et-val">TO VALIDATE</span> en su totalidad · decisión
    <b>D9</b>. El esquema ya implementa cuatro roles con el default más restrictivo posible:
    <b>un perfil nuevo no ve nada</b>. Eso es el mínimo razonable, no el modelo definitivo.</p>
    <div class="tbl micro">
    <table>
      <thead><tr><th style="width:22%">Rol</th><th style="width:44%">Podría</th>
        <th style="width:34%">Falta definir</th></tr></thead>
      <tbody>
        <tr><td><b>Operador</b></td><td>Importar, corregir, conciliar, cargar movimientos de su oficina</td>
            <td>¿Ve las otras oficinas?</td></tr>
        <tr><td><b>Supervisor</b></td><td>Todo lo del operador + editar histórico, ajustar cuentas</td>
            <td>¿Aprueba envíos de lote?</td></tr>
        <tr><td><b>Admin</b></td><td>Configuración, usuarios, auditoría completa</td>
            <td>¿Quién puede borrar?</td></tr>
      </tbody>
    </table>
    </div>
    <p class="mini" style="margin-top:2mm;margin-bottom:0">Las tres preguntas de la derecha
    <b>no se inventan</b>.</p>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  38 · Riesgos
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("38", "Riesgos", "Once, ordenados por probabilidad × impacto · sin relleno teórico", """
<div class="tbl compacta">
<table>
  <thead><tr><th style="width:4%"></th><th style="width:25%">Riesgo</th>
    <th style="width:13%" class="c">Impacto</th><th style="width:58%">Mitigación</th></tr></thead>
  <tbody>
    <tr style="background:var(--neg-wash)"><td class="m"><b>1</b></td>
        <td><b>El sistema externo es una caja negra.</b> Si no exporta identificador de
        operación, el matching queda dependiendo de heurísticas</td>
        <td class="c"><span class="blk">ALTO</span><br><span class="mini">corazón de F3</span></td>
        <td><b>N2 es lo primero de la fase 0.</b> Si la respuesta es «no hay
        identificador», el alcance de la fase 3 se replantea <b>antes</b> de empezar</td></tr>
    <tr style="background:var(--neg-wash)"><td class="m"><b>2</b></td>
        <td><b>Calidad de los archivos recibidos.</b> Sin muestras reales, cualquier parser
        es una apuesta</td>
        <td class="c"><span class="blk">ALTO</span><br><span class="mini">invalida F2</span></td>
        <td>3–5 archivos por canal antes de escribir código. Mapeo por cliente para
        absorber la heterogeneidad</td></tr>
    <tr style="background:var(--neg-wash)"><td class="m"><b>3</b></td>
        <td><b>Matching ambiguo a volumen.</b> 600 por día con importes repetidos genera
        muchas sugerencias</td>
        <td class="c"><span class="blk">ALTO</span></td>
        <td>Nunca auto-confirmar sin tupla única. <b>Medir la tasa real antes de prometer
        ahorro</b>: si el operador decide 200 casos por día, no ganó nada</td></tr>
    <tr style="background:var(--neg-wash)"><td class="m"><b>4</b></td>
        <td><b>Adopción.</b> El operador es rápido en Excel. Si la ingesta es más lenta que
        su limpieza manual, no se usa</td>
        <td class="c"><span class="blk">ALTO</span><br><span class="mini">riesgo de producto</span></td>
        <td>Cronómetro en la fase 2, con el protocolo que ya está escrito. <b>Si pierde, se
        rediseña antes de seguir</b></td></tr>
    <tr><td class="m"><b>5</b></td>
        <td><b>Los bloqueantes sin respuesta.</b> N1, N2, N3 — y D1, D2 del lado contable</td>
        <td class="c"><span class="blk">ALTO</span><br><span class="mini">cronograma</span></td>
        <td>Fase 0 dedicada. <b>Ninguna otra fase arranca sin ellas</b></td></tr>
    <tr><td class="m"><b>6</b></td>
        <td><b>Doble trabajo en la transición.</b> Operar los dos sistemas en paralelo
        duplica el esfuerzo del operador</td>
        <td class="c"><span class="hi">MEDIO</span></td>
        <td>La fase 2 entrega valor inmediato —el archivo normalizado— así que el paralelo
        es <b>ganancia neta, no costo puro</b></td></tr>
    <tr><td class="m"><b>7</b></td>
        <td><b>Reglas de negocio no documentadas.</b> Ya pasó: los seis Sheets de cierre,
        el «full pago», el asiento espejo</td>
        <td class="c"><span class="hi">MEDIO</span></td>
        <td>Lo no confirmado se marca <code>TO VALIDATE</code> y <b>no se implementa</b>.
        Ya hay 26 decisiones abiertas registradas</td></tr>
    <tr><td class="m"><b>8</b></td>
        <td><b>Volumen en la interfaz.</b> 15.000 filas por mes rompen cualquier tabla sin
        paginar</td>
        <td class="c"><span class="hi">MEDIO</span></td>
        <td>Paginación por servidor desde el día uno. Riesgo controlado si se respeta</td></tr>
    <tr><td class="m"><b>9</b></td>
        <td><b>Migración del histórico.</b> Los defectos 5 y 6 hacen que el legacy tenga
        saldos mal</td>
        <td class="c"><span class="hi">MEDIO</span></td>
        <td>Herramientas ya construidas y probadas. La estrategia y las tolerancias están
        escritas</td></tr>
    <tr><td class="m"><b>10</b></td>
        <td><b>Datos personales de terceros.</b> Se van a almacenar CUIT y titulares que no
        son clientes de Nordelta</td>
        <td class="c"><span class="hi">MEDIO</span></td>
        <td>La seguridad por fila ya existe. Falta definir <b>retención y acceso a los
        originales</b>: es decisión del cliente, no técnica</td></tr>
    <tr><td class="m"><b>11</b></td>
        <td><b>Los 54 tests de Supabase nunca corrieron</b></td>
        <td class="c"><span class="et et-fus">BAJO</span><br><span class="mini">es una incógnita</span></td>
        <td>Fase 5, contra la instancia real. <code>READY TO TEST</code>, no
        <code>TESTED</code></td></tr>
  </tbody>
</table>
</div>

<div class="aviso no" style="margin-top:2.6mm">
  <p style="margin-bottom:0"><b>Los cuatro riesgos altos comparten una sola mitigación:
  archivos reales antes de escribir código.</b> Es la razón de existir de la fase 0, y es
  lo único que este informe pide con urgencia.</p>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  39 · Próximos pasos
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("39", "Próximos pasos", "Quién hace qué, y qué no vamos a hacer", """
<div class="g3" style="margin-bottom:3.6mm">
  <div class="card wa nada">
    <span class="rot" style="color:var(--warn)">De su lado · esta semana</span>
    <ol class="num" style="margin-top:1.6mm">
      <li><b>Revisar y aprobar o corregir este informe.</b>
        <span class="mini" style="display:block">En particular la arquitectura de
        información de la sección 10 y el alcance del MVP de la 34.</span></li>
      <li><b>Pedirle al cliente los tres bloqueantes de acceso.</b>
        <span class="mini" style="display:block">Excel reales · descargas de «Ingresos y
        créditos» reales · qué es el sistema externo.</span></li>
      <li><b>Agendar la reunión de las tres decisiones</b> — N1, N2, N3 — más D1 y D2 que
        siguen pendientes de la etapa anterior.</li>
      <li><b>Rotar el token de n8n.</b></li>
    </ol>
  </div>

  <div class="card br nada">
    <span class="rot" style="color:var(--brand)">De nuestro lado · apenas se apruebe</span>
    <ol class="num" style="margin-top:1.6mm">
      <li>Analizar las muestras de archivos y <b>documentar el mapeo real de
        columnas</b>.</li>
      <li><b>Fase 1</b>: shell, navegación nueva y Home. Es la única fase que se puede
        arrancar sin esperar nada del cliente.</li>
      <li>Escribir la propuesta de <b>las cuatro migraciones nuevas</b> —archivos SQL— para
        revisión, <b>sin aplicarlas</b>.</li>
    </ol>
  </div>

  <div class="card no nada">
    <span class="rot" style="color:var(--neg)">Lo que no vamos a hacer hasta que se apruebe</span>
    <p style="font-size:10pt;font-weight:680;margin:1.6mm 0 1.4mm">Nada de código de
    aplicación.</p>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Ni una ruta, ni un
    componente, ni una migración, ni un cambio de estilos. El repositorio queda como está
    hasta su aprobación explícita.</p>
  </div>
</div>

<div class="g23">
  <div class="card ok nada">
    <span class="rot" style="color:var(--pos)">Confirmación de alcance de este informe</span>
    <p style="font-family:var(--mono);font-size:11pt;font-weight:700;color:var(--pos);margin:1.6mm 0 2mm">
    APP CODE MODIFIED: NO</p>
    <p class="mini" style="color:var(--ink-2);margin-bottom:1.4mm">Verificado contra el
    árbol de trabajo. No se tocó: frontend, backend, rutas, componentes, estilos, lógica
    financiera, capa de datos, tests, fixtures, migraciones, configuración de Supabase ni
    configuración productiva.</p>
    <p class="mini" style="color:var(--ink-2);margin-bottom:1.4mm">Las cuatro compuertas
    siguen verdes: <b>273 tests</b>, <code>tsc</code> limpio, <code>eslint</code> limpio,
    <code>build</code> compila 11 rutas.</p>
    <p class="mini" style="color:var(--ink-2);margin-bottom:0">Se ejecutó
    <code>npm run build</code> y <code>npx next start</code> para tomar las capturas: eso
    escribe en <code>.next/</code>, que es salida de compilación y está ignorado por git.</p>
  </div>

  <div class="nada">
    <h3>Archivos agregados al repositorio</h3>
    <div class="tbl">
    <table>
      <thead><tr><th style="width:52%">Archivo</th><th style="width:48%">Qué es</th></tr></thead>
      <tbody>
        <tr><td class="m">docs/NORDELTA_APP_STRUCTURE_REPORT.md</td>
            <td>Fuente editable del informe</td></tr>
        <tr><td class="m">docs/NORDELTA_APP_STRUCTURE_REPORT.pdf</td>
            <td>Este documento</td></tr>
        <tr><td class="m">docs/NORDELTA_APP_STRUCTURE_REPORT.html</td>
            <td>HTML autocontenido del que se imprime el PDF</td></tr>
        <tr><td class="m">scripts/armar_informe_estructura.py</td>
            <td>Generador · tooling exclusivo del informe</td></tr>
      </tbody>
    </table>
    </div>
    <p class="mini" style="margin-top:2.4mm;margin-bottom:0"><b>Cuatro archivos, todos de
    documentación o de su tooling.</b> Ninguno se importa desde la aplicación ni participa
    del build.</p>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  40 · Anexo · Matriz de pantallas
# ═════════════════════════════════════════════════════════════════════════
_PANT = [
    ("Portada", "Comunicar qué es el sistema", "Cualquiera", "Ninguno real", "Ingresar", "keep", "EXISTE — MANTENER"),
    ("Ingreso", "Entrar", "Todos", "Sesión", "Ingresar", "keep", "EXISTE — MANTENER"),
    ("Inicio", "¿Dónde está trabado el trabajo?", "Operador, supervisor", "Pipeline del día, conciliación, clientes", "Conciliar", "red", "EXISTE — REDISEÑAR"),
    ("Acreditaciones", "¿Qué me mandaron y qué está listo?", "Operador", "Transferencias con estado", "Exportar normalizado", "new", "NUEVA"),
    ("Importar archivo", "Convertir un Excel en transferencias válidas", "Operador", "Archivo, mapeo, errores", "Confirmar", "new", "NUEVA"),
    ("Lote", "¿Qué pasó con este archivo?", "Operador", "Filas crudas y normalizadas", "Corregir", "new", "NUEVA"),
    ("Conciliación", "¿Qué envié y qué se acreditó?", "Operador", "Enviadas, acreditaciones, señales", "Confirmar match", "new", "NUEVA"),
    ("Importar créditos", "Traer lo que acreditó el banco", "Operador", "Archivo del sistema externo", "Confirmar", "new", "NUEVA"),
    ("Carga", "Registrar lo que no vino en archivo", "Operador", "Movimientos del día", "Guardar", "keep", "EXISTE — MANTENER"),
    ("Cuentas", "¿Cuánto nos debe cada uno?", "Supervisor", "Saldo por contraparte y moneda", "Abrir cliente", "keep", "EXISTE — MANTENER"),
    ("Cliente", "¿Qué pasó con este cliente?", "Operador, supervisor", "Operativo + contable", "Según pestaña", "fus", "EXISTE — FUSIONAR"),
    ("Cuenta corriente", "¿Qué movimientos movieron el saldo?", "Supervisor", "Libro con saldo corrido", "Ver partidas", "keep", "EXISTE — MANTENER"),
    ("Balance", "¿Cuánto hay, por moneda?", "Supervisor, administración", "Totales por moneda", "Exportar", "keep", "EXISTE — MANTENER"),
    ("Ajustar a cero", "Cerrar una cuenta", "Supervisor", "Saldo, ajuste, resultante", "Registrar ajuste", "fus", "EXISTE — FUSIONAR"),
    ("Auditoría", "¿Quién cambió qué?", "Admin, supervisor", "Registro de solo agregado", "Ver el cambio", "red", "EXISTE — EXTENDER"),
    ("Configuración", "Mapeos, usuarios, tolerancias", "Admin", "Configuración", "Guardar", "new", "NUEVA"),
    ("Ajustes · ruta propia", "—", "—", "—", "—", "del", "ELIMINAR del menú"),
]
_filas_pant = "".join(
    f'<tr><td><b>{n}</b></td><td>{o}</td><td class="mini">{u}</td><td class="mini">{d}</td>'
    f'<td class="mini">{a}</td><td class="c"><span class="et {_ET[k]}">{e}</span></td></tr>'
    for n, o, u, d, a, k, e in _PANT
)

pagina(hoja("40", "Anexo · Matriz de pantallas", "Diecisiete pantallas · objetivo, usuario, datos, acción, estado", f"""
<div class="tbl zebra compacta">
<table>
  <thead><tr><th style="width:14%">Pantalla</th><th style="width:23%">Objetivo</th>
    <th style="width:14%">Usuario</th><th style="width:20%">Datos</th>
    <th style="width:13%">Acción primaria</th><th style="width:16%" class="c">Estado</th></tr></thead>
  <tbody>{_filas_pant}</tbody>
</table>
</div>

<div class="g2" style="margin-top:3.6mm">
  <div class="aviso ok nada">
    <p style="margin-bottom:0"><b>Ninguna pantalla existente se elimina.</b> Lo único que
    desaparece es la <b>entrada de menú</b> de Ajustes, cuya funcionalidad se conserva
    completa dentro del cliente.</p>
  </div>
  <div class="g4" style="gap:2.6mm">
    <div class="card ok nada" style="text-align:center;padding:2.4mm">
      <div class="med" style="color:var(--pos)">7</div>
      <p class="mini" style="color:var(--ink-2);margin:.8mm 0 0;font-size:6.8pt">mantener</p></div>
    <div class="card br nada" style="text-align:center;padding:2.4mm">
      <div class="med" style="color:var(--brand)">6</div>
      <p class="mini" style="color:var(--ink-2);margin:.8mm 0 0;font-size:6.8pt">nuevas</p></div>
    <div class="card wa nada" style="text-align:center;padding:2.4mm">
      <div class="med" style="color:var(--warn)">2</div>
      <p class="mini" style="color:var(--ink-2);margin:.8mm 0 0;font-size:6.8pt">rediseñar</p></div>
    <div class="card pl nada" style="text-align:center;padding:2.4mm">
      <div class="med" style="color:var(--ink-2)">2</div>
      <p class="mini" style="color:var(--ink-2);margin:.8mm 0 0;font-size:6.8pt">fusionar</p></div>
  </div>
</div>"""))

# ═════════════════════════════════════════════════════════════════════════
#  41 · Anexo · Principios de UX
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("41", "Anexo · Principios de UX y dirección visual", "Diez principios que deberían guiar la implementación", """
<div class="g23">
  <div class="nada">
    <ol class="num">
      <li><b>Velocidad de Excel, control de sistema.</b>
        <span class="mini" style="display:block">Teclado primero. Si una tarea frecuente
        necesita el mouse, está mal diseñada.</span></li>
      <li><b>Los errores se ven antes de procesar, no después.</b>
        <span class="mini" style="display:block">Validar en el preview, no al confirmar.</span></li>
      <li><b>Ningún dato desaparece en silencio.</b>
        <span class="mini" style="display:block">Lo que no se pudo interpretar queda
        visible, contado y sin aplicar.</span></li>
      <li><b>Un match dudoso es una sugerencia, nunca una decisión.</b>
        <span class="mini" style="display:block">Vale para el CUIT y para la
        conciliación.</span></li>
      <li style="background:var(--brand-wash);border-radius:1.8mm;padding-top:1.2mm;padding-bottom:1.2mm;padding-right:2mm">
        <b>El estado vive en el dato, no en el color de la celda.</b>
        <span class="mini" style="display:block">Es el principio que ordena todo el
        proyecto: reemplaza el sistema de colores, filtros y marcas por estados
        consultables y auditables.</span></li>
      <li><b>En cada pantalla se sabe qué falta hacer</b>, sin filtrar ni sumar a mano.</li>
      <li><b>Las monedas no se suman entre sí. Nunca.</b></li>
      <li><b>Toda decisión humana queda registrada con su evidencia</b>, no sólo con su
        autor.</li>
      <li><b>El cero real y el dato ausente se distinguen.</b>
        <span class="mini" style="display:block"><code>0,00</code> y <code>—</code> no
        significan lo mismo.</span></li>
      <li><b>Una pantalla, una pregunta.</b>
        <span class="mini" style="display:block">Si una pantalla necesita un selector de
        modo para responder dos preguntas, son dos pantallas.</span></li>
    </ol>
  </div>

  <div class="nada">
    <h3>Dirección visual</h3>
    <p class="mini">El sistema ya está construido y consolidado. Esta etapa lo usa,
    <b>no lo reinventa</b>.</p>
    <div class="tbl" style="margin-bottom:3mm">
    <table>
      <tbody>
        <tr><td style="width:26%"><b>Paleta</b></td>
            <td>Azul y blanco. El azul es identidad y se reserva para la acción, el estado
            activo y el dato calculado. <b>Nunca decora</b></td></tr>
        <tr><td><b>Neutrales</b></td>
            <td>Con sesgo azulado apenas perceptible: un gris puro al lado de este azul se
            lee sucio</td></tr>
        <tr><td><b>Semánticos</b></td>
            <td>Verde, rojo y ámbar, separados del azul a propósito</td></tr>
        <tr><td><b>Tipografía</b></td>
            <td>Siete niveles y ni uno más. Números siempre tabulares, formato argentino</td></tr>
        <tr><td><b>Densidad</b></td>
            <td>Alta donde hay muchas filas —bandeja, conciliación, grilla— y aireada donde
            hay una decisión</td></tr>
        <tr><td><b>Jerarquía</b></td>
            <td>La hace el borde, no la sombra. La elevación es casi imperceptible</td></tr>
        <tr><td><b>Estado</b></td>
            <td>Punto de color más texto, no píldora rellena: una tabla llena de píldoras
            compite con los números</td></tr>
        <tr><td><b>Referencias</b></td>
            <td>Stripe, Linear, Ramp, Mercury. <b>Como vara de calidad, no para copiar</b></td></tr>
      </tbody>
    </table>
    </div>

    <div class="card no nada">
      <span class="rot" style="color:var(--neg)">Lo que no</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 0">Plantilla SaaS genérica ·
      glassmorphism · degradados de adorno · tableros llenos de gráficos · tarjetas que no
      aportan · diseño infantil · y cualquier gráfico que no responda mejor que una cifra
      con su etiqueta.</p>
    </div>
  </div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  Render
# ═════════════════════════════════════════════════════════════════════════

HTML = (
    '<!doctype html>\n<html lang="es"><head><meta charset="utf-8">\n'
    "<title>Nordelta · Propuesta de arquitectura de producto</title>\n"
    f"<style>{CSS}</style>\n</head><body>\n" + "\n".join(PAGINAS) + "\n</body></html>\n"
)

SALIDA_HTML.write_text(HTML)
print(f"html  {SALIDA_HTML.relative_to(RAIZ)}  ({SALIDA_HTML.stat().st_size / 1e6:.1f} MB)")

subprocess.run(
    [
        CHROME, "--headless", "--disable-gpu", "--no-sandbox",
        "--no-pdf-header-footer", f"--print-to-pdf={SALIDA_PDF}",
        "--virtual-time-budget=30000", SALIDA_HTML.as_uri(),
    ],
    check=True, capture_output=True,
)
print(f"pdf   {SALIDA_PDF.relative_to(RAIZ)}  ({SALIDA_PDF.stat().st_size / 1e6:.1f} MB)"
      f"  ·  {len(PAGINAS)} secciones")

# Copia en la carpeta de entregables, al lado del repositorio, para que los
# PDF se encuentren sin entrar a docs/.
copia = RAIZ.parent / "pdfs" / "2026-09-07 · Nordelta · Arquitectura de producto.pdf"
if copia.parent.is_dir():
    copia.write_bytes(SALIDA_PDF.read_bytes())
    print(f"copia {copia}")
