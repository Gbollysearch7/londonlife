// Builds the standalone test build: one HTML page plus the in-browser Postgres engine files.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "dist-test");
const r = (p) => path.join(root, p);

const swap = {
  name: "test-build-swaps",
  setup(b) {
    b.onResolve({ filter: /^@\/client\/api$/ }, () => ({ path: r("src/demo/api.ts") }));
    b.onResolve({ filter: /^\.\/db$/ }, (a) => (a.importer.includes(`${path.sep}src${path.sep}server${path.sep}`) ? { path: r("src/demo/db.ts") } : undefined));
    b.onResolve({ filter: /^node:crypto$/ }, () => ({ path: r("src/demo/cryptoShim.ts") }));
    b.onResolve({ filter: /^next\/dynamic$/ }, () => ({ path: r("src/demo/nextDynamicShim.tsx") }));
    // Node built-ins referenced by PGlite's Node code paths are never used in the browser.
    b.onResolve({ filter: /^(node:)?(fs|path|url|module|crypto|child_process|worker_threads|os|fs\/promises)$/ }, (a) =>
      a.path === "node:crypto" ? undefined : { path: a.path, namespace: "empty" },
    );
    b.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "module.exports = {};", loader: "js" }));
    b.onResolve({ filter: /^@\// }, (a) => b.resolve("./" + a.path.slice(2), { resolveDir: r("src"), kind: a.kind }));
  },
};

const result = await build({
  entryPoints: [r("src/demo/main.tsx")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  write: false,
  outdir: out,
  jsx: "automatic",
  loader: { ".sql": "text", ".module.css": "local-css", ".css": "css" },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.LL_TEST_BUILD_TIME_SCALE": '"20"',
    "process.env.LL_TIME_SCALE": '"1"',
  },
  plugins: [swap],
  logLevel: "warning",
});

const js = result.outputFiles.find((f) => f.path.endsWith(".js")).text.replace(/<\/script/gi, "<\\/script");
const css = result.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "";
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
fs.writeFileSync(
  path.join(out, "index.html"),
  `<title>London Life</title>
<style>html,body,#root{height:100%}body{background:#f4eee4}${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`,
);
for (const f of ["pglite.wasm", "initdb.wasm", "pglite.data"]) {
  fs.copyFileSync(r(`node_modules/@electric-sql/pglite/dist/${f}`), path.join(out, f));
}
const kb = (f) => `${Math.round(fs.statSync(path.join(out, f)).size / 1024)} KB`;
console.log("index.html", kb("index.html"), "| pglite.wasm", kb("pglite.wasm"), "| pglite.data", kb("pglite.data"));
