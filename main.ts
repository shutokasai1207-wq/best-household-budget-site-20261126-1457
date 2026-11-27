// main.ts — HomeLedger entry program (Node 22, standard library only).
//
// Copies app/ and screenshots/ from this repository into the output
// directory, then builds dossier.json with buildDossier from
// vendor/makefun-frontend.ts. The output directory comes from
// MAKEFUN_OUTPUT_DIR, defaulting to /output. It never deletes the
// output directory itself — it only creates it and writes into it.

import { buildDossier } from "./vendor/makefun-frontend.ts";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Anchor all source paths to this script's directory, so the program
// works no matter which directory the grader runs it from.
const repoRoot = new URL(".", import.meta.url).pathname;

if (!existsSync(join(repoRoot, "app")) || !existsSync(join(repoRoot, "app", "index.html"))) {
  throw new Error("app/index.html not found.");
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// Create the output directory (and parents) if needed. Never remove it.
mkdirSync(outDir, { recursive: true });

// Copy the site and the screenshots into the output directory.
cpSync(join(repoRoot, "app"), join(outDir, "app"), { recursive: true });
const shotsDir = join(repoRoot, "screenshots");
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, "screenshots"), { recursive: true });
}

// Build the dossier and write it into the output directory.
const dossier = await buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots_max: 4,
  screenshot_max_bytes: 262144,
  app_max_entries: 993,
  app_max_bytes: 16777216,
});
writeFileSync(join(outDir, "dossier.json"), dossier);
