#!/usr/bin/env python3
"""Arma el resumen del informe de arquitectura: siete páginas, una pregunta
por página.

Existe porque el informe completo tiene 43 páginas y nadie las lee. Este no
lo reemplaza: cada página apunta a la sección del informe completo donde está
el detalle.

Uso:
    python3 scripts/armar_resumen.py

El sistema visual sale de `informe_estilo.py`, compartido con el informe
completo.
"""
import pathlib
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from informe_estilo import documento, hacer_captura, hoja  # noqa: E402

RAIZ = pathlib.Path(__file__).resolve().parent.parent
CAPTURAS = pathlib.Path(
    "/private/tmp/claude-501/-Users-fran-Desktop-Laburo-Nordelta/"
    "fd35491a-502a-4fea-82cf-b3a308b74e7a/scratchpad/estructura"
)
SALIDA_HTML = RAIZ / "docs" / "NORDELTA_APP_STRUCTURE_RESUMEN.html"
SALIDA_PDF = RAIZ / "docs" / "NORDELTA_APP_STRUCTURE_RESUMEN.pdf"
DESTINO_PDF = RAIZ.parent / "pdfs" / "2026-09-07 · Nordelta · Arquitectura · resumen.pdf"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

captura = hacer_captura(CAPTURAS)

PAGINAS = []


def pagina(html):
    PAGINAS.append(html)


def ref(seccion, texto):
    """Puntero al informe completo. El resumen no reemplaza al informe."""
    return (
        f'<p class="mini" style="margin:2.6mm 0 0;padding-top:1.6mm;'
        f'border-top:.7pt solid var(--line)">→ <b>Detalle en {seccion}</b> '
        f"del informe completo · {texto}</p>"
    )


