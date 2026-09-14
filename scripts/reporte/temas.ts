/**
 * De cambio técnico a lenguaje de proyecto.
 *
 * Este archivo es el corazón del reporte y conviene entender por qué está
 * hecho así. La tentación es generar la prosa desde los mensajes de commit,
 * y eso produce dos problemas: el cliente lee jerga («security_invoker»,
 * «matcher DNI→CUIT») y, peor, el generador termina **redactando** cosas
 * que nadie revisó.
 *
 * Acá la prosa está escrita de antemano y revisada. Lo que decide el
 * changelog es **cuáles frases aparecen y en qué orden**, no qué dicen.
 * Un tema entra al reporte si —y solo si— hubo commits en el período que
 * tocaron sus rutas. Nada se inventa: cada viñeta tiene commits detrás.
 *
 * Cuando una ruta no encaja en ningún tema, el generador la lista por
 * consola en lugar de ignorarla. Es la señal de que falta un tema nuevo.
 */

export interface Tema {
  id: string;
  /** La viñeta, tal cual la va a leer el cliente. */
  titulo: string;
  /** Qué rutas del repositorio pertenecen a este tema. */
  rutas: RegExp[];
  /**
   * Cuánto pesa para el cliente, de 1 a 10.
   *
   * Ordena el reporte cuando hay más temas que lugar. No es «cuánto
   * trabajo costó» sino «cuánto le importa a quien lo lee»: las pruebas
   * automáticas son críticas y van últimas a propósito.
   */
  peso: number;
}

export const TEMAS: Tema[] = [
  {
    id: "conciliacion",
    titulo:
      "Se amplió la conciliación automática de operaciones y la re-evaluación " +
      "diaria de las que quedan pendientes.",
    rutas: [/^src\/lib\/conciliacion\//, /^src\/lib\/operaciones\//, /^src\/lib\/servicios\//],
    peso: 10,
  },
  {
    id: "fullcarga",
    titulo:
      "Se automatizó la obtención y la lectura del informe diario de Fullcarga, " +
      "hasta ahora descargado y cruzado a mano.",
    rutas: [/^src\/lib\/fullcarga\//, /^src\/app\/\(app\)\/fullcarga\//],
    peso: 9,
  },
  {
    id: "planillas",
    titulo:
      "Se amplió la lectura y la validación de las planillas que envían los " +
      "clientes, con aviso de los errores antes de procesarlas.",
    rutas: [
      /^src\/lib\/planillas\//,
      /^src\/app\/\(app\)\/planillas\//,
      // Descargas de ejemplo: planilla e informe.
      /^src\/app\/api\//,
    ],
    peso: 7,
  },
  {
    id: "datos",
    titulo:
      "La aplicación pasó a trabajar contra la base de datos definitiva: las " +
      "planillas, las operaciones y su historial quedan guardados.",
    rutas: [/^src\/lib\/data\//, /^src\/lib\/supabase\//, /^supabase\/migrations\//],
    peso: 8,
  },
  {
    id: "seguridad",
    titulo:
      "Se implementó el ingreso con usuario y contraseña y el aislamiento de la " +
      "información por organización.",
    // `src/app/login/` es la ubicación anterior al reordenamiento de
    // rutas: los reportes de períodos viejos tienen que seguir clasificando.
    rutas: [/^src\/lib\/auth\//, /^src\/app\/\(auth\)\//, /^src\/app\/login\//, /^src\/proxy\.ts$/],
    peso: 8,
  },
  {
    id: "pantallas",
    titulo:
      "Se construyeron las pantallas de trabajo diario: conciliación, planillas, " +
      "clientes, cuentas y auditoría.",
    rutas: [
      /^src\/app\/\(app\)\//,
      /^src\/components\/(operaciones|shell|grid|ui)\//,
      /^src\/app\/globals\.css$/,
      /^src\/lib\/format\.ts$/,
    ],
    peso: 7,
  },
  {
    id: "portada",
    titulo: "Se publicó la página de acceso pública de Pagos Nordelta.",
    rutas: [
      /^src\/app\/\(marketing\)\//,
      /^src\/components\/marketing\//,
      // Ubicación anterior al reordenamiento de rutas.
      /^src\/app\/page\.tsx$/,
    ],
    peso: 5,
  },
  {
    id: "despliegue",
    titulo:
      "Se preparó el entorno de prueba en la nube para que el equipo pueda " +
      "entrar al sistema desde el navegador.",
    rutas: [/^vercel\.json$/, /^docs\/DESPLIEGUE\.md$/, /^scripts\//, /^tooling\//],
    peso: 7,
  },
  {
    id: "calidad",
    titulo:
      "Se ampliaron las pruebas automáticas que protegen los cálculos, los " +
      "permisos y el resultado de la conciliación.",
    rutas: [/^tests\//, /^vitest\.config/],
    peso: 4,
  },
  {
    id: "documentacion",
    titulo:
      "Se documentaron las reglas de negocio confirmadas y las decisiones que " +
      "siguen abiertas.",
    rutas: [/^docs\//],
    peso: 3,
  },
];

/** Rutas que no son trabajo de producto y no merecen aviso. */
const IRRELEVANTES = [
  /^package(-lock)?\.json$/,
  /^\.gitignore$/,
  /^(AGENTS|CLAUDE|CONTEXTO|LEEME|README|MVP_NEXT_LEVEL)\.md$/,
  /^next-env\.d\.ts$/,
  /^tsconfig/,
  /^eslint\.config/,
  /^postcss\.config/,
  /^next\.config/,
  /^supabase\/\.temp\//,
  /^reports\//,
];

export function temaDe(ruta: string): Tema | null {
  return TEMAS.find((t) => t.rutas.some((r) => r.test(ruta))) ?? null;
}

export function esIrrelevante(ruta: string): boolean {
  return IRRELEVANTES.some((r) => r.test(ruta));
}
