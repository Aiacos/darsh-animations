/**
 * Aucun cycle d'imports dans `module/scripts/` : deux fichiers qui s'importent l'un l'autre ne tiennent que tant qu'aucun des deux
 * ne lit l'autre à son chargement, et l'ordre d'évaluation dépend alors du premier importé.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = join(import.meta.dirname, "../module/scripts");
const walk = dir => readdirSync(dir).flatMap(name => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : (name.endsWith(".mjs") ? [full] : []);
});
const IMPORT = /^\s*(?:import|export)\s[^;]*?from\s*["'](\.[^"']+)["']/gm;

describe("imports", () => {
  it("aucun cycle", () => {
    const files = walk(ROOT);
    const graph = new Map(files.map(f => [f, [...readFileSync(f, "utf8").matchAll(IMPORT)].map(m => resolve(dirname(f), m[1]))]));
    const cycles = new Set();
    const state = new Map();   // 1 : en cours de visite, 2 : visité
    const visit = (file, stack) => {
      if ( state.get(file) === 2 ) return;
      if ( state.get(file) === 1 ) {
        cycles.add(stack.slice(stack.indexOf(file)).map(f => relative(ROOT, f)).join(" → "));
        return;
      }
      state.set(file, 1);
      for ( const next of graph.get(file) ?? [] ) visit(next, [...stack, file]);
      state.set(file, 2);
    };
    for ( const file of files ) visit(file, []);
    expect([...cycles]).toEqual([]);
  });
});