# ═════════════════════════════════════════════════════════════════════════
#  1 · El hallazgo y la propuesta
# ═════════════════════════════════════════════════════════════════════════
pagina("""<section class="hoja">
  <div style="background:var(--navy);color:#F1F6FF;margin:-12mm -13mm 4mm;
              padding:8mm 13mm 7mm;position:relative;overflow:hidden">
    <div style="position:absolute;top:-40mm;right:-24mm;width:110mm;height:110mm;
                border-radius:50%;background:rgba(29,90,208,.34);filter:blur(26mm)"></div>
    <div style="position:relative;display:flex;align-items:flex-end;gap:9mm">
      <div style="min-width:0">
        <div style="display:flex;align-items:center;gap:2.4mm;margin-bottom:3.4mm">
          <span class="logo" style="width:7mm;height:7mm;font-size:9.5pt;border-radius:2mm">N</span>
          <span style="font-size:10pt;font-weight:640;letter-spacing:-.02em">Nordelta</span>
          <span class="rot" style="color:#5A749A;margin-left:2mm">Resumen · 7 páginas</span>
        </div>
        <h1 style="color:#fff;font-size:23pt;line-height:1.06">Qué aplicación vamos a construir</h1>
        <p style="font-size:9.6pt;color:#90A8C8;max-width:150mm;margin:3mm 0 0;line-height:1.45">
        La mitad contable ya está construida y probada. Lo que falta es la mitad operativa:
        300 a 600 transferencias por día que hoy se procesan limpiando Excel a mano.</p>
      </div>
      <div style="margin-left:auto;text-align:right;flex:none">
        <div class="rot" style="color:#5A749A">Septiembre de 2026</div>
        <div class="rot" style="color:#5A749A;margin-top:1mm">Para revisión interna</div>
      </div>
    </div>
  </div>

  <div class="g2">
    <div class="nada">
      <h3>El hallazgo</h3>
      <p>La aplicación que existe resuelve <b>la mitad contable</b>: movimientos, partidas,
      cuenta corriente multi-moneda, balance, cierres y auditoría. Construida, probada y
      verde.</p>
      <p>La última reunión reveló que <b>la mitad operativa —donde se va el día del
      operador— no está construida.</b> Sin estado explícito y sin conciliación
      sistemática.</p>

      <div class="tbl" style="margin:2.6mm 0">
      <table>
        <thead><tr><th style="width:24%"></th>
          <th style="width:38%">Operativa · <span style="color:var(--brand)">NUEVA</span></th>
          <th style="width:38%">Contable · <span style="color:var(--pos)">EXISTE</span></th></tr></thead>
        <tbody>
          <tr><td><b>Naturaleza</b></td><td>Un pipeline con estados</td><td>Un libro mayor</td></tr>
          <tr><td><b>Volumen</b></td><td>300–600 filas/día</td><td>~15 movimientos/día</td></tr>
          <tr><td><b>La pregunta</b></td><td>¿Dónde está trabada la plata?</td><td>¿Cuánto nos debe este cliente?</td></tr>
          <tr><td><b>Quién decide</b></td><td>El operador, caso por caso</td><td>La regla, siempre igual</td></tr>
        </tbody>
      </table>
      </div>

      <div class="aviso nada">
        <span class="rot" style="color:var(--brand)">La consecuencia arquitectónica</span>
        <p style="margin:1.2mm 0 1.4mm"><b>No hay que reescribir lo que existe.</b> Hay que
        construir la mitad que falta y coserla a la que ya está. Y se tocan en un único
        punto:</p>
        <p style="font-family:var(--mono);font-size:8.4pt;font-weight:700;
                  color:var(--brand-lo);margin:0">una conciliación confirmada<br>genera el
        movimiento contable</p>
      </div>
    </div>

    <div class="nada">
      <h3>Lo que proponemos</h3>
      <ol class="num" style="margin-bottom:3mm">
        <li><b>Dos módulos nuevos</b>: Acreditaciones y Conciliación, más la ingesta de
        Excel que los alimenta.</li>
        <li><b>Una arquitectura de información nueva</b> de cuatro grupos, organizada
        alrededor de las preguntas del operador.</li>
        <li><b>Una Home que es un centro de operaciones</b>: el pipeline del día primero,
        la plata después.</li>
        <li><b>Conservar el motor financiero completo</b> —863 líneas de dominio, 976 de
        esquema, 273 tests— sin tocarlo.</li>
        <li><b>Vercel + Supabase Pro</b>, que es lo que el código ya supone.</li>
      </ol>

      <div class="card no" style="margin-bottom:2.6mm">
        <span class="rot" style="color:var(--neg)">Los tres bloqueantes</span>
        <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1.4mm">No se puede cerrar
        el esquema de la mitad nueva sin tres respuestas del cliente.</p>
        <p style="font-size:7.8pt;margin-bottom:1mm"><b>N1</b> · ¿A qué granularidad una
        conciliación confirmada impacta la cuenta corriente?</p>
        <p style="font-size:7.8pt;margin-bottom:1mm"><b>N2</b> · ¿«Ingresos y créditos»
        trae algún identificador de operación?</p>
        <p style="font-size:7.8pt;margin-bottom:0"><b>N3</b> · ¿Nordelta cobra comisión por
        la transferencia y se registra en la cuenta corriente?</p>
      </div>

      <div class="card wa nada">
        <span class="rot" style="color:var(--warn)">Lo que hace falta antes de escribir código</span>
        <p style="margin:1.2mm 0 0"><b>Archivos reales.</b> Tres a cinco Excel de clientes
        distintos y tres a cinco descargas de «Ingresos y créditos». Sin esas muestras,
        cualquier parser y cualquier regla de matching es una apuesta.</p>
      </div>
    </div>
  </div>

  <div class="card pl" style="margin-top:4mm">
    <span class="rot">Cómo leer este resumen · una pregunta por página</span>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2mm 7mm;margin-top:1.8mm">
      <span class="mini"><b style="color:var(--brand)">2</b> &nbsp;Qué existe hoy, y qué de eso conservamos</span>
      <span class="mini"><b style="color:var(--brand)">3</b> &nbsp;La estructura nueva y por qué es así</span>
      <span class="mini"><b style="color:var(--brand)">4</b> &nbsp;Los dos módulos nuevos, en concreto</span>
      <span class="mini"><b style="color:var(--brand)">5</b> &nbsp;Qué entra al MVP y en qué orden</span>
      <span class="mini"><b style="color:var(--brand)">6</b> &nbsp;Dónde se hospeda y qué tablas hacen falta</span>
      <span class="mini"><b style="color:var(--brand)">7</b> &nbsp;Qué necesitamos para arrancar</span>
    </div>
    <p class="mini" style="margin:2mm 0 0;padding-top:1.4mm;border-top:.6pt solid var(--line)">
    Cada página cierra con un puntero a la sección del <b>informe completo</b> —43 páginas,
    <code>docs/NORDELTA_APP_STRUCTURE_REPORT.pdf</code>— donde está el detalle: wireframes
    de las doce pantallas, matriz de reutilización de 21 áreas, cinco user flows, campos de
    cada tabla nueva y las 26 decisiones abiertas.</p>
  </div>
</section>""")


