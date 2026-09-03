#!/usr/bin/env python3
"""Arma el informe del pase de producto como un HTML autocontenido.

Las capturas van embebidas en base64 para que Chrome no dependa de rutas
relativas al imprimir, y para que el HTML se pueda mover solo.
"""
import base64
import pathlib
import subprocess

BASE = pathlib.Path(__file__).parent
IMG = BASE / "informe"
SALIDA_HTML = BASE / "informe.html"


def img(nombre: str) -> str:
    datos = (IMG / f"{nombre}.png").read_bytes()
    return "data:image/png;base64," + base64.b64encode(datos).decode()


def captura(nombre, titulo, pie, alto=None) -> str:
    """`alto` en píxeles fija la altura y deja el ancho libre: mantiene la
    proporción y es lo único que permite que una captura muy alta entre en
    una página horizontal."""
    estilo = f' style="height:{alto}px;width:auto;margin:0 auto"' if alto else ""
    return f"""
    <figure class="cap">
      <img src="{img(nombre)}" alt="{titulo}"{estilo}>
      <figcaption><span class="cap-t">{titulo}</span> {pie}</figcaption>
    </figure>"""


CSS = """
@page { size: A4 landscape; margin: 13mm 14mm; }

:root {
  --ground:#F4F6FB; --surface:#FFFFFF; --raised:#F8FAFD; --sunken:#EFF3F9;
  --navy:#0A1930; --navy-3:#1A3357;
  --brand:#1D5AD0; --brand-lo:#164AAE; --brand-wash:#EAF1FE; --brand-line:#C0D6F9;
  --line:#E2E8F1; --line-soft:#EDF1F7;
  --ink:#0B1727; --ink-2:#3E4F66; --ink-3:#71849C; --ink-4:#9BAABD;
  --pos:#0C7550; --pos-wash:#E3F3EC; --pos-line:#A9DBC5;
  --neg:#B02318; --neg-wash:#FBEBE9; --neg-line:#F0C0BA;
  --warn:#9A6408; --warn-wash:#FCF2E0;
  --sans:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;
  --mono:"SF Mono",Menlo,Consolas,monospace;
}

* { box-sizing:border-box; }
html,body { margin:0; padding:0; }
body {
  font-family:var(--sans); color:var(--ink); font-size:9.4pt; line-height:1.5;
  -webkit-font-smoothing:antialiased; background:var(--surface);
}

.hoja { page-break-after:always; }
.hoja:last-child { page-break-after:auto; }

/* ── Tipografía ─────────────────────────────────────────── */
h1 { font-size:27pt; font-weight:700; letter-spacing:-.03em; line-height:1.05; margin:0; }
h2 { font-size:15pt; font-weight:680; letter-spacing:-.02em; margin:0 0 2mm; }
h3 { font-size:10.5pt; font-weight:660; letter-spacing:-.012em; margin:0 0 1.2mm; }
p  { margin:0 0 2.4mm; }
b, strong { font-weight:640; }
code { font-family:var(--mono); font-size:8.2pt; background:var(--brand-wash);
       color:var(--brand-lo); padding:.3mm 1mm; border-radius:1mm; }

.rotulo {
  font-family:var(--mono); font-size:6.6pt; font-weight:500; letter-spacing:.14em;
  text-transform:uppercase; color:var(--ink-3);
}
.sec {
  display:flex; align-items:baseline; gap:3mm;
  border-bottom:1.6pt solid var(--ink); padding-bottom:1.6mm; margin-bottom:4mm;
}
.sec .letra {
  font-family:var(--mono); font-size:13pt; font-weight:700; color:var(--brand);
  line-height:1;
}
.sec p { margin:0; color:var(--ink-3); font-size:8.6pt; margin-left:auto; }

.dos { column-count:2; column-gap:9mm; }
.tres { display:grid; grid-template-columns:repeat(3,1fr); gap:5mm; }
.nada-abajo > *:last-child { margin-bottom:0; }

/* ── Portada ────────────────────────────────────────────── */
.tapa {
  height:181mm; display:flex; flex-direction:column;
  background:var(--navy); color:#F1F6FF; margin:-13mm -14mm; padding:16mm 18mm;
  position:relative; overflow:hidden;
}
.tapa .glow {
  position:absolute; top:-70mm; right:-40mm; width:170mm; height:170mm;
  border-radius:50%; background:rgba(29,90,208,.34); filter:blur(34mm);
}
.tapa .malla {
  position:absolute; inset:0; opacity:.08;
  background-image:linear-gradient(#E2E8F1 1px,transparent 1px),
                   linear-gradient(90deg,#E2E8F1 1px,transparent 1px);
  background-size:13mm 13mm;
}
.tapa > * { position:relative; }
.marca { display:flex; align-items:center; gap:2.6mm; }
.logo {
  width:9mm; height:9mm; border-radius:2.4mm; display:grid; place-items:center;
  font-family:var(--mono); font-weight:700; font-size:12pt; color:#fff;
  background:linear-gradient(135deg,#2C77F5,#1D5AD0);
}
.tapa h1 { color:#fff; font-size:33pt; max-width:150mm; }
.tapa .sub { font-size:12pt; color:#90A8C8; max-width:135mm; margin-top:5mm; line-height:1.45; }
.tapa .pie { margin-top:auto; display:flex; align-items:flex-end; gap:10mm; }
.tapa .rotulo { color:#5A749A; }

.cifras { display:flex; gap:11mm; }
.cifra .n { font-family:var(--mono); font-size:19pt; font-weight:600; color:#fff; line-height:1; }
.cifra .r { font-size:7.6pt; color:#8AA2C2; margin-top:1.4mm; }

/* ── Bloques ────────────────────────────────────────────── */
.tarjeta {
  border:.8pt solid var(--line); border-radius:3mm; background:var(--surface);
  padding:4mm; break-inside:avoid;
}
.tarjeta.plano { background:var(--raised); }
.tarjeta .rotulo { display:block; margin-bottom:1.6mm; }

table { width:100%; border-collapse:collapse; font-size:8.4pt; }
th {
  text-align:left; font-family:var(--mono); font-size:6.4pt; font-weight:500;
  letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3);
  border-bottom:.8pt solid var(--line); padding:1.4mm 2mm; background:var(--raised);
}
td { padding:1.5mm 2mm; border-bottom:.6pt solid var(--line-soft); vertical-align:top; }
tr:last-child td { border-bottom:0; }
td.mono { font-family:var(--mono); font-size:7.6pt; color:var(--ink-2); white-space:nowrap; }
.tbl { border:.8pt solid var(--line); border-radius:3mm; overflow:hidden; }

/* ── Capturas ───────────────────────────────────────────── */
.cap { margin:0 0 3mm; break-inside:avoid; }
.cap img {
  display:block; width:100%; border:.8pt solid var(--line); border-radius:2.4mm;
  box-shadow:0 1.4mm 4mm -1.4mm rgba(11,23,39,.18);
}
.cap figcaption { font-size:7.8pt; color:var(--ink-3); margin-top:1.8mm; line-height:1.42; }
.cap-t { color:var(--ink); font-weight:640; }
.par { display:grid; grid-template-columns:1fr 1fr; gap:5mm; }

/* ── Listas de hallazgos ────────────────────────────────── */
ol.hall { margin:0; padding:0; list-style:none; counter-reset:h; }
ol.hall > li {
  counter-increment:h; padding-left:8mm; position:relative;
  margin-bottom:5mm; break-inside:avoid;
}
ol.hall > li::before {
  content:counter(h); position:absolute; left:0; top:.2mm;
  width:5.2mm; height:5.2mm; border-radius:50%;
  background:var(--brand-wash); color:var(--brand); border:.6pt solid var(--brand-line);
  font-family:var(--mono); font-size:7pt; font-weight:600;
  display:grid; place-items:center;
}
ol.hall .q { display:block; color:var(--ink-2); }
ol.hall .f { display:block; color:var(--pos); font-weight:600; margin-top:.4mm; }
ol.hall .f::before { content:"→ "; }

ul.pl { margin:0 0 2.4mm; padding-left:4.4mm; }
ul.pl li { margin-bottom:1.2mm; }

/* ── Estado ─────────────────────────────────────────────── */
.chip {
  display:inline-flex; align-items:center; gap:1.4mm; font-size:8pt; font-weight:600;
  padding:1mm 2.4mm; border-radius:9mm; border:.7pt solid;
}
.chip .pt { width:1.5mm; height:1.5mm; border-radius:50%; }
.ok  { color:var(--pos); background:var(--pos-wash); border-color:var(--pos-line); }
.ok .pt { background:var(--pos); }
.pend { color:var(--warn); background:var(--warn-wash); border-color:#EBD3A0; }
.pend .pt { background:var(--warn); }

.gates { display:grid; grid-template-columns:repeat(4,1fr); gap:4mm; margin-bottom:4mm; }
.gate {
  border:.8pt solid var(--line); border-radius:3mm; padding:3.4mm; text-align:center;
  background:var(--raised);
}
.gate .n { font-family:var(--mono); font-size:15pt; font-weight:600; line-height:1; }
.gate .r { font-size:7.4pt; color:var(--ink-3); margin-top:1.4mm; }

.aviso {
  border-left:2.2pt solid var(--brand); background:var(--brand-wash);
  padding:3mm 4mm; border-radius:0 2.4mm 2.4mm 0; break-inside:avoid;
}
.aviso.n { border-color:var(--neg); background:var(--neg-wash); }
.aviso p:last-child { margin-bottom:0; }

"""


