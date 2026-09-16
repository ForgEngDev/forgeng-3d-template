import { defineConfig } from "vite";
import path from "node:path";

const sdk = path.resolve("C:/Users/lapon/Desktop/forgeng.dev/ForgeNG-3.0.0/packages");

/** Jednokratni build: DomUiShell → src/vendor/forgeng/ui-dom.esm.js */
export default defineConfig({
  build: {
    lib: {
      entry: path.join(sdk, "ui-dom/src/index.ts"),
      formats: ["es"],
      fileName: () => "ui-dom.esm.js",
    },
    outDir: path.resolve("src/vendor/forgeng"),
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      // sve zavisnosti u jedan fajl
      external: [],
    },
  },
  resolve: {
    alias: {
      "@forgeng/contracts/ui": path.join(sdk, "contracts/src/ui/index.ts"),
      "@forgeng/contracts/storage": path.join(sdk, "contracts/src/storage/index.ts"),
      "@forgeng/kernel/lifecycle": path.join(sdk, "kernel/src/lifecycle/index.ts"),
    },
  },
});
