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

if (!existsSync("app") || !existsSync("app/index.html")) {
  throw new Error("app/index.html not found — run main.ts from the repository root.");
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// Create the output directory (and parents) if needed. Never remove it.
mkdirSync(outDir, { recursive: true });

// Copy the site and the screenshots into the output directory.
cpSync("app", join(outDir, "app"), { recursive: true });
if (existsSync("screenshots")) {
  cpSync("screenshots", join(outDir, "screenshots"), { recursive: true });
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