TAPA = """
<section class="hoja">
  <div class="tapa">
    <div class="glow"></div><div class="malla"></div>
    <div class="marca"><span class="logo">N</span>
      <span style="font-size:12pt;font-weight:640;letter-spacing:-.02em">Nordelta</span>
    </div>
    <div style="margin-top:auto">
      <span class="rotulo">Informe de cierre · Pase de experiencia de producto</span>
      <h1>MVP Next Level</h1>
      <p class="sub">Consolidación del sistema de diseño y reescritura de las nueve
      pantallas sobre él, sin tocar reglas financieras, migraciones, seguridad por
      fila, importador ni tests de dominio.</p>
    </div>
    <div class="pie">
      <div class="cifras">
        <div class="cifra"><div class="n">9</div><div class="r">pantallas reescritas</div></div>
        <div class="cifra"><div class="n">273</div><div class="r">tests en verde</div></div>
        <div class="cifra"><div class="n">3</div><div class="r">resoluciones verificadas</div></div>
        <div class="cifra"><div class="n">0</div><div class="r">reglas financieras tocadas</div></div>
      </div>
      <div style="margin-left:auto;text-align:right">
        <div class="rotulo">3 de septiembre de 2026</div>
        <div class="rotulo" style="margin-top:1.4mm">SWL Consulting</div>
      </div>
    </div>
  </div>
</section>"""


