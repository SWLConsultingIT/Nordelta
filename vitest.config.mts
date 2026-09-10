import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` solo existe dentro del bundler de Next. Es un guardián
      // de compilación, no código: para los tests se reemplaza por un módulo
      // vacío y así la capa de datos se puede ejercitar de verdad.
      "server-only": path.resolve(import.meta.dirname, "tests/_server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: { include: ["src/lib/**"], reporter: ["text-summary"] },
  },
});
