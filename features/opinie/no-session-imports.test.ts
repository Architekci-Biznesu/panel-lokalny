import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * The review jobs must run without a request: no lib/session, no lib/auth and
 * no next/* anywhere in their STATIC import graph (direct or through other
 * files), so Phase 5 can move them to a worker unchanged. Dynamic import()
 * calls are not followed - none exist on these paths.
 */

const ROOT = path.resolve(__dirname, "../..");
const ENTRY_POINTS = [
  "features/opinie/run-sync.ts",
  "features/opinie/draft-reviews.ts",
  "features/opinie/publish-reply.ts",
  "features/opinie/sync-control.ts",
];

const FORBIDDEN = [
  /^next(\/|$)/,
  /^@\/lib\/session$/,
  /^@\/lib\/auth$/,
  /^(\.\.?\/)+lib\/session$/,
  /^(\.\.?\/)+lib\/auth$/,
];

const IMPORT_RE =
  /(?:import|export)\s[^"']*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g;

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
    const specifier = match[1] ?? match[2];
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
assert.ok(
  seen.size > 10,
  "graf importów wygląda na pusty - test nic nie sprawdza",
);
console.log(`no-session imports test passed (${seen.size} files checked)`);