def hoja(letra, titulo, nota, cuerpo):
    return f"""
<section class="hoja">
  <div class="sec">
    <span class="letra">{letra}</span>
    <h2 style="margin:0">{titulo}</h2>
    <p>{nota}</p>
  </div>
  {cuerpo}
</section>"""


A = hoja("A", "Sistema de diseño consolidado", "Se consolidó antes de tocar las pantallas", """
<p style="max-width:214mm;margin-bottom:1.6mm">Antes había tokens sueltos, dos convenciones
de tipografía y componentes que cada pantalla adaptaba a mano. Ahora hay un solo sistema, y los
neutrales llevan un sesgo azulado apenas perceptible: un gris puro al lado de este azul se lee sucio.</p>

<div class="par" style="margin-top:3mm">
  <div>
    <div class="tbl">
      <table>
        <thead><tr><th>Grupo</th><th>Tokens</th><th>Para qué</th></tr></thead>
        <tbody>
          <tr><td>Superficies</td><td class="mono">ground · surface<br>raised · sunken</td>
              <td>fondo, tarjeta, encabezado de tabla, celda calculada</td></tr>
          <tr><td>Azul estructural</td><td class="mono">navy · navy-2..4</td>
              <td>riel y paneles oscuros</td></tr>
          <tr><td>Azul de acción</td><td class="mono">brand · brand-hi<br>brand-lo · -wash · -line</td>
              <td>acción, estado activo, dato convertido</td></tr>
          <tr><td>Líneas</td><td class="mono">line · line-soft<br>line-hard</td>
              <td>la jerarquía la hace el borde, no la sombra</td></tr>
          <tr><td>Tinta</td><td class="mono">ink · ink-2..4<br>on-navy · on-navy-2..3</td>
              <td>cuatro niveles de texto</td></tr>
          <tr><td>Semánticos</td><td class="mono">pos · neg · warn<br>(+ -wash, -line)</td>
              <td>separados del azul a propósito</td></tr>
          <tr><td>Elevación</td><td class="mono">shadow-e1..e4</td>
              <td>casi imperceptible</td></tr>
        </tbody>
      </table>
    </div>
    <p style="font-size:7.8pt;color:var(--ink-3);margin-top:2mm">Cada token tiene su
    variante oscura definida.</p>
  </div>

  <div>
    <div class="tarjeta plano" style="margin-bottom:4mm">
      <span class="rotulo">Escala tipográfica</span>
      <p style="margin-bottom:1.6mm">Siete niveles como <code>@utility</code>, y ni uno más.
      Si algo no entra en ninguno, sobra.</p>
      <p class="mono" style="font-family:var(--mono);font-size:7.6pt;color:var(--ink-2);margin:0">
      t-page · t-section · t-body · t-secondary · t-label · t-th · t-num</p>
      <p style="margin:1.6mm 0 0;font-size:8.2pt;color:var(--ink-3)">Los números van siempre
      tabulares: son el contenido de esta aplicación.</p>
    </div>

    <h3>Decisiones que se tomaron una vez</h3>
    <ul class="pl">
      <li><b>Estado en lugar de píldora.</b> Punto de color más texto. Una tabla llena de
      píldoras rellenas compite con los números.</li>
      <li><b>Monto con símbolo atenuado</b> y decimales en segundo plano: el ojo va al
      entero, que es lo que se compara.</li>
      <li><b>Guion tenue en lugar de 0,00.</b> No es lo mismo «no hay saldo» que «el saldo
      es cero».</li>
      <li><b>Tira de saldos</b>: una superficie con una columna por moneda, en lugar de
      cuatro tarjetas sueltas.</li>
      <li><b>Toda tabla ancha scrollea dentro de su contenedor.</b> El cuerpo de la página
      nunca scrollea de costado.</li>
    </ul>

    <div class="tarjeta" style="margin-top:2mm">
      <span class="rotulo">Componentes</span>
      <p style="margin:0;font-size:8.2pt;color:var(--ink-2)">Button · Card · CardBar ·
      CardFoot · PageHeader · Estado · Badge · Field · Input · Select · Buscador ·
      FilterTabs · Toggle · Monto · SinValor · TiraDeSaldos · Vacio · Panel · Dato ·
      TablaShell · Th · ProveedorDeAvisos</p>
    </div>
  </div>
</div>

<div class="tres" style="margin-top:1.8mm">
  <div class="tarjeta" style="padding:3mm">
    <span class="rotulo">Antes → ahora</span>
    <h3 style="font-size:9.6pt">Dos convenciones de tipografía</h3>
    <p style="margin:0;font-size:8.4pt;color:var(--ink-2)">Conviv&iacute;an
    <code>label-mono</code> y clases ad hoc por pantalla. Ahora hay siete niveles y ninguna
    pantalla define tama&ntilde;os propios.</p>
  </div>
  <div class="tarjeta" style="padding:3mm">
    <span class="rotulo">Antes → ahora</span>
    <h3 style="font-size:9.6pt">Cuatro tarjetas de saldo</h3>
    <p style="margin:0;font-size:8.4pt;color:var(--ink-2)">Cada moneda ten&iacute;a su
    tarjeta, con borde y sombra. Ahora es una sola superficie de cuatro columnas: ocupa
    menos y se compara de un barrido.</p>
  </div>
  <div class="tarjeta" style="padding:3mm">
    <span class="rotulo">Antes → ahora</span>
    <h3 style="font-size:9.6pt">P&iacute;ldoras rellenas en las tablas</h3>
    <p style="margin:0;font-size:8.4pt;color:var(--ink-2)">Compet&iacute;an con los
    n&uacute;meros, que son el contenido real. Ahora el estado es un punto de color m&aacute;s
    texto; la p&iacute;ldora se reserva para lo que debe destacar.</p>
  </div>
</div>""")