# ═════════════════════════════════════════════════════════════════════════
#  2 · Qué existe y qué conservamos
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("2", "Qué existe, y qué conservamos", "Auditado sobre el código, no sobre documentación previa", f"""
<div class="g4" style="margin-bottom:3.4mm">
  <div class="card pl" style="text-align:center">
    <div class="med" style="color:var(--pos)">273</div>
    <div class="mini" style="margin-top:1mm"><code>npm test</code> · 54 salteados</div></div>
  <div class="card pl" style="text-align:center">
    <div class="med" style="color:var(--pos)">0</div>
    <div class="mini" style="margin-top:1mm"><code>tsc</code> · sin errores de tipo</div></div>
  <div class="card pl" style="text-align:center">
    <div class="med" style="color:var(--pos)">0</div>
    <div class="mini" style="margin-top:1mm"><code>eslint</code> · sin advertencias</div></div>
  <div class="card pl" style="text-align:center">
    <div class="med" style="color:var(--pos)">11</div>
    <div class="mini" style="margin-top:1mm"><code>build</code> · rutas compiladas</div></div>
</div>

<div class="g3" style="margin-bottom:3.4mm">
  {captura("carga", "Carga", "· grilla con pegado desde Excel")}
  {captura("cuenta", "Cuenta corriente", "· tira de saldos y libro")}
  {captura("auditoria", "Auditoría", "· solo los campos que cambiaron")}
</div>

<div class="g23">
  <div class="nada">
    <h3>Las 21 áreas auditadas, agrupadas</h3>
    <div class="tbl compacta">
    <table>
      <thead><tr><th style="width:22%">Veredicto</th><th style="width:44%">Qué incluye</th>
        <th style="width:34%">Por qué</th></tr></thead>
      <tbody>
        <tr><td><span class="et et-keep">REUSE AS-IS</span><br><span class="mini">10 áreas</span></td>
            <td class="mini">Motor financiero (dinero, tipo de cambio, saldos, parseo) ·
            formato argentino · sistema de diseño · observabilidad · auth y RLS ·
            Carga · Balance · los 273 tests</td>
            <td class="mini">Verificado contra PostgreSQL real. Tocarlo es riesgo puro</td></tr>
        <tr><td><span class="et et-red">EXTENDER</span><br><span class="mini">7 áreas</span></td>
            <td class="mini">Riel · capa de datos · dataset de demostración · Cuentas ·
            Auditoría · portada · exportación</td>
            <td class="mini">Mismo patrón, más casos. Nada se reescribe</td></tr>
        <tr><td><span class="et et-red">REFACTOR</span><br><span class="mini">2 áreas</span></td>
            <td class="mini">La grilla de carga · el importador del histórico</td>
            <td class="mini"><b>Las dos palancas del proyecto</b> — abajo</td></tr>
        <tr><td><span class="et et-fus">FUSIONAR</span><br><span class="mini">1 área</span></td>
            <td class="mini">Ajustes, que pasa a ser una acción del cliente</td>
            <td class="mini">Es una acción sobre una cuenta, no una sección</td></tr>
        <tr><td><span class="et et-red">REDISEÑAR</span><br><span class="mini">1 área</span></td>
            <td class="mini">La Home</td>
            <td class="mini">Falta el pipeline operativo</td></tr>
      </tbody>
    </table>
    </div>
  </div>

  <div class="nada">
    <div class="card ok" style="margin-bottom:3mm">
      <span class="rot" style="color:var(--pos)">Lo que se descarta</span>
      <p style="font-size:12pt;font-weight:680;margin:1.2mm 0 1.2mm">Nada.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0">Ninguna pieza del trabajo
      existente se tira. Lo más agresivo que propone el informe es <b>mover Ajustes de la
      navegación</b> y <b>rediseñar la Home</b>.</p>
    </div>

    <h3>Las dos palancas</h3>
    <p class="mini"><b>1 · La grilla.</b> El preview de la importación de Excel <b>es</b>
    una grilla editable con errores por celda, pegado y deshacer — exactamente lo que
    <code>CargaGrid</code> ya hace y tiene probado. Se extrae un
    <code>GrillaEditable</code> y las dos pantallas lo usan.</p>
    <p class="mini" style="margin-bottom:0"><b>2 · El importador.</b>
    <code>lib/migracion/importador.ts</code> ya garantiza en cinco estados que ninguna fila
    desaparece en silencio. Se escribió para el histórico legacy y es exactamente el
    contrato que necesita la ingesta de Excel.</p>
  </div>
</div>

{ref("las secciones 06 a 08", "volumen de código por área, garantías verificadas y la matriz de 21 filas")}"""))


