import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node20",
  shims: true,
  splitting: false,
  // package.json's "bin" entry points at dist/index.js. Without a shebang,
  // /bin/sh tries to exec the CJS bundle as a shell script (fails on first
  // parenthesis). Prepend the node shebang on both CJS and ESM outputs.
  banner: {
    js: "#!/usr/bin/env node",
  },
});