B = hoja("B", "Portada", "Reescrita completa", f"""
<div style="display:grid;grid-template-columns:366px 1fr;gap:8mm;align-items:start">
  <div>
    {captura("portada", "La portada entera",
             "Encabezado, hero, tres pilares, sección de producto, cierre y pie.", alto=588)}
  </div>
  <div class="nada-abajo">
    <h3>El producto, no una maqueta</h3>
    <p>Las dos vistas de la portada se componen con los <b>mismos tokens, la misma escala
    tipográfica y el mismo componente de monto</b> que la aplicación. No son rectángulos
    dibujados: lo que se ve en la portada es lo que se ve al entrar.</p>

    <div class="aviso" style="margin:3mm 0">
      <p><b>Restricción respetada.</b> La portada es una página sin autenticación y no
      muestra ningún dato real. Los datos de las vistas son los sintéticos del modo
      demostración, y están rotulados como tales.</p>
    </div>

    <h3>Los tres pilares</h3>
    <p style="margin-bottom:1.4mm">No son beneficios genéricos: son las tres limitaciones
    del sistema actual, resueltas de raíz.</p>
    <ul class="pl">
      <li><b>Se carga como el Excel.</b> Tab, Enter, Ctrl+Z y pegado de un bloque.</li>
      <li><b>El saldo no se guarda: se calcula.</b> No hay un número escrito en una celda
      que pueda quedar viejo o pisado.</li>
      <li><b>Todo cambio queda registrado.</b> Registro de solo agregado.</li>
    </ul>

    {captura("portada-hero", "El hero en pantalla",
             "La vista del producto sangra a la derecha; el rótulo aclara que los datos son de demostración.")}
  </div>
</div>""")


