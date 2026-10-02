import { createLogger, defineConfig } from "vite";
import path from "node:path";

const vendor = path.resolve(import.meta.dirname, "src/vendor/forgeng");

const logger = createLogger();
const defaultWarn = logger.warn.bind(logger);
const defaultWarnOnce = logger.warnOnce.bind(logger);
const defaultError = logger.error.bind(logger);
const isVendorSourceMapNoise = (message: string) =>
  /source\s?map/i.test(message) && /src[\\/]vendor[\\/]forgeng/i.test(message);

logger.warn = (message, options) => {
  if (!isVendorSourceMapNoise(message)) defaultWarn(message, options);
};
logger.warnOnce = (message, options) => {
  if (!isVendorSourceMapNoise(message)) defaultWarnOnce(message, options);
};
logger.error = (message, options) => {
  if (!isVendorSourceMapNoise(message)) defaultError(message, options);
};

export default defineConfig({
  base: "./",
  customLogger: logger,
  resolve: {
    alias: {
      forgeng: path.join(vendor, "forge.esm.js"),
      "@forgeng/ui-dom": path.join(vendor, "ui-dom.esm.js"),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
