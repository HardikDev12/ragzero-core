import path from "node:path";

/** @type {string | null} */
let override = null;

/**
 * Override the storage root (documents + llm-cache). Clears override when `null` or `""`.
 * Default: `VECTORLESS_DATA_DIR` env, else `<cwd>/data/vectorless-rag`.
 * @param {string | null | undefined} dir
 */
export function setDataDir(dir) {
  if (dir == null || dir === "") {
    override = null;
    return;
  }
  override = path.resolve(String(dir));
}

/** Resolved storage directory for this process. */
export function getDataDir() {
  if (override) return override;
  const env = process.env.VECTORLESS_DATA_DIR?.trim();
  if (env) return path.resolve(env);
  return path.join(process.cwd(), "data", "vectorless-rag");
}
