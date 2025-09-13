import esbuild from "esbuild";
import { readFileSync } from "fs";

const isWatch = process.argv.includes("--watch");

const banner = {
  js: readFileSync("banner.js", "utf8"),
};

await esbuild
  .build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    external: ["obsidian"],
    format: "cjs",
    platform: "node",
    target: "es2020",
    outfile: "main.js",
    sourcemap: isWatch ? "inline" : false,
    banner,
  })
  .catch(() => process.exit(1));

