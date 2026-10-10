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
    b.onResolve({ filter: /^\.\/api$/ }, (a) => (a.importer.includes(`${path.sep}src${path.sep}client${path.sep}`) ? { path: r("src/demo/api.ts") } : undefined));
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

// The test build embeds migrations explicitly; fail loudly if one is missing.
const onDisk = fs.readdirSync(r("db/migrations")).filter((f) => f.endsWith(".sql")).sort();
const listed = [...fs.readFileSync(r("src/demo/migrations.ts"), "utf8").matchAll(/\["(\d+_[\w]+\.sql)"/g)].map((m) => m[1]);
if (JSON.stringify(onDisk) !== JSON.stringify(listed)) throw new Error(`src/demo/migrations.ts lists ${listed} but db/migrations has ${onDisk}`);

const result = await build({
  entryPoints: [r("src/demo/main.tsx")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minifySyntax: true,
  minifyWhitespace: true,
  minifyIdentifiers: false,
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
// Empty the folder in place (keeps any local static server pointed at it working).
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) fs.rmSync(path.join(out, f), { recursive: true, force: true });
fs.writeFileSync(
  path.join(out, "index.html"),
  `<title>London Life</title>
<style>html,body,#root{height:100%}body{background:#f4eee4}${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`,
);
// The engine's filesystem bundle ships under a .wasm name because artifacts only serve known web file types.
for (const [src, dest] of [["pglite.wasm", "pglite.wasm"], ["initdb.wasm", "initdb.wasm"], ["pglite.data", "pglite-fs.wasm"]]) {
  fs.copyFileSync(r(`node_modules/@electric-sql/pglite/dist/${src}`), path.join(out, dest));
}
const kb = (f) => `${Math.round(fs.statSync(path.join(out, f)).size / 1024)} KB`;
console.log("index.html", kb("index.html"), "| pglite.wasm", kb("pglite.wasm"), "| pglite-fs.wasm", kb("pglite-fs.wasm"));
