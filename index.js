import { fetchHTML } from "./lib/fetch.js";
import { parseHeaderTree } from "./lib/parser.js";
import { summarizeTreeBottomUp } from "./lib/summarizer.js";
import { askQuestion } from "./lib/query.js";
import { askAcrossDocs } from "./lib/site-query.js";
import { sanitizeInput, sanitizeTree } from "./lib/security.js";
import {
  loadDocument,
  saveDocument,
  docIdFromUrl,
  documentPath,
  siteIdFromUrl,
  loadSite as loadSiteRecord,
  saveSite as saveSiteRecord,
  sitePath
} from "./lib/storage.js";
import { clearDocCache } from "./lib/cache.js";
import { setDataDir } from "./lib/paths.js";
import { crawlSite } from "./lib/crawl.js";

/**
 * @param {Record<string, unknown>} [overrides]
 */
export function createLlmConfig(overrides = {}) {
  return {
    provider: process.env.LLM_PROVIDER?.trim() || "ollama",
    model:
      process.env.LLM_MODEL?.trim() ||
      process.env.OLLAMA_MODEL?.trim() ||
      "llama3.2",
    ollamaHost: process.env.OLLAMA_HOST?.trim() || "http://127.0.0.1:11434",
    baseURL: process.env.LLM_BASE_URL?.trim(),
    apiKey: process.env.LLM_API_KEY?.trim(),
    ...overrides
  };
}

export class VectorlessRAG {
  constructor(config = {}) {
    const { dataDir, verbose = true, ...llm } = config;
    if (dataDir != null && dataDir !== "") {
      setDataDir(String(dataDir));
    } else {
      setDataDir(null);
    }
    this.verbose = verbose;
    this.config = createLlmConfig(llm);
    this.tree = null;
    this.docId = null;
    this.url = null;
    this.site = null;
  }

  log(...args) {
    if (this.verbose) console.log(...args);
  }

  /**
   * Ingest a URL: header tree → bottom-up summaries → JSON on disk.
   * @param {string} url
   * @param {{ forceRefresh?: boolean }} [options]
   */
  async load(url, options = {}) {
    const { tree, docId } = await this.ingestOne(url, options);
    this.url = url;
    this.docId = docId;
    this.tree = tree;
    this.log("Ready!");
  }

  async ingestOne(url, options = {}) {
    const { forceRefresh = false } = options;
    const normalized = String(url).trim();
    const docId = docIdFromUrl(normalized);

    if (forceRefresh) {
      clearDocCache(docId);
    } else {
      const stored = loadDocument(docId);
      if (stored?.version === 1 && stored.tree) {
        this.log("Loaded stored index:", docId, "→", documentPath(docId));
        return { tree: stored.tree, docId };
      }
    }

    this.log("Fetching:", normalized);
    const html = await fetchHTML(normalized);

    this.log("Parsing header tree...");
    let tree = parseHeaderTree(html);
    sanitizeTree(tree);

    this.log("Summarizing bottom-up → summaries on tree + cache...");
    const summarized = await summarizeTreeBottomUp(tree, this.config, docId, {
      skipLlmCache: forceRefresh,
      verbose: this.verbose
    });

    saveDocument({
      version: 1,
      url: normalized,
      docId,
      fetchedAt: new Date().toISOString(),
      tree: summarized
    });
    this.log("Saved full tree JSON:", documentPath(docId));
    return { tree: summarized, docId };
  }

  async ask(question) {
    const cleanQ = sanitizeInput(question);
    if (!this.tree) {
      throw new Error("No document loaded; call load(url) first.");
    }
    return await askQuestion(this.tree, cleanQ, this.config);
  }

  /**
   * Crawl and ingest multiple internal pages from a site.
   * @param {string} startUrl
   * @param {{ forceRefresh?: boolean, maxPages?: number, samePathPrefix?: boolean }} [options]
   */
  async loadSite(startUrl, options = {}) {
    const {
      forceRefresh = false,
      maxPages = 100,
      samePathPrefix = false
    } = options;
    const seed = String(startUrl).trim();
    const siteId = siteIdFromUrl(seed);

    if (!forceRefresh) {
      const saved = loadSiteRecord(siteId);
      if (saved?.version === 1 && Array.isArray(saved.documents) && saved.documents.length) {
        this.site = saved;
        this.log("Loaded stored site index:", siteId, "→", sitePath(siteId));
        this.log("Pages:", saved.documents.length);
        return;
      }
    }

    this.log("Crawling site:", seed);
    const pages = await crawlSite(seed, {
      maxPages,
      samePathPrefix,
      verbose: this.verbose
    });
    this.log("Discovered pages:", pages.length);

    const documents = [];
    for (const p of pages) {
      const { tree, docId } = await this.ingestOne(p.url, { forceRefresh });
      documents.push({
        docId,
        url: p.url,
        title: tree?.children?.[0]?.title || tree?.title || "Document",
        summary: tree?.summary || ""
      });
    }

    this.site = {
      version: 1,
      siteId,
      seedUrl: seed,
      fetchedAt: new Date().toISOString(),
      pageCount: documents.length,
      documents
    };
    saveSiteRecord(this.site);
    this.log("Saved site index:", sitePath(siteId));
    this.log("Pages indexed:", documents.length);
  }

  async askSite(question) {
    const cleanQ = sanitizeInput(question);
    if (!this.site?.documents?.length) {
      throw new Error("No site loaded; call loadSite(url) first.");
    }
    const docs = this.site.documents
      .map((d) => ({ ...d, full: loadDocument(d.docId) }))
      .filter((d) => d.full?.tree)
      .map((d) => ({ docId: d.docId, url: d.url, tree: d.full.tree }));
    if (!docs.length) return "Not found";
    return await askAcrossDocs(docs, cleanQ, this.config);
  }
}

export { setDataDir, getDataDir } from "./lib/paths.js";
export {
  docIdFromUrl,
  documentPath,
  loadDocument,
  saveDocument,
  siteIdFromUrl,
  sitePath,
  loadSite,
  saveSite
} from "./lib/storage.js";
export { parseHeaderTree } from "./lib/parser.js";
export { summarizeTreeBottomUp } from "./lib/summarizer.js";
export { askQuestion } from "./lib/query.js";
export { askAcrossDocs } from "./lib/site-query.js";
export { callLLM } from "./lib/llm.js";
