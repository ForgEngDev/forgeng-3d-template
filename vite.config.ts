import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      forgeng: path.resolve(import.meta.dirname, "src/vendor/forgeng/forge.esm.js"),
      "@forgeng/ui-dom": path.resolve(import.meta.dirname, "src/vendor/forgeng/ui-dom.esm.js"),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
