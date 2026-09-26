#!/usr/bin/env node
// Strażnik porządku w stylach (npm run lint:css).
//
// Błędy (exit 1):
//   - kolor zapisany na sztywno (#hex) poza styles/tokens.css
//   - plik styles/*.css niezaimportowany w app/globals.css
//   - reguły komponentów bezpośrednio w app/globals.css (ma zawierać tylko importy i @theme)
// Ostrzeżenia:
//   - klasa spoza prefiksów modułu (np. .rank-* w wizytowka.css) - styl trafił do złego pliku
//   - ten sam selektor zdefiniowany w dwóch plikach (w tym samym @media)
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";

const ROOT = process.cwd();
const STYLES = path.join(ROOT, "styles");
const GLOBALS = path.join(ROOT, "app/globals.css");

// Prefiksy klas dozwolone jako pierwsza klasa selektora w danym pliku.
// Nowy moduł: dodaj wpis z prefiksem modułu (np. publikacje: ["pub-"]).
const PREFIXES = {
  tokens: [],
  base: [],
  ui: [
    "ui-",
    "mono",
    "banner",
    "locked-note",
    "page-header",
    "sr-only",
    "brand-logo",
  ],
  shell: ["app-", "topnav", "profile-", "placeholder"],
  auth: [
    "split-",
    "auth-",
    "path-toggle",
    "google-connect",
    "gbp-connect",
    "onboarding-",
    "location-",
    "brief-",
    "regen-",
    "trust-",
    "auto-resize",
  ],
  wizytowka: ["wiz-", "gbp-preview"],
  raporty: ["rank-", "wiz-report", "wiz-range", "leaflet-"],
  pulpit: ["pulpit-"],
  admin: ["admin-"],
  ustawienia: ["kontekst-", "ustawienia-"],
};

const errors = [];
const warnings = [];
const files = fs.readdirSync(STYLES).filter((f) => f.endsWith(".css"));
const globals = fs.readFileSync(GLOBALS, "utf8");

for (const f of files) {
  if (!globals.includes(`../styles/${f}`))
    errors.push(`styles/${f} nie jest zaimportowany w app/globals.css`);
}

const gAst = postcss.parse(globals);
gAst.walkRules((r) => {
  if (r.parent.type === "atrule" && r.parent.name === "theme") return;
  errors.push(
    `app/globals.css: reguła "${r.selector}" - przenieś do odpowiedniego pliku w styles/`,
  );
});

const seen = new Map();
for (const f of files) {
  const mod = f.replace(/\.css$/, "");
  const src = fs.readFileSync(path.join(STYLES, f), "utf8");
  const ast = postcss.parse(src, { from: f });
  if (mod !== "tokens") {
    ast.walkDecls((d) => {
      const m = d.value.match(/#[0-9a-fA-F]{3,8}\b/);
      if (m)
        errors.push(
          `styles/${f}:${d.source.start.line} kolor ${m[0]} na sztywno - użyj tokenu z styles/tokens.css`,
        );
    });
  }
  ast.walkRules((r) => {
    if (r.parent.type === "atrule" && /keyframes/.test(r.parent.name)) return;
    const media = [];
    let p = r.parent;
    while (p && p.type !== "root") {
      if (p.type === "atrule" && p.name !== "layer") media.unshift(p.params);
      p = p.parent;
    }
    for (const sel of r.selectors) {
      const first = (sel.match(/\.([A-Za-z0-9_-]+)/) || [])[1];
      const allowed = PREFIXES[mod];
      if (
        first &&
        allowed &&
        allowed.length &&
        !allowed.some((x) => first === x || first.startsWith(x))
      ) {
        warnings.push(
          `styles/${f}:${r.source.start.line} .${first} - klasa spoza prefiksów modułu "${mod}"`,
        );
      }
      const key = media.join(" && ") + " | " + sel.trim().replace(/\s+/g, " ");
      if (seen.has(key) && seen.get(key) !== f)
        warnings.push(
          `selektor "${sel.trim()}" zdefiniowany w styles/${seen.get(key)} i styles/${f}`,
        );
      else seen.set(key, f);
    }
  });
}

for (const w of warnings) console.warn("uwaga:", w);
for (const e of errors) console.error("błąd:", e);
console.log(
  `styles: ${files.length} plików, ${errors.length} błędów, ${warnings.length} ostrzeżeń`,
);
process.exit(errors.length ? 1 : 0);
