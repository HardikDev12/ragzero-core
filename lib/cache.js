import fs from "node:fs";
import path from "node:path";
import { getDataDir } from "./paths.js";

function cacheFilePath() {
  return path.join(getDataDir(), "llm-cache.json");
}

export function loadCache() {
  const p = cacheFilePath();
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function saveCache(cache) {
  const p = cacheFilePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cache, null, 2), "utf8");
}

/** Remove cached LLM summaries for one document (e.g. after force re-ingest). */
export function clearDocCache(docId) {
  const cache = loadCache();
  const prefix = `${docId}:`;
  let changed = false;
  for (const k of Object.keys(cache)) {
    if (k.startsWith(prefix)) {
      delete cache[k];
      changed = true;
    }
  }
  if (changed) saveCache(cache);
}
