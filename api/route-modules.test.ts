import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

// Every other test here imports routes through tsx, which forgives an extensionless relative
// import ("../lib/foo"). Production does not: this repo is "type": "module", and Vercel compiles
// each api/*.ts file to its own .js without bundling, so plain Node ESM resolves the import
// verbatim and "../lib/foo" is ERR_MODULE_NOT_FOUND at load — every request 500s with
// FUNCTION_INVOCATION_FAILED before the handler runs. That is exactly how /api/invite-preview
// shipped broken. These tests rebuild that shape (per-file transpile, specifiers untouched) and
// load each route in a child `node` with no tsx loader.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// api/globals.d.ts narrows `process` to env only (edge-safe); the test needs the real binary.
const NODE = (process as unknown as { execPath: string }).execPath;
const HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

function routeFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return routeFiles(path);
    return /\.ts$/.test(entry.name) && !/\.(test|d)\.ts$/.test(entry.name) ? [path] : [];
  });
}

function relativeSpecifiers(source: string): string[] {
  return [...source.matchAll(/\bfrom\s+["'](\.{1,2}\/[^"']+)["']/g)].map((m) => m[1]);
}

// A throwaway build dir whose node_modules links to the repo's, so bare imports
// (@supabase/supabase-js, ...) resolve exactly as on Vercel.
const OUT = mkdtempSync(join(tmpdir(), "reps-web-route-modules-"));
after(() => {
  // Drop the link on its own first so the recursive delete can never walk into the real node_modules.
  rmSync(join(OUT, "node_modules"), { force: true });
  rmSync(OUT, { recursive: true, force: true });
});
writeFileSync(join(OUT, "package.json"), JSON.stringify({ type: "module" }));
symlinkSync(join(ROOT, "node_modules"), join(OUT, "node_modules"), "junction");

/** Transpile a route and its relative imports (.js specifiers map back to .ts sources). */
function emit(file: string, seen = new Set<string>()): void {
  if (seen.has(file)) return;
  seen.add(file);
  const source = readFileSync(join(ROOT, file), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const outFile = join(OUT, file.replace(/\.ts$/, ".js"));
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, js);
  for (const spec of relativeSpecifiers(source)) {
    const target = relative(ROOT, resolve(ROOT, dirname(file), spec)).replace(/\\/g, "/");
    // A missing extension is left for Node to reject below; only follow resolvable sources.
    if (target.endsWith(".js")) emit(target.replace(/\.js$/, ".ts"), seen);
  }
}

/** Runs `body` as an ES module in a plain Node child (no tsx), with `mod` = the loaded route. */
function runInNode(file: string, body: string, env: Record<string, string> = {}): string {
  const url = pathToFileURL(join(OUT, file.replace(/\.ts$/, ".js"))).href;
  const script = `const mod = await import(${JSON.stringify(url)});\n${body}`;
  const cleanEnv: Record<string, string | undefined> = { ...process.env, ...env };
  delete cleanEnv.NODE_OPTIONS; // tsx registers its loader here; production has none
  if (!("SUPABASE_URL" in env)) delete cleanEnv.SUPABASE_URL;
  if (!("SUPABASE_SERVICE_ROLE_KEY" in env)) delete cleanEnv.SUPABASE_SERVICE_ROLE_KEY;
  return execFileSync(NODE, ["--input-type=module", "-e", script], {
    cwd: OUT,
    env: cleanEnv,
    encoding: "utf8",
  });
}

const ROUTES = routeFiles("api");

describe("api routes load under plain Node ESM, the way Vercel runs them", () => {
  test("every relative import in a route names its .js file", () => {
    for (const file of ROUTES) {
      for (const spec of relativeSpecifiers(readFileSync(join(ROOT, file), "utf8"))) {
        assert.match(spec, /\.js$/, `${file}: import "${spec}" must end in .js or Node cannot load it`);
      }
    }
  });

  for (const file of ROUTES) {
    test(`${file} loads and exports function handlers`, () => {
      emit(file);
      const out = runInNode(
        file,
        `const methods = ${JSON.stringify(HTTP_METHODS)}.filter((m) => m in mod);
         if (methods.length === 0 && typeof mod.default !== "function") throw new Error("no handler export");
         for (const m of methods) if (typeof mod[m] !== "function") throw new Error(m + " is not a function");
         console.log("ok");`,
      );
      assert.equal(out.trim(), "ok");
    });
  }
});

describe("api/invite-preview.ts as deployed (real wiring, plain Node)", () => {
  const FILE = "api/invite-preview.ts";
  const call = (queries: string[]) => `
    const out = [];
    for (const q of ${JSON.stringify(queries)}) {
      const res = await mod.GET(new Request("https://getreps.io/api/invite-preview" + q));
      out.push({ q, status: res.status, body: await res.json() });
    }
    console.log(JSON.stringify(out));`;
  const GENERIC = { first_name: null, avatar_url: null };

  test("no env configured: malformed and well-formed codes both get the generic 200", () => {
    emit(FILE);
    const results = JSON.parse(runInNode(FILE, call(["?code=bad", "", "?code=ABCD2345"])));
    for (const r of results) {
      assert.equal(r.status, 200, r.q);
      assert.deepEqual(r.body, GENERIC, r.q);
    }
  });

  test("configured env + a public inviter: personalised body, first name and avatar only", () => {
    emit(FILE);
    const project = "https://example.supabase.co";
    const avatar = `${project}/storage/v1/object/public/avatars/sam.jpg`;
    // Stub the network before the route's first request; the env is read at module load.
    const stubFetch = `globalThis.fetch = async (url) => {
      if (!String(url).endsWith("/rest/v1/rpc/get_invite_preview")) throw new Error("unexpected fetch " + url);
      return new Response(JSON.stringify({ first_name: "Sam Smith", avatar_url: ${JSON.stringify(avatar)}, email: "x@y.z" }), { status: 200 });
    };`;
    const results = JSON.parse(
      runInNode(FILE, stubFetch + call(["?code=ABCD2345", "?code=bad"]), {
        SUPABASE_URL: project,
        SUPABASE_SERVICE_ROLE_KEY: "test-key",
      }),
    );
    assert.deepEqual(results[0], { q: "?code=ABCD2345", status: 200, body: { first_name: "Sam", avatar_url: avatar } });
    assert.deepEqual(results[1], { q: "?code=bad", status: 200, body: GENERIC });
  });
});