C = hoja("C", "Ingreso y centro de operaciones", "Dos pantallas reescritas", f"""
<div class="par">
  <div class="nada-abajo">
    {captura("ingreso", "Ingreso",
             "Dos paneles: formulario a la izquierda, identidad sobre navy a la derecha. En pantalla angosta el panel oscuro desaparece — es acompañamiento, no contenido.")}
    <div class="tarjeta plano">
      <span class="rotulo">Qué cambió</span>
      <p style="margin:0;font-size:8.4pt">Antes era una tarjeta centrada sin identidad. La
      retícula del panel oscuro se bajó de .14 a .06 de opacidad: tapaba el contenido.</p>
    </div>
  </div>
  <div class="nada-abajo">
    {captura("inicio", "Inicio",
             "El neto del día por moneda primero, con ingresos y pagos de apoyo; después actividad reciente, lo que requiere atención y los accesos.")}
    <div class="tarjeta plano">
      <span class="rotulo">Criterio</span>
      <p style="margin:0;font-size:8.4pt">Responde una sola pregunta: qué está pasando hoy.
      Un tablero lleno de indicadores no ayuda a operar. Las monedas que no se movieron no
      ocupan lugar.</p>
    </div>
  </div>
</div>""")


D = hoja("D", "Carga de movimientos", "Acá estaba el peor problema", f"""
{captura("carga-1440", "Carga a 1440 × 900",
         "Barra de herramientas propia con filtros y Deshacer / Nueva fila / Guardar. Dos pies: conteo y estado, y totales por moneda. La columna de impacto entra completa.", alto=428)}

<div class="par" style="margin-top:1mm">
  <div class="aviso n nada-abajo">
    <p><b>La grilla cortaba la columna de impacto.</b> Era el peor problema del MVP: el
    impacto es el dato que le dice al operador si cargó bien. Las columnas sumaban
    ~1270 px sobre ~1156 disponibles.</p>
    <p style="color:var(--pos);font-weight:600">→ Anchos recalculados, contraparte y detalle
    reparten el espacio libre, y el impacto queda fijado a la derecha: no depende del ancho
    de la pantalla.</p>
  </div>
  <div class="nada-abajo">
    <h3>Dos correcciones que no eran visuales</h3>
    <p style="font-size:8.4pt"><b>La grilla prometía impacto donde no lo hay.</b> Un
    movimiento de categoría impuesto, compra o venta mostraba un importe en la columna de
    impacto y se sumaba al total del día, cuando por definición no impacta la cuenta
    corriente. Ahora dice <code>no impacta</code> y queda fuera del total — se ve en la
    fila 2. No se cambió ninguna regla: se dejó de mostrar un número que la regla ya decía
    que no aplica.</p>
    <p style="font-size:8.4pt;margin-bottom:0"><b>El bloque de usuario del riel se
    superponía</b> con la navegación. Resuelto con una grilla de tres filas en el riel.</p>
  </div>
</div>""")


E = hoja("E", "La grilla a 1280", "La notebook más chica del cliente", f"""
{captura("carga-1280", "Carga a 1280 × 800",
         "Contraparte y detalle caen a su ancho mínimo; el resto entra igual. Sin scroll horizontal y con la columna de impacto completa.", alto=418)}

<div class="tres" style="margin-top:2mm">
  <div class="tarjeta plano">
    <span class="rotulo">1440 × 900</span>
    <p style="margin:0;font-size:8.4pt">Las nueve pantallas revisadas. Contraparte y detalle
    sin truncar.</p>
  </div>
  <div class="tarjeta plano">
    <span class="rotulo">1366 × 768</span>
    <p style="margin:0;font-size:8.4pt">Grilla completa sin scroll horizontal.</p>
  </div>
  <div class="tarjeta plano">
    <span class="rotulo">1280 × 800</span>
    <p style="margin:0;font-size:8.4pt">Grilla completa. El padding del contenedor baja a
    16 px por debajo de <code>sm</code>.</p>
  </div>
</div>

<p style="margin-top:4mm;max-width:214mm;font-size:8.6pt;color:var(--ink-3)">Cada pantalla
se abrió en Chrome headless y se miró la captura. Ninguna se declaró terminada sin verla
renderizada. Las nueve rutas responden 200 y el log del servidor no tiene errores ni
advertencias.</p>
<p style="max-width:214mm;font-size:8.6pt;color:var(--ink-3)">Las capturas de este informe se
tomaron contra el build de producción, no contra el servidor de desarrollo: ese dibuja su propio
indicador en la esquina y no corresponde que salga acá.</p>""")


