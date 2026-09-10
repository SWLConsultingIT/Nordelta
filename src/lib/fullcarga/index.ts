/**
 * POC de descarga del informe de Fullcarga.
 *
 * Módulo **aislado**: no importa nada de `data/`, `supabase/`, `domain/` ni
 * de la interfaz, y nada de la aplicación lo importa a él. Lo usan un script
 * de línea de comandos y sus tests, y nada más.
 *
 * Alcance: autenticarse, pedir el informe de un rango de fechas y traer el
 * XLS validado. **No parsea el contenido del informe.** El parseo de
 * acreditaciones es otro módulo y otra discusión.
 */

export { DescargadorHTTP, COOKIE_SESION } from "./descargador";
export type { Descargador, InformeDescargado, PedidoDeInforme, FormatoInforme } from "./tipos";
export {
  leerConfiguracion,
  hayCredenciales,
  describir,
  BASE_POR_DEFECTO,
  RUTAS,
  type ConfiguracionFullcarga,
} from "./config";
export {
  ErrorFullcarga,
  FullcargaConfigurationError,
  FullcargaNetworkError,
  FullcargaAuthenticationError,
  FullcargaSessionExpiredError,
  FullcargaTokenError,
  FullcargaReportGenerationError,
  FullcargaDownloadError,
  FullcargaInvalidReportError,
  type CodigoFullcarga,
} from "./errores";
export { aFormatoFullcarga, esFechaCalendario, rangoFullcarga } from "./fechas";
export {
  camposOcultos,
  camposDelFormulario,
  extraerTokenStruts,
  esPantallaDeIngreso,
  CAMPO_NOMBRE_TOKEN,
} from "./formulario";
export {
  detectarFormato,
  esAttachment,
  nombreArchivoLocal,
  nombreDeContentDisposition,
  sanearNombre,
  sha256,
  validarInforme,
  contentTypeRazonable,
  type FormatoDetectado,
} from "./descarga";
export {
  registradorConsola,
  registradorMudo,
  redactar,
  seguro,
  CHECKPOINTS,
  PASOS,
  PREFIJO,
  type Registrador,
} from "./redaccion";
export { FrascoDeCookies } from "./cookies";
export { ClienteHTTP } from "./http";

/* ── Parser del informe (POC 2) ─────────────────────────────── */
export { leerLibro, extraerWorkbook, clave, type Hoja, type ValorCelda } from "./xls";
export {
  analizarCuit,
  normalizarCuit,
  tieneFormatoCuit,
  verificaDigito,
  digitoVerificador,
  digitosDiferentes,
  cuitsParecidos,
  type Cuit,
  type EstadoCuit,
  type Parecido,
} from "./cuit";
export {
  leerObservacion,
  fechaDeObservacion,
  candidatosACuit,
  operacionDeObservacion,
  OPERACIONES_CONOCIDAS,
  type ObservacionLeida,
  type PatronObservacion,
} from "./observacion";
export {
  parsearInforme,
  acreditacionesConciliables,
  medirCobertura,
  clasificarFila,
  fechaDeCelda,
  COLUMNAS,
  CLASIFICACIONES_ACREDITACION,
  type InformeParseado,
  type FilaInforme,
  type Acreditacion,
  type Clasificacion,
  type Cobertura,
} from "./informe";
export {
  emparejar,
  emparejarLote,
  diferenciaEnDias,
  type Enviada,
  type Resultado,
  type Veredicto,
  type ResumenMatching,
} from "./matching";
