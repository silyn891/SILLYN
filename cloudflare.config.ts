import { bindings, defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "sillyn-gestionale",
    entrypoint: "vinext/server/app-router-entry",
    compatibilityDate: "2026-11-02",
    compatibilityFlags: ["nodejs_compat"],
    env: {
      DB: bindings.d1({ name: "sillyn-db" }),
      FILES: bindings.r2({ name: "sillyn-files" }),
    },
  },
});