F = hoja("F", "Consultas", "Cuentas y balance", f"""
<div class="par">
  <div class="nada-abajo">
    {captura("cuentas", "Cuentas corrientes",
             "Buscador, pestañas de filtro con su conteo, estado como punto más texto y contador de resultados.")}
  </div>
  <div class="nada-abajo">
    {captura("balance", "Balance general",
             "Tira de totales por moneda arriba, tabla abajo. Los totales van por moneda y nunca se suman entre sí.")}
  </div>
</div>

<div class="par" style="margin-top:1mm">
  <div class="tarjeta plano">
    <span class="rotulo">Detalle que importa</span>
    <p style="margin:0;font-size:8.4pt">Una fila por contraparte, y una sola: la restricción
    de unicidad de la base hace imposible que la misma aparezca dos veces por estar escrita
    distinto. En la planilla eso no se podía evitar.</p>
  </div>
  <div class="tarjeta plano">
    <span class="rotulo">Guion tenue, no cero</span>
    <p style="margin:0;font-size:8.4pt">Una moneda sin saldo muestra <code>—</code>. Un
    0,00 falso haría creer que hay un movimiento que dejó la cuenta en cero.</p>
  </div>
</div>""")


G = hoja("G", "Cuenta corriente y ajuste", "Dos rediseños de fondo", f"""
<div class="par">
  <div class="nada-abajo">
    {captura("cuenta", "Cuenta corriente",
             "Las dos tarjetas gigantes se reemplazaron por la tira de saldos: una superficie, cuatro monedas, comparables de un barrido. El libro cierra con un pie de totales.")}
    <div class="tarjeta plano">
      <span class="rotulo">El corte de cierre</span>
      <p style="margin:0;font-size:8.4pt">El cierre es un evento, no un movimiento
      financiero: va como una banda con borde propio en el hilo del libro, después de la
      operación que dejó las cuatro monedas en cero.</p>
    </div>
  </div>
  <div class="nada-abajo">
    {captura("ajuste", "Ajuste de cuenta",
             "Previsualización vertical: saldo actual → + ajuste → = saldo resultante, con los conectores en el hilo. Solo se listan las monedas en juego.")}
    <div class="tarjeta plano">
      <span class="rotulo">Nuevo enlace profundo</span>
      <p style="margin:0;font-size:8.4pt">Desde el libro de una cuenta con saldo se llega
      acá con la contraparte ya elegida: <code>/ajustes?cuenta=&lt;id&gt;</code>.</p>
    </div>
  </div>
</div>""")


H = hoja("H", "Auditoría", "Solo lo que cambió", f"""
{captura("auditoria", "Auditoría",
         "Filtros con su conteo. Las cuatro últimas filas son correcciones: concepto, categoría, partidas y nombre de contraparte, cada una con su autor.", alto=432)}

<div class="par" style="margin-top:1mm">
  <div class="nada-abajo">
    <h3>El panel muestra solo los campos que cambiaron</h3>
    <p style="font-size:8.4pt">El registro guarda el valor anterior y el nuevo como texto.
    Cuando son objetos, mostrarlos enteros obliga al auditor a compararlos a ojo. Ahora se
    listan únicamente las claves que efectivamente cambiaron, con antes y después lado a
    lado, y una línea que aclara que lo que no aparece quedó igual.</p>
    <p style="font-size:8.4pt;margin-bottom:0">La lógica se extrajo a un módulo propio y se
    cubrió con <b>nueve tests</b>: distingue el cero del valor ausente, no lista un campo
    que quedó igual, e incluye una clave que aparece o desaparece.</p>
  </div>
  <div class="aviso nada-abajo">
    <p><b>La auditoría de la demostración solo tenía altas.</b> La pantalla no podía mostrar
    lo que la hace valiosa: el antes y el después.</p>
    <p style="color:var(--pos);font-weight:600">→ Se sembraron cuatro correcciones
    históricas con su motivo y su autor.</p>
    <p style="margin-bottom:0;font-size:8.2pt">Son registros de demostración: no tocan
    ningún movimiento ni ningún saldo.</p>
  </div>
</div>""")


