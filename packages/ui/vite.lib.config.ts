import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import dts from "vite-plugin-dts";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dts({
      include: ["src/lib/**/*", "src/components/**/*", "src/dashboards/**/*"],
      exclude: ["**/*.test.*"],
      outDir: "dist/lib",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist/lib",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, "src/lib/index.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        assetFileNames: (asset) =>
          asset.name === "style.css" ? "styles.css" : "[name][extname]",
      },
    },
  },
});
