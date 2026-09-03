import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Suite de integración contra un proyecto de Supabase REAL.
 *
 * Separada de la suite normal a propósito: `npm test` no debe depender de
 * una red ni de credenciales. Se corre con `npm run test:supabase`.
 */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/supabase/**/*.test.ts"],
    environment: "node",
    // Contra una base real las pruebas comparten estado: nada en paralelo.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