I = hoja("I", "Problemas encontrados mirando las capturas", "Ocho visuales, dos de fondo", """
<div class="dos" style="font-size:10.1pt">
  <ol class="hall">
    <li><b>La grilla de carga cortaba la columna de impacto.</b>
      <span class="q">~1270 px de columnas sobre ~1156 disponibles.</span>
      <span class="f">Anchos recalculados; contraparte y detalle flexibles; impacto fijado a la derecha.</span></li>
    <li><b>El bloque de usuario del riel se superponía con la navegación.</b>
      <span class="f">Grilla de tres filas, alto de pantalla y posición pegada.</span></li>
    <li><b>En el hero se pisaban impacto y saldo.</b>
      <span class="q">Se leía <code>+$ 3.200.000,00$ 3.200.000,00</code>.</span>
      <span class="f">Anchos de la vista corregidos.</span></li>
    <li><b>La comisión de la vista de carga se partía en dos líneas</b> y su encabezado quedaba truncado.
      <span class="f">Columna fija, sin quiebre de línea, y la sección se ensanchó.</span></li>
    <li><b>En el ingreso la retícula tapaba el contenido</b> y los tres bloques quedaban dispersos.
      <span class="f">Opacidad de .14 a .06, contenido centrado, «volver» al pie.</span></li>
    <li><b>Los rótulos al pie de los tres pilares quedaban a distinta altura.</b>
      <span class="f">Columna flexible con el rótulo empujado al fondo.</span></li>
    <li><b>El placeholder del buscador de auditoría se cortaba</b> aunque tenía ancho declarado.
      <span class="q">El <code>w-full</code> del input le ganaba a la clase de ancho.</span>
      <span class="f">El componente acepta el ancho y lo aplica al envoltorio.</span></li>
    <li><b>Quedaba viva una clase del sistema viejo</b> en la tarjeta de reinicio de la demo.
      <span class="f">Migrada, y barrido completo: no quedan usos de clases viejas.</span></li>
    <li><b>La grilla prometía impacto en categorías que no van a la cuenta corriente.</b>
      <span class="q">Impuesto, compra y venta mostraban importe y se sumaban al total del día.</span>
      <span class="f">Ahora dice «no impacta» y queda fuera del total. Ninguna regla cambió.</span></li>
    <li><b>La auditoría de la demostración solo tenía altas.</b>
      <span class="f">Cuatro correcciones históricas sembradas, con motivo y autor.</span></li>
  </ol>
</div>

<div class="tarjeta plano" style="margin-top:4mm">
  <span class="rotulo">Cómo se encontraron</span>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8mm">
    <p style="margin:0;font-size:8.6pt;color:var(--ink-2)"><b>1. Abrir y mirar.</b> Cada
    pantalla se levantó en Chrome headless y se revisó la captura, en lugar de dar por buena
    la lectura del código.</p>
    <p style="margin:0;font-size:8.6pt;color:var(--ink-2)"><b>2. Comparar contra el
    sistema.</b> Todo lo que no salía de un token o de un nivel de la escala era un
    candidato a error, no una variante.</p>
    <p style="margin:0;font-size:8.6pt;color:var(--ink-2)"><b>3. Corregir y volver a
    mirar.</b> La columna de impacto necesitó seis pasadas de ajuste de anchos hasta entrar
    a 1280 sin cortarse.</p>
  </div>
</div>""")


