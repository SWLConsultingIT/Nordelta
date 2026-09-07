#!/usr/bin/env python3
"""Sistema visual compartido por los informes en PDF.

Los dos generadores —el informe completo y el resumen— usan los mismos
tokens, la misma escala tipográfica y los mismos wireframes, para que el
documento se parezca al producto del que habla.

No se usa desde la aplicación: es tooling de documentación.
"""
import base64
import pathlib
import sys


def hacer_captura(directorio: pathlib.Path):
    """Devuelve la función `captura` ligada a un directorio de capturas.

    Se toman contra el build de producción (`npx next start`), no contra el
    servidor de desarrollo: ese dibuja su propio indicador en la esquina.
    """

    def img(nombre: str) -> str:
        ruta = directorio / f"{nombre}.png"
        if not ruta.exists():
            sys.exit(f"falta la captura {ruta}")
        return "data:image/png;base64," + base64.b64encode(ruta.read_bytes()).decode()

    def captura(nombre, titulo, pie="", alto=None):
        """`alto` en píxeles fija la altura y libera el ancho: mantiene la
        proporción, y es lo único que permite que una captura muy alta entre
        en una página horizontal."""
        estilo = f' style="height:{alto}px;width:auto;margin:0 auto"' if alto else ""
        return f"""<figure class="cap">
      <img src="{img(nombre)}" alt="{titulo}"{estilo}>
      <figcaption><b>{titulo}</b>{(" " + pie) if pie else ""}</figcaption>
    </figure>"""

    return captura


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
.hoja { page-break-after:always; position:relative; min-height:184mm; }
.hoja:last-child { page-break-after:auto; }

/* El pie va absoluto contra el fondo de la página, y por eso `.hoja` tiene
   `min-height`: sin eso quedaría pegado al final del contenido. */
.folio { position:absolute; left:0; right:0; bottom:0; display:flex;
         align-items:baseline; gap:2mm; padding-top:1.4mm;
         border-top:.6pt solid var(--line-soft); }
.folio span { font-family:var(--mono); font-size:6pt; letter-spacing:.12em;
              text-transform:uppercase; color:var(--ink-4); }
.folio .n { margin-left:auto; color:var(--ink-3); font-weight:600; }

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



def documento(titulo: str, paginas: list[str], pie: str = "", sin_folio=(0,)) -> str:
    """Arma el HTML e inyecta el pie con la numeración.

    `sin_folio` son los índices que no lo llevan — la portada, donde un pie
    sobre el navy quedaría fuera de lugar.
    """
    total = len(paginas)
    numeradas = []
    for i, p in enumerate(paginas):
        if i not in sin_folio:
            folio = (
                f'<div class="folio"><span>{pie or titulo}</span>'
                f'<span class="n">{i + 1} / {total}</span></div>'
            )
            p = p.replace("</section>", folio + "</section>")
        numeradas.append(p)
    return (
        '<!doctype html>\n<html lang="es"><head><meta charset="utf-8">\n'
        f"<title>{titulo}</title>\n"
        f"<style>{CSS}</style>\n</head><body>\n" + "\n".join(numeradas) + "\n</body></html>\n"
    )
