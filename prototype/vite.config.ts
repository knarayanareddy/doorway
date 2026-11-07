import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  server: { fs: { allow: [path.resolve(__dirname, "..")] } },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // The prototype imports the REAL core (counter, shift, route, hours, copy) instead of a port,
      // so it cannot drift from what the Door ships.
      "@repo": path.resolve(__dirname, ".."),
    },
  },
});
