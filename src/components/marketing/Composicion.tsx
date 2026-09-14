/**
 * La pieza visual de la portada.
 *
 * No es una captura del producto ni una ilustración: es una placa de marca.
 * La decisión importa y vale explicarla, porque acá ya se probaron las otras
 * dos y las dos fallaron.
 *
 * Mostrar la aplicación de verdad publica cómo trabaja la empresa, y además
 * arrastra la portada hacia la estética de un producto de software, que no
 * es lo que Nordelta es. Dibujar una aplicación falsa —tablas con datos
 * inventados— miente, y se nota.
 *
 * Queda la tercera: una forma. Arcos concéntricos que se abren desde un
 * núcleo sólido, en el registro de una marca financiera. No representa un
 * dato, no se puede leer mal, y no envejece con el producto.
 *
 * No renderiza texto ni números: lo que hay son coordenadas de dibujo, y
 * viven dentro de atributos.
 */

export function Emblema() {
  return (
    <div aria-hidden className="relative w-full overflow-hidden rounded-[3px] bg-navy">
      {/* Cuadrado exacto, sin depender de la altura del contenido. */}
      <div className="pt-[100%]" />
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
        {/* El núcleo. Da la masa que equilibra al titular del otro lado. */}
        <path d="M400 400H268A132 132 0 0 1 400 268Z" fill="var(--color-navy-3)" />

        {/* Los arcos que se abren desde el núcleo. */}
        <g fill="none" stroke="var(--color-on-navy)" strokeOpacity="0.17">
          <path d="M400 196A204 204 0 0 0 196 400" strokeWidth="1.25" />
          <path d="M400 124A276 276 0 0 0 124 400" strokeWidth="1.25" />
          <path d="M400 52A348 348 0 0 0 52 400" strokeWidth="1.25" />
        </g>

        {/* El verde aparece una sola vez. En el registro financiero el
            color es excepción, no decoración. */}
        <path
          d="M400 160A240 240 0 0 0 160 400"
          fill="none"
          stroke="#2B8462"
          strokeWidth="2.5"
        />
      </svg>
    </div>
  );
}
