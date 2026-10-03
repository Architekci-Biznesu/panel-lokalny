import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * The worker runs without a request: no lib/session, no lib/auth and no
 * next/* anywhere in its import graph - direct or through other files, static
 * imports and dynamic import() alike. One entry point, worker/index.ts, so
 * the test covers every runner the worker reaches, including ones added later.
 */

const ROOT = path.resolve(__dirname, "..");
const ENTRY_POINTS = ["worker/index.ts"];

/** Runners the graph must reach - proves the walk really covers the worker. */
const MUST_REACH = [
  "features/publikacje/publish-job.ts",
  "features/publikacje/generate.ts",
  "features/wizytowka/audit-run.ts",
  "features/wizytowka/rank/run-scan.ts",
  "features/opinie/run-sync.ts",
  "features/opinie/draft-reviews.ts",
  "features/opinie/publish-reply.ts",
  "features/wizytowka/snapshots/refresh.ts",
  "features/maintenance/stale-runs.ts",
  "lib/integrations/gbp/publisher.ts",
];

const FORBIDDEN = [
  /^next(\/|$)/,
  /^@\/lib\/session$/,
  /^@\/lib\/auth$/,
  /^(\.\.?\/)+lib\/session$/,
  /^(\.\.?\/)+lib\/auth$/,
];

const IMPORT_RE =
  /(?:import|export)\s[^"']*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;

function resolveFile(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(ROOT, specifier.slice(2));
  else if (specifier.startsWith("."))
    base = path.resolve(path.dirname(from), specifier);
  else return null; // npm package
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    base,
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      return candidate;
  }
  return null;
}

const violations: string[] = [];
const seen = new Set<string>();

function visit(file: string, chain: string[]) {
  if (seen.has(file)) return;
  seen.add(file);
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(IMPORT_RE)) {
    const specifier = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (!specifier) continue;
    if (FORBIDDEN.some((rule) => rule.test(specifier))) {
      violations.push(
        `${[...chain, path.relative(ROOT, file)].join(" -> ")} importuje "${specifier}"`,
      );
    }
    const next = resolveFile(file, specifier);
    if (next) visit(next, [...chain, path.relative(ROOT, file)]);
  }
}

for (const entry of ENTRY_POINTS) visit(path.join(ROOT, entry), []);

assert.deepEqual(violations, [], `zakazane importy:\n${violations.join("\n")}`);
const reached = new Set([...seen].map((file) => path.relative(ROOT, file)));
const missing = MUST_REACH.filter((file) => !reached.has(file));
assert.deepEqual(
  missing,
  [],
  `graf importów workera nie obejmuje: ${missing.join(", ")}`,
);
console.log(`no-session imports test passed (${seen.size} files checked)`);
