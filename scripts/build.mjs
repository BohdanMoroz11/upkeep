import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const result = await build({
  absWorkingDir: root,
  entryPoints: ["src/entry.mjs"],
  bundle: true,
  write: false,
  platform: "node",
  target: "node24",
  format: "cjs",
  minify: false,
  legalComments: "inline",
  banner: {
    js: `/* Bundled dependency: semver (ISC).\n${readFileSync(resolve(root, "node_modules/semver/LICENSE"), "utf8")}*/`,
  },
  plugins: [
    {
      name: "prompt-text",
      setup(build) {
        build.onResolve({ filter: /\.md\?raw$/ }, (args) => ({
          path: relative(root, resolve(args.resolveDir, args.path.replace(/\?raw$/, ""))),
          namespace: "prompt",
        }));
        build.onLoad({ filter: /.*/, namespace: "prompt" }, (args) => ({
          contents: readFileSync(resolve(root, args.path), "utf8"),
          loader: "text",
        }));
      },
    },
  ],
});
const path = resolve(root, "actions/controller/dist/index.cjs");
const source = result.outputFiles[0].text;
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== source)
    throw new Error("Controller bundle is stale; run npm run build");
} else {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
}