# ═════════════════════════════════════════════════════════════════════════
#  3 · La estructura nueva
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("3", "La estructura nueva", "Organizada alrededor de las preguntas, no de las tablas de la base", """
<div class="g23">
  <div class="nada">
    <pre class="ascii"><b>/</b>                          Portada · pública
└── <b>/login</b>                 Ingreso
    └── APP · requiere sesión
        │
        ├── <b>/inicio</b>        Centro de operaciones
        │
        ├── OPERACIÓN
        │   ├── <i>/acreditaciones</i>    ¿qué me mandaron?
        │   │   └── <i>/importar</i>      ingesta de Excel
        │   ├── <i>/conciliacion</i>      ¿qué se acreditó?
        │   └── <b>/carga</b>             grilla diaria
        │
        ├── CUENTAS
        │   ├── <b>/cuentas</b>           ¿cuánto nos deben?
        │   │   └── <b>/[id]</b>          el cliente · 4 pestañas
        │   └── <b>/balance</b>           totales por moneda
        │
        └── CONTROL
            ├── <b>/auditoria</b>         ¿quién cambió qué?
            └── <i>/configuracion</i>     mapeos · usuarios</pre>

    <div class="g2" style="gap:3mm;margin-top:3mm">
      <div class="card ok nada" style="text-align:center;padding:2.4mm">
        <div class="med" style="color:var(--pos)">10</div>
        <p class="mini" style="color:var(--ink-2);margin:.8mm 0 0">rutas que ya existen
        <span style="display:block;font-size:6.6pt">en negro arriba</span></p></div>
      <div class="card br nada" style="text-align:center;padding:2.4mm">
        <div class="med" style="color:var(--brand)">13</div>
        <p class="mini" style="color:var(--ink-2);margin:.8mm 0 0">rutas nuevas
        <span style="display:block;font-size:6.6pt">en azul arriba</span></p></div>
    </div>
  </div>

  <div class="nada">
    <h3>Las cinco decisiones de estructura</h3>
    <ol class="num" style="margin-bottom:3mm">
      <li><b>Acreditaciones y Conciliación son dos pantallas, no una.</b>
        <span class="mini" style="display:block">Responden preguntas distintas en momentos
        distintos del día. Fusionarlas exigiría un selector de modo, que es el «filtro que
        alguien dejó puesto» que queremos eliminar.</span></li>
      <li><b>Importar no es una sección: es una acción de Acreditaciones.</b>
        <span class="mini" style="display:block">Nadie entra a «usar el importador»: entra
        a procesar lo que le mandó un cliente.</span></li>
      <li><b>Cliente y cuenta corriente son una pantalla con pestañas.</b>
        <span class="mini" style="display:block">Resumen · Cuenta corriente ·
        Transferencias · Errores, con cuatro números operativos en la cabecera. Separarlas
        obligaría a buscar dos veces para responder «¿le debemos, o le falta
        acreditar?».</span></li>
      <li><b>Ajustes sale de la navegación.</b>
        <span class="mini" style="display:block">Un ajuste es sobre <b>una</b> cuenta.
        Tenerlo en el menú obliga a elegir la contraparte otra vez cuando ya la estabas
        mirando.</span></li>
      <li><b>«Clientes» y «Contrapartes» son la misma tabla.</b>
        <span class="mini" style="display:block">El esquema ya tiene
        <code>es_cliente</code> y <code>es_proveedor</code>. Dos entradas de menú para una
        tabla es cómo empiezan los duplicados.</span></li>
    </ol>

    <div class="card wa nada">
      <span class="et et-val">TO VALIDATE</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 0">La decisión 3 depende de
      <b>N8</b>: si los clientes que mandan archivos no son las contrapartes con cuenta
      corriente, la pantalla se parte en dos. Es la única decisión de estructura que
      depende de una respuesta que no tenemos.</p>
    </div>
  </div>
</div>

<p class="mini" style="margin:2.6mm 0 0;padding-top:1.6mm;border-top:.7pt solid var(--line)">
→ <b>Detalle en las secciones 09 a 11</b> del informe completo · qué cambia pantalla por
pantalla, el sitemap entero y la razón de cada decisión</p>"""))


# ═════════════════════════════════════════════════════════════════════════
#  4 · Los dos módulos nuevos
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("4", "Los dos módulos nuevos", "Acreditaciones y Conciliación", """
<div class="g2">
  <div class="nada">
    <h3 style="color:var(--brand)">Acreditaciones</h3>
    <p class="mini">La bandeja única de todo lo que los clientes mandaron. Reemplaza «el
    Excel que está en la carpeta» y «el mail que quedó sin leer».</p>

    <div class="aviso no" style="margin:2.6mm 0">
      <p style="margin-bottom:1.2mm"><b>Dos ejes de estado, no uno.</b></p>
      <p style="margin-bottom:0">La lista original —Recibida · Con error · Lista · Enviada ·
      Acreditada · Pendiente— mezcla dos cosas: <b>una transferencia puede estar «enviada» y
      «pendiente de acreditación» al mismo tiempo</b>.</p>
    </div>

    <div class="card br" style="margin-bottom:2.4mm">
      <span class="rot" style="color:var(--brand)">Eje 1 · proceso</span>
      <pre class="ascii limpio" style="margin-top:1.4mm;font-size:6.4pt"><b>recibida</b> → <b>validada</b> → <b>lista</b> → <b>enviada</b>
    │          │
    └──────────┴→ <b>con_error</b> → (corregida) → validada
                      └→ <b>descartada</b>  ← con motivo</pre>
    </div>
    <div class="card ok" style="margin-bottom:2.4mm">
      <span class="rot" style="color:var(--pos)">Eje 2 · acreditación</span>
      <pre class="ascii limpio" style="margin-top:1.4mm;font-size:6.4pt"><b>pendiente</b> → <b>acreditada</b>
    └→ <b>rechazada</b>   ← el sistema externo la devolvió</pre>
      <p class="mini" style="color:var(--ink-2);margin:1.4mm 0 0">Sólo aplica desde
      <code>enviada</code>, y lo determina la conciliación. El <b>total por cliente</b>
      —enviado, acreditado, pendiente— es la suma: ahí vive la parcialidad.</p>
    </div>

    <div class="card wa nada">
      <span class="rot" style="color:var(--warn)">Lo que entrega valor primero</span>
      <p style="margin:1.2mm 0 0">El botón <b>Exportar normalizado</b>. Hoy alguien limpia
      un Excel a mano dos veces por lote. Una pantalla que lo hace en un minuto, con los
      errores señalados antes de procesar, <b>ya paga el proyecto sin que exista todavía la
      conciliación</b>.</p>
    </div>
  </div>

  <div class="nada">
    <h3 style="color:var(--brand)">Conciliación</h3>
    <p class="mini">Comparar lo que enviamos contra lo que el banco acreditó, y dejar
    registrada la decisión con la evidencia que la sostiene.</p>

    <div class="tbl compacta" style="margin:2.6mm 0">
    <table>
      <thead><tr><th style="width:34%">Resultado</th><th style="width:42%">Criterio</th>
        <th style="width:24%">Decide</th></tr></thead>
      <tbody>
        <tr><td><span class="et et-keep">MATCH EXACTO</span></td>
            <td>La tupla identifica <b>una sola</b> transferencia</td><td>El sistema, auditado</td></tr>
        <tr><td><span class="et et-red">POSIBLE MATCH</span></td>
            <td>Coincide en parte, o con más de una</td><td><b>La persona</b></td></tr>
        <tr><td><span class="et et-fus">SIN MATCH</span></td>
            <td>No hay candidato</td><td>Pendiente y visible</td></tr>
        <tr><td><span class="et et-del">ERROR</span></td>
            <td>No se puede interpretar</td><td>Va a revisión</td></tr>
      </tbody>
    </table>
    </div>

    <h4>La regla de auto-match</h4>
    <pre class="ascii" style="font-size:6.4pt;margin-bottom:2.4mm"><b>AUTO-MATCH SEGURO</b>
  referencia externa coincidente
      — o —
  CUIT exacto + importe exacto + fecha en ventana
      <i>Y la tupla identifica UNA SOLA transferencia abierta</i>

<b>SUGERENCIA</b>  · todo lo demás · el operador decide</pre>

    <div class="aviso" style="margin-bottom:2.4mm">
      <p style="margin-bottom:0"><b>La condición de unicidad es la que importa.</b> Si dos
      transferencias abiertas comparten CUIT, importe y fecha, no hay auto-match: hay dos
      sugerencias. Sin eso el sistema repetiría el problema de los importes repetidos, con
      más velocidad.</p>
    </div>

    <div class="card no nada">
      <span class="rot" style="color:var(--neg)">Por qué no prometemos un número todavía</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 0">La tasa de automatización
      depende de si existe la referencia externa (<b>N2</b>), y no lo sabemos.
      <b>Con</b> referencia el matching es casi determinístico. <b>Sin</b> referencia
      depende de heurísticas. Es el riesgo número 1 del proyecto.</p>
    </div>
  </div>
</div>

<p class="mini" style="margin:2.6mm 0 0;padding-top:1.6mm;border-top:.7pt solid var(--line)">
→ <b>Detalle en las secciones 12 a 20</b> del informe completo · wireframes de las cuatro
pantallas, validación de CUIT con dígito verificador, señales de matching y flujo de ingesta</p>"""))