J = hoja("J", "Compuertas de calidad y lo que queda", "Estado al cierre", """
<div class="gates" style="margin-bottom:3mm">
  <div class="gate"><div class="n" style="color:var(--pos)">273</div>
    <div class="r"><code>npm test</code><br>13 archivos, 54 salteados</div></div>
  <div class="gate"><div class="n" style="color:var(--pos)">0</div>
    <div class="r"><code>tsc --noEmit</code><br>sin errores de tipo</div></div>
  <div class="gate"><div class="n" style="color:var(--pos)">0</div>
    <div class="r"><code>eslint --max-warnings=0</code><br>sin advertencias</div></div>
  <div class="gate"><div class="n" style="color:var(--pos)">11</div>
    <div class="r"><code>next build</code><br>rutas compiladas</div></div>
</div>

<div class="par">
  <div class="nada-abajo">
    <h3>Lo que no se tocó</h3>
    <p style="font-size:8.4pt;margin-bottom:1.6mm">Por indicación explícita, y verificado
    con el diff:</p>
    <ul class="pl">
      <li>Reglas financieras y cálculos: dinero, tipo de cambio, saldos, parseo,
      contrapartes.</li>
      <li>El modelo movimientos + partidas.</li>
      <li>Migraciones y seguridad por fila.</li>
      <li>Importador y lógica de tipo de cambio.</li>
      <li>Cierres y su ordenamiento canónico.</li>
      <li>Los doce archivos de test de dominio que ya existían.</li>
      <li>La capa de acceso a datos, salvo la siembra de auditoría de la demostración, que
      no es dato financiero.</li>
    </ul>
  </div>

  <div class="nada-abajo">
    <h3>Lo que queda pendiente</h3>
    <div class="tarjeta" style="margin-bottom:2.1mm;padding:3.4mm">
      <span class="chip pend"><span class="pt"></span>Decisión de producto</span>
      <p style="margin:1.8mm 0 0;font-size:8.4pt"><b>Modo oscuro sin interruptor.</b> Todos
      los tokens tienen variante oscura y la clase funciona, pero no hay control en la
      interfaz.</p>
    </div>
    <div class="tarjeta" style="margin-bottom:2.1mm;padding:3.4mm">
      <span class="chip pend"><span class="pt"></span>Necesita infraestructura</span>
      <p style="margin:1.8mm 0 0;font-size:8.4pt"><b>Los 54 tests de Supabase siguen sin
      ejecutarse:</b> necesitan una instancia real. Están <code>READY TO TEST</code>, no
      <code>TESTED</code>. La distinción sigue vigente.</p>
    </div>
    <div class="tarjeta" style="margin-bottom:2.1mm;padding:3.4mm">
      <span class="chip ok"><span class="pt"></span>Cubierto por tests</span>
      <p style="margin:1.8mm 0 0;font-size:8.4pt"><b>Los paneles laterales</b> —detalle de
      un movimiento y de un registro de auditoría— se verificaron por código y por test, no
      por captura: Chrome headless no puede hacer clic.</p>
    </div>
    <div class="tarjeta">
      <span class="chip pend"><span class="pt"></span>Espera autorización</span>
      <p style="margin:1.8mm 0 0;font-size:8.4pt"><b>Sin push al remoto.</b> Los commits
      siguen locales, incluido el de este pase.</p>
    </div>
  </div>
</div>

<div class="tarjeta plano" style="margin-top:3.6mm;padding:3.2mm">
  <span class="rotulo">Cómo reproducir las compuertas</span>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm;align-items:start">
    <p style="margin:0;font-family:var(--mono);font-size:8pt;color:var(--ink-2);line-height:1.45">
      export npm_config_cache="$PWD/.npm-cache"<br>
      npm test -- --run<br>
      npx tsc --noEmit<br>
      npx eslint src --max-warnings=0<br>
      npm run build
    </p>
    <p style="margin:0;font-size:8.4pt;color:var(--ink-2)">La primera línea sigue siendo
    necesaria: el caché global de npm quedó con permisos de root en esta máquina. Se resolvió
    con un caché local al proyecto, ignorado por git — nunca con <code>sudo</code>.</p>
  </div>
</div>""")


HTML = f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Nordelta · Informe MVP Next Level</title>
<style>{CSS}</style>
</head><body>
{TAPA}{A}{B}{C}{D}{E}{F}{G}{H}{I}{J}
</body></html>"""

SALIDA_HTML.write_text(HTML)
print(f"html: {SALIDA_HTML} ({SALIDA_HTML.stat().st_size / 1e6:.1f} MB)")

destino = pathlib.Path(
    "/Users/fran/Desktop/Laburo/Nordelta/Nordelta-Informe-MVP-Next-Level.pdf"
)
subprocess.run(
    [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--headless", "--disable-gpu", "--no-sandbox",
        "--no-pdf-header-footer",
        f"--print-to-pdf={destino}",
        "--virtual-time-budget=20000",
        SALIDA_HTML.as_uri(),
    ],
    check=True,
    capture_output=True,
)
print(f"pdf:  {destino} ({destino.stat().st_size / 1e6:.1f} MB)")
