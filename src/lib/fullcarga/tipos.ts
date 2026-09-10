/**
 * Contrato del descargador.
 *
 * La interfaz existe para separar **transporte** de todo lo que venga
 * después. Quien consuma un informe no debería enterarse de si lo bajó un
 * cliente HTTP, un navegador automatizado, o Mati a mano: recibe un
 * `InformeDescargado` y listo.
 *
 * Nombres, para cruzarlos con el encargo:
 *   `Descargador`      ←→ FullcargaDownloader
 *   `DescargadorHTTP`  ←→ HTTPFullcargaDownloader
 *   `InformeDescargado`←→ DownloadedReport
 */

export type FormatoInforme = "XLS";

export interface PedidoDeInforme {
  /** Fecha ISO `YYYY-MM-DD`. La conversión a `DD-MM-YYYY` es interna. */
  desde: string;
  hasta: string;
  formato?: FormatoInforme;
  /** Filtros del formulario. Vacío = sin filtrar, que es lo que hace Mati. */
  filtros?: Readonly<Record<string, string>>;
}

/**
 * Lo que se obtuvo.
 *
 * **No expone cookies, contraseña ni token, y no tiene por dónde hacerlo:**
 * no hay ningún campo donde alojarlos. Hay un test que lo verifica sobre las
 * claves del objeto, para que agregarlos en el futuro rompa la suite.
 */
export interface InformeDescargado {
  bytes: Buffer;
  /** Nombre saneado, listo para escribir en disco. */
  filename: string;
  contentType: string;
  /** Fecha ISO pedida, tal como la recibió el descargador. */
  requestedFrom: string;
  requestedTo: string;
  /** Instante de la descarga, en ISO 8601. */
  downloadedAt: string;
  sha256: string;
  /** Qué resultó ser el archivo según su firma. */
  formatoDetectado: "xls" | "xlsx";
  tamanoBytes: number;
}

export interface Descargador {
  descargarInforme(pedido: PedidoDeInforme): Promise<InformeDescargado>;
}