# ═════════════════════════════════════════════════════════════════════════
#  5 · MVP y roadmap
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("5", "MVP y roadmap", "Qué entra, qué espera, y en qué orden", """
<div class="g3" style="margin-bottom:3.4mm">
  <div class="card br nada">
    <span class="rot" style="color:var(--brand)">MVP · la mitad operativa completa</span>
    <ul class="pl" style="margin:1.4mm 0 0;color:var(--ink-2)">
      <li><b>Home</b> rediseñada · pipeline del día</li>
      <li><b>Importar Excel</b> · mapeo, normalización, validación, preview editable</li>
      <li><b>Acreditaciones</b> · bandeja con los dos ejes</li>
      <li><b>Exportar normalizado</b> ← el valor inmediato</li>
      <li><b>Importar créditos</b></li>
      <li><b>Conciliación</b> · matching asistido</li>
      <li><b>Cliente</b> · cabecera operativa + 4 pestañas</li>
      <li><b>Configuración</b> mínima · mapeos y ventana de fechas</li>
      <li><b>Auditoría</b> + las 5 entidades nuevas</li>
    </ul>
    <p class="mini" style="color:var(--ink-2);margin:1.6mm 0 0;padding-top:1.2mm;
              border-top:.6pt solid var(--brand-line)">Más lo que ya existe: cuenta
    corriente, carga manual, balance, portada e ingreso.</p>
  </div>

  <div class="nada">
    <div class="card pl" style="margin-bottom:2.6mm">
      <span class="rot">Fase 2</span>
      <ul class="pl" style="margin:1.4mm 0 0;color:var(--ink-2)">
        <li>Ingesta automática desde Gmail</li>
        <li>Matching automático con la tasa medida</li>
        <li>Cheques con cobro y rechazo · <b>D7</b></li>
        <li>Notificaciones de pendientes viejos</li>
        <li>Roles y permisos completos · <b>D9</b></li>
        <li>Migración del histórico y paralelo</li>
      </ul>
    </div>
    <div class="card pl" style="margin-bottom:2.6mm">
      <span class="rot">Futuro</span>
      <ul class="pl" style="margin:1.4mm 0 0;color:var(--ink-2)">
        <li>WhatsApp como canal formal</li>
        <li>API directa del sistema externo</li>
        <li>Préstamos, <b>si se confirma que existen</b> · <b>D4</b></li>
      </ul>
    </div>
    <div class="card no nada">
      <span class="rot" style="color:var(--neg)">Fuera de alcance</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 0">Dashboards de BI ·
      app móvil · portal para que el cliente cargue solo · reportes configurables ·
      <b>cualquier automatización de matching ambiguo</b>.</p>
    </div>
  </div>

  <div class="nada">
    <div class="card wa" style="margin-bottom:2.6mm">
      <span class="rot" style="color:var(--warn)">Condicional</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 0">La <b>generación
      automática del movimiento contable</b> desde una conciliación entra al MVP si
      <b>N1 y N3</b> están respondidas. Si no, la conciliación queda registrada y el
      movimiento se carga a mano: un paso más, pero no bloquea el resto.</p>
    </div>
    <div class="card ok nada">
      <span class="rot" style="color:var(--pos)">Lo que el MVP hereda gratis</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 1.2mm">Motor financiero
      multi-moneda · saldo corrido y cierres · auditoría con diff por campo · exportación
      en formato argentino · seguridad por fila · sistema de diseño · 273 tests · modo
      demostración sin base.</p>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0"><b>Eso es lo que hace que
      sea alcanzable.</b> No se arranca de cero: se arranca desde la mitad de abajo ya
      construida.</p>
    </div>
  </div>
</div>

<div class="flujo" style="margin-bottom:2.6mm">
  <div class="nodo wa" style="background:var(--warn-wash);border-color:var(--warn-line)">
    <div class="t">F0 · Accesos</div><div class="d">1–2 sem · en paralelo · <b>sin código</b></div></div>
  <div class="fl">→</div>
  <div class="nodo"><div class="t">F1 · Shell y Home</div><div class="d">1–2 sem · no depende de nadie</div></div>
  <div class="fl">→</div>
  <div class="nodo br"><div class="t">F2 · Ingesta</div><div class="d">3–4 sem · primer valor real</div></div>
  <div class="fl">→</div>
  <div class="nodo br"><div class="t">F3 · Conciliación</div><div class="d">3–4 sem · mayor riesgo</div></div>
  <div class="fl">→</div>
  <div class="nodo br"><div class="t">F4 · La costura</div><div class="d">1–2 sem</div></div>
  <div class="fl">→</div>
  <div class="nodo"><div class="t">F6 · Automatizar</div><div class="d">2–3 sem</div></div>
</div>

<pre class="ascii limpio" style="font-size:6.6pt">F0 accesos ─┬─ F1 shell ── F2 ingesta ── F3 conciliación ── F4 costura ─┬─ F6 automatizar
            └──────────────── F5 Supabase real + histórico ────────────┘   <i>F5 puede correr en paralelo desde el final de F2</i></pre>

<p class="mini" style="margin:2.4mm 0 0"><b>Las duraciones son estimaciones</b>, en semanas
de una persona dedicada, sujetas a las respuestas de la fase 0. La fase 3 es la que más
puede moverse. &nbsp;→ <b>Detalle en las secciones 34 a 36</b> del informe completo ·
alcance del MVP y entregables, riesgos y validación de cada fase</p>"""))


