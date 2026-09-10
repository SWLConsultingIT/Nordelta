/**
 * Reemplazo de `server-only` para lo que corre fuera de Next.
 *
 * El paquete real existe para que el bundler falle si un módulo de
 * servidor se importa desde un componente cliente. Es una barrera de
 * compilación y no tiene comportamiento, pero **solo Next sabe
 * resolverlo**: los tests y los scripts se caen con MODULE_NOT_FOUND.
 *
 * Lo consumen dos: `vitest.config.mts` por alias y
 * `tsconfig.scripts.json` por `paths`. La aplicación sigue usando el
 * paquete real, así que la barrera no se debilita donde importa.
 */
export {};
