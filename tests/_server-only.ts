/**
 * Reemplazo de `server-only` para los tests.
 *
 * El paquete real existe para que el bundler de Next falle si un módulo de
 * servidor se importa desde un componente cliente. Es una barrera de
 * compilación y no tiene comportamiento, así que en los tests se sustituye
 * por esto y la capa de datos queda ejercitable.
 */
export {};
