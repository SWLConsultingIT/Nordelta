/**
 * El recurso gráfico de la portada.
 *
 * Un haz de líneas que entra por la izquierda, converge y sale de la
 * pantalla por la derecha. No está encerrado en ninguna caja y no es el
 * protagonista: vive en blanco a muy baja opacidad sobre el azul, detrás de
 * la composición.
 *
 * Por qué una forma y no el producto: mostrar la aplicación de verdad
 * publica cómo trabaja la empresa, y dibujar una aplicación falsa con datos
 * inventados miente. Un haz de líneas no representa ningún dato, no se puede
 * leer mal y no envejece con el producto.
 *
 * No renderiza texto ni números. Los números son coordenadas de dibujo y
 * viven dentro de atributos.
 */

/** Las seis trayectorias. La cuarta es la que va marcada. */
const LINEAS = [
  "M-60 24 C 320 24, 400 92, 720 92 S 1000 170, 1320 170",
  "M-60 92 C 300 92, 420 148, 760 148 S 1010 198, 1320 198",
  "M-60 170 C 340 170, 440 194, 780 194 S 1020 226, 1320 226",
  "M-60 256 C 320 256, 440 240, 780 240 S 1020 254, 1320 254",
  "M-60 340 C 300 340, 440 294, 760 294 S 1020 282, 1320 282",
  "M-60 414 C 320 414, 460 346, 800 346 S 1030 310, 1320 310",
];

/** Donde una trayectoria cambia de dirección. */
const NODOS: { x: number; y: number; marcado?: boolean }[] = [
  { x: 720, y: 92 },
  { x: 760, y: 148 },
  { x: 780, y: 240, marcado: true },
  { x: 760, y: 294 },
];

export function Flujo() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1260 440"
      preserveAspectRatio="xMaxYMid slice"
      className="h-full w-full"
    >
      <g fill="none" stroke="#FFFFFF" strokeOpacity="0.13" strokeWidth="1">
        {LINEAS.map((d, i) => i !== 3 && <path key={i} d={d} />)}
      </g>

      {/* Una sola línea sube de intensidad. El acento de la página es el
          blanco: no hay un segundo color que lo haga por él. */}
      <path
        d={LINEAS[3]}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.5"
        strokeWidth="1.25"
      />

      {NODOS.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r="2.75"
          fill="#FFFFFF"
          fillOpacity={n.marcado ? "0.85" : "0.3"}
        />
      ))}
    </svg>
  );
}