# ═════════════════════════════════════════════════════════════════════════
#  6 · Infraestructura y datos
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("6", "Infraestructura y datos", "Recomendación, y qué tablas nuevas hacen falta", """
<div class="g2">
  <div class="nada">
    <div class="card br" style="margin-bottom:3mm">
      <span class="rot" style="color:var(--brand)">Recomendación</span>
      <div class="tbl" style="margin:1.6mm 0 2mm;background:var(--surface)">
      <table>
        <tbody>
          <tr><td style="width:44%"><b>Frontend</b> · Next.js</td><td>Vercel Pro</td>
              <td class="num">~20 USD/mes</td></tr>
          <tr><td><b>Base · Auth · Storage</b></td><td>Supabase Pro</td>
              <td class="num">~25 USD/mes</td></tr>
          <tr><td><b>Respaldo independiente</b></td><td>Dump diario propio</td>
              <td class="num">~0</td></tr>
          <tr style="background:var(--brand-wash)"><td colspan="2"><b>Total</b></td>
              <td class="num"><b>~45 USD/mes</b></td></tr>
        </tbody>
      </table>
      </div>
      <p class="mini" style="color:var(--ink-2);margin-bottom:0"><b>Por qué.</b> Es lo que
      el código ya supone: <code>@supabase/ssr</code>, RLS con
      <code>security_invoker</code>, Server Actions de Next 16. Otra cosa significaría
      reescribir autenticación y seguridad por fila —lo más delicado de lo hecho— sin ganar
      nada.</p>
    </div>

    <div class="card no" style="margin-bottom:3mm">
      <span class="rot" style="color:var(--neg)">Por qué Pro y no Free</span>
      <p class="mini" style="color:var(--ink-2);margin:1.2mm 0 0">No es por volumen:
      entrarían de sobra. Es porque <b>el plan gratuito pausa el proyecto tras una semana de
      inactividad y no tiene ningún backup</b>. Para una financiera no es una opción.</p>
    </div>

    <h4>La alternativa, evaluada en serio</h4>
    <p class="mini" style="margin-bottom:0"><b>VPS propio con Docker</b> —ya tienen
    infraestructura en Hostinger— sale 15–25 USD/mes. Se descarta: backups, TLS,
    actualizaciones, monitoreo y auth pasan a ser trabajo del equipo de producto, y
    <b>el primer backup que no se probó se descubre el día que hace falta</b>. Los 20–30 USD
    de diferencia no justifican ese riesgo. El lock-in es acotado: <b>la base es Postgres
    estándar y el dump es portable</b>; lo atado es Auth y Storage.</p>
  </div>

  <div class="nada">
    <pre class="ascii" style="font-size:6.1pt;line-height:1.4">  <b>CLIENTE</b>                    <b>SISTEMA EXTERNO</b>
     │ archivo                     │ «Ingresos y créditos»
     ↓                             ↓
 <i>lotes</i>                      <i>lotes_credito</i>
     ↓                             ↓
 <i>lote_filas</i>  crudo +       <i>acreditaciones</i>
     │        normalizado           │
     │        + errores             │
     ↓                             │
 <i>transferencias</i>                │
     └───────────┬─────────────────┘
                 ↓
          <i>conciliaciones</i>   tipo · señales · quién
                 │ confirmada
     ═══════ <i>LA COSTURA</i> ═══════
                 ↓
          <b>movimientos</b>      <b>EXISTE</b> · granularidad = N1
                 ↓
          <b>partidas</b>         <b>EXISTE</b>
                 ↓
          <b>v_cta_cte</b>        <b>EXISTE</b> · saldo corrido
                 ↓
          <b>v_balance</b>        <b>EXISTE</b> · por moneda</pre>

    <h4 style="margin-top:2.6mm">Ocho tablas nuevas</h4>
    <p class="mini"><code>lotes</code> · <code>lote_filas</code> ·
    <code>transferencias</code> · <code>lotes_credito</code> ·
    <code>acreditaciones</code> · <code>conciliaciones</code> ·
    <code>contraparte_canales</code> · <code>mapeos_columnas</code>. Cuatro migraciones
    nuevas; <b>las cuatro existentes no se editan</b>.</p>

    <div class="aviso nada">
      <p style="margin-bottom:1.2mm"><b>La relación que absorbe la decisión N1.</b>
      <code>conciliación N ── 1 movimiento</code>: varias conciliaciones confirmadas pueden
      apuntar al mismo movimiento contable.</p>
      <p style="margin-bottom:0">Si N1 resuelve «una por transferencia», el N pasa a ser 1 y
      no hay que cambiar nada más. Se modela así desde el principio para que las tres
      respuestas posibles entren sin rehacer el módulo.</p>
    </div>
  </div>
</div>

<p class="mini" style="margin:2.6mm 0 0;padding-top:1.6mm;border-top:.7pt solid var(--line)">
→ <b>Detalle en las secciones 27 a 32</b> del informe completo · stack capa por capa,
ambientes y respaldos, comparación de hosting, campos de cada tabla, índices y mapa de
integraciones</p>"""))


