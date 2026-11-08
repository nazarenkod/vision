import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "fs";

// The content security policy nginx sends (052), from the same template, for the API the tests
// mock: Playwright runs the whole interface under it.
const apiUrl = process.env.REACT_APP_API_URL ?? "http://localhost:4200";
const apiOrigin = new URL(apiUrl).origin;
// Only the preview server sends it: the image's build stage has no nginx/ and needs none.
const CSP_TEMPLATE = "nginx/csp.template";
const contentSecurityPolicy = existsSync(CSP_TEMPLATE)
  ? readFileSync(CSP_TEMPLATE, "utf8")
      .trim()
      .replaceAll("${API_ORIGIN}", apiOrigin)
      .replaceAll("${API_WS_ORIGIN}", apiOrigin.replace(/^http/, "ws"))
  : undefined;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Allow using "npm link" for packages when developing, that are in different base path
      strict: false,
    },
  },
  preview: contentSecurityPolicy
    ? { headers: { "Content-Security-Policy": contentSecurityPolicy } }
    : {},
  optimizeDeps: {
    // Dependencies to pre-bundle
  },
  build: {
    outDir: "build",
    sourcemap: true,
    assetsInlineLimit: 0, // disable inlining assets

    // When false, all CSS will be extracted into a single CSS file.
    cssCodeSplit: false,
  },
});
