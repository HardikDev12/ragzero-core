import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDataDir } from "./paths.js";

export function docIdFromUrl(url) {
  return crypto.createHash("sha256").update(String(url).trim()).digest("hex").slice(0, 24);
}

export function documentPath(docId) {
  return path.join(getDataDir(), "documents", `${docId}.json`);
}

export function loadDocument(docId) {
  const p = documentPath(docId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function saveDocument(record) {
  const p = documentPath(record.docId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(record, null, 2), "utf8");
}

export function siteIdFromUrl(url) {
  const u = new URL(String(url).trim());
  const key = `${u.origin}${u.pathname.replace(/\/[^/]*$/, "/")}`;
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 24);
}

export function sitePath(siteId) {
  return path.join(getDataDir(), "sites", `${siteId}.json`);
}

export function loadSite(siteId) {
  const p = sitePath(siteId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function saveSite(record) {
  const p = sitePath(record.siteId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(record, null, 2), "utf8");
}