# ═════════════════════════════════════════════════════════════════════════
#  7 · Decisiones, riesgos y próximos pasos
# ═════════════════════════════════════════════════════════════════════════
pagina(hoja("7", "Decisiones, riesgos y próximos pasos", "Lo que necesitamos para arrancar", """
<div class="g2" style="margin-bottom:3.4mm">
  <div class="nada">
    <h3>Las cinco decisiones que bloquean</h3>
    <div class="tbl compacta">
    <table>
      <thead><tr><th style="width:8%">#</th><th style="width:58%">Pregunta</th>
        <th style="width:34%">Bloquea</th></tr></thead>
      <tbody>
        <tr style="background:var(--neg-wash)"><td class="m"><b>N1</b></td>
            <td>¿A qué granularidad una conciliación confirmada impacta la cuenta
            corriente? Una por transferencia, por lote y cliente, o por cliente y día</td>
            <td>Fase 4 y el esquema de <code>conciliaciones</code></td></tr>
        <tr style="background:var(--neg-wash)"><td class="m"><b>N2</b></td>
            <td>¿«Ingresos y créditos» trae algún identificador de operación?</td>
            <td>Fase 3 · si el matching es determinístico o heurístico</td></tr>
        <tr style="background:var(--neg-wash)"><td class="m"><b>N3</b></td>
            <td>¿Nordelta cobra comisión por la transferencia? ¿Se registra en la cuenta
            corriente del cliente?</td>
            <td>Fase 4 · si el movimiento tiene una o dos partidas</td></tr>
        <tr style="background:var(--neg-wash)"><td class="m"><b>D1</b></td>
            <td>¿Sigue vigente el asiento espejo del proveedor de transferencia?</td>
            <td>El esquema contable · <b>y puede ser un incidente</b></td></tr>
        <tr style="background:var(--neg-wash)"><td class="m"><b>D2</b></td>
            <td>¿Qué es un «full pago» y qué lo distingue?</td>
            <td>Una de las tres categorías que afectan la cuenta corriente</td></tr>
      </tbody>
    </table>
    </div>
    <p class="mini" style="margin-top:2mm">Hay <b>otras nueve nuevas</b> (N4 a N12) y las
    que siguen abiertas de la etapa anterior. <b>D1 merece atención</b>: la query de 2025
    emitía un movimiento espejo del proveedor y esa rama no existe en la de 2026. Si tenía
    que seguir existiendo, <b>faltan asientos desde enero de 2026</b>.</p>
  </div>

  <div class="nada">
    <h3>Los cuatro riesgos altos</h3>
    <div class="tbl compacta">
    <table>
      <thead><tr><th style="width:6%"></th><th style="width:40%">Riesgo</th>
        <th style="width:54%">Mitigación</th></tr></thead>
      <tbody>
        <tr><td class="m"><b>1</b></td>
            <td><b>El sistema externo es una caja negra.</b> Sin identificador de operación,
            el matching depende de heurísticas</td>
            <td>N2 es lo primero de la fase 0. Si no hay identificador, <b>el alcance de la
            fase 3 se replantea antes de empezar</b></td></tr>
        <tr><td class="m"><b>2</b></td>
            <td><b>Calidad de los archivos.</b> Sin muestras reales, cualquier parser es una
            apuesta</td>
            <td>3–5 archivos por canal antes de escribir código. Mapeo por cliente para
            absorber la heterogeneidad</td></tr>
        <tr><td class="m"><b>3</b></td>
            <td><b>Matching ambiguo a volumen.</b> 600 por día con importes repetidos genera
            muchas sugerencias</td>
            <td>Nunca auto-confirmar sin tupla única. Medir la tasa real antes de prometer
            ahorro: si el operador decide 200 casos por día, no ganó nada</td></tr>
        <tr><td class="m"><b>4</b></td>
            <td><b>Adopción.</b> El operador es rápido en Excel. Si la ingesta es más lenta
            que su limpieza manual, no se usa</td>
            <td>Cronómetro en la fase 2, con el protocolo ya escrito. <b>Si pierde, se
            rediseña antes de seguir</b></td></tr>
      </tbody>
    </table>
    </div>
    <div class="aviso no" style="margin-top:2.4mm">
      <p style="margin-bottom:0"><b>Los cuatro comparten una sola mitigación: archivos
      reales antes de escribir código.</b> Es la razón de existir de la fase 0, y es lo
      único que este informe pide con urgencia.</p>
    </div>
  </div>
</div>

<div class="g3">
  <div class="card no nada">
    <span class="rot" style="color:var(--neg)">Los tres accesos bloqueantes</span>
    <ul class="tick" style="margin-top:1.4mm;color:var(--ink-2)">
      <li class="mini"><b>3–5 Excel reales</b> de clientes distintos</li>
      <li class="mini"><b>3–5 descargas reales</b> de «Ingresos y créditos»</li>
      <li class="mini"><b>Nombre y URL del sistema externo</b> · ¿tiene API?</li>
    </ul>
    <p class="mini" style="color:var(--ink-2);margin:1.4mm 0 0">Pueden venir anonimizados en
    los nombres, con la estructura de columnas intacta.</p>
  </div>

  <div class="card wa nada">
    <span class="rot" style="color:var(--warn)">De su lado, esta semana</span>
    <ol class="num" style="margin-top:1.4mm">
      <li class="mini">Aprobar o corregir el informe · sobre todo la estructura y el MVP</li>
      <li class="mini">Pedirle al cliente los tres accesos bloqueantes</li>
      <li class="mini">Agendar la reunión de N1, N2, N3, D1 y D2</li>
      <li class="mini">Rotar el token de n8n</li>
    </ol>
  </div>

  <div class="card ok nada">
    <span class="rot" style="color:var(--pos)">De nuestro lado, al aprobarse</span>
    <ol class="num" style="margin-top:1.4mm">
      <li class="mini">Analizar las muestras y documentar el mapeo real de columnas</li>
      <li class="mini"><b>Fase 1</b>: shell, navegación y Home · no espera nada del cliente</li>
      <li class="mini">Escribir las cuatro migraciones nuevas para revisión, <b>sin
      aplicarlas</b></li>
    </ol>
    <p style="font-family:var(--mono);font-size:8.4pt;font-weight:700;color:var(--pos);
              margin:1.8mm 0 0;padding-top:1.4mm;border-top:.6pt solid var(--pos-line)">
    APP CODE MODIFIED: NO</p>
  </div>
</div>"""))


# ═════════════════════════════════════════════════════════════════════════
#  Render
# ═════════════════════════════════════════════════════════════════════════

SALIDA_HTML.write_text(
    documento(
        "Nordelta · Arquitectura de producto · resumen",
        PAGINAS,
        pie="Nordelta · Arquitectura de producto · resumen",
    )
)
print(f"html  {SALIDA_HTML.relative_to(RAIZ)}  ({SALIDA_HTML.stat().st_size / 1e6:.1f} MB)")

subprocess.run(
    [
        CHROME, "--headless", "--disable-gpu", "--no-sandbox",
        "--no-pdf-header-footer", f"--print-to-pdf={SALIDA_PDF}",
        "--virtual-time-budget=20000", SALIDA_HTML.as_uri(),
    ],
    check=True, capture_output=True,
)
print(f"pdf   {SALIDA_PDF.relative_to(RAIZ)}  ({SALIDA_PDF.stat().st_size / 1e6:.1f} MB)"
      f"  ·  {len(PAGINAS)} páginas")

if DESTINO_PDF.parent.is_dir():
    DESTINO_PDF.write_bytes(SALIDA_PDF.read_bytes())
    print(f"copia {DESTINO_PDF}")
