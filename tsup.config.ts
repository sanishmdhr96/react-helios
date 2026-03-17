import { defineConfig } from "tsup";
import fs from "fs";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: {
    compilerOptions: {
      incremental: false,
    },
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  minify: true,
  treeshake: true,
  outDir: "dist",
  esbuildOptions(options) {
    options.banner = { js: '"use client";' };
  },
  onSuccess: async () => {
    // Bundle all CSS into a single dist/styles.css
    const cssFiles = [
      "src/styles/VideoPlayer.css",
      "src/styles/Controls.css",
      "src/styles/ControlElements.css",
      "src/styles/ProgressBar.css",
      "src/styles/AudioMode.css",
    ].filter(fs.existsSync);

    if (cssFiles.length > 0) {
      const bundled = cssFiles
        .map((f) => fs.readFileSync(f, "utf-8"))
        .join("\n\n");
      fs.mkdirSync("dist", { recursive: true });
      fs.writeFileSync("dist/styles.css", bundled);
      console.log("✅  CSS bundled → dist/styles.css");
    }
  },
});
