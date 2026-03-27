#!/usr/bin/env node
/**
 * CLI: `npx @hardikdev1210/ragzero` or `ragzero` after global install.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { VectorlessRAG } from "./index.js";

function parseArgs(argv) {
  const opts = {
    force: false,
    crawl: false,
    maxPages: 100,
    url: null,
    question: null,
    dataDir: null,
    provider: null,
    baseURL: null,
    apiKey: null,
    model: null,
    json: false,
    help: false
  };
  const positional = [];
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    const advance = dispatchCliFlag(a, argv, i, opts, positional);
    if (advance === -1) process.exit(1);
    i += advance;
  }
  if (!opts.url && positional[0]) opts.url = positional[0];
  if (!opts.question && positional[1]) opts.question = positional[1];
  if (opts.url) opts.url = String(opts.url).trim();
  if (opts.question) opts.question = String(opts.question).trim();
  return opts;
}

/** @returns {number} steps to advance, or -1 on fatal error */
function dispatchCliFlag(a, argv, i, opts, positional) {
  const boolKey = BOOL_FLAGS[a];
  if (boolKey) return setBoolean(opts, boolKey);

  const valueKey = VALUE_FLAGS[a];
  if (valueKey) return setString(opts, valueKey, argv[i + 1]);

  if (a === "--max-pages") return setMaxPages(opts, argv[i + 1]);
  if (a === "--data-dir" || a === "-d") return setDataDir(opts, argv[i + 1]);

  if (a.startsWith("-")) {
    console.error("Unknown option:", a);
    console.error("Run with --help for usage.");
    return -1;
  }
  positional.push(a);
  return 1;
}

const BOOL_FLAGS = {
  "--help": "help",
  "-h": "help",
  "--force": "force",
  "--crawl": "crawl",
  "--json": "json"
};

const VALUE_FLAGS = {
  "--url": "url",
  "-u": "url",
  "--question": "question",
  "-q": "question",
  "--provider": "provider",
  "--base-url": "baseURL",
  "--api-key": "apiKey",
  "--model": "model",
  "-m": "model"
};

function setBoolean(target, key) {
  target[key] = true;
  return 1;
}

function setString(target, key, value) {
  target[key] = value ?? null;
  return 2;
}

function setMaxPages(target, value) {
  const n = Number.parseInt(String(value), 10);
  if (Number.isFinite(n) && n > 0) target.maxPages = n;
  return 2;
}

function setDataDir(target, value) {
  if (value) target.dataDir = path.resolve(value);
  return 2;
}

function printHelp() {
  console.log(`
ragzero-core — embedding-free retrieval engine with local/crawl JSON indexing and multi-provider LLM support

Usage:
  ragzero [options] [url] [question]
  npx @hardikdev1210/ragzero [options] [url] [question]

Options:
  --url, -u <url>         Page to ingest (HTML)
  --question, -q <text>  Question to answer
  --force                 Re-fetch and re-summarize (ignores cached index)
  --crawl                 Crawl internal pages from seed URL and index whole site
  --max-pages <n>         Limit pages during crawl mode (default: 100)
  --data-dir, -d <path>   Storage root (default: ./data/vectorless-rag or VECTORLESS_DATA_DIR)
  --provider <name>       LLM provider: ollama | custom
  --base-url <url>        Base URL for custom provider (OpenAI-compatible API)
  --api-key <token>       API key for custom provider
  --model, -m <name>      Ollama model (overrides OLLAMA_MODEL; default llama3.2)
  --json                  Print one JSON object (url, question, answer, docId, model) to stdout
  -h, --help              Show this help

Environment (all optional):
  LLM_PROVIDER     ollama | custom (default: ollama)
  LLM_BASE_URL     e.g. https://api.openai.com/v1
  LLM_API_KEY      API key for custom provider
  LLM_MODEL        model for any provider (overrides OLLAMA_MODEL)
  OLLAMA_HOST      e.g. http://127.0.0.1:11434
  OLLAMA_MODEL     e.g. llama3.2
  VECTORLESS_DATA_DIR  Override data directory

Examples:
  ragzero https://example.com/docs "What is the install command?"
  ragzero --force -u https://example.com -q "Summary?"
  ragzero --crawl --max-pages 200 -u https://docs.example.com -q "How auth works?"
  ragzero --provider custom --base-url https://api.openai.com/v1 --api-key <key> -m gpt-4o-mini -u https://example.com -q "Explain auth"
  VECTORLESS_DATA_DIR=./my-data ragzero https://example.com "Question"
`.trim());
}

export async function run() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const url =
    opts.url ||
    "https://doc.agentscope.io/tutorial/quickstart_installation.html";
  const question =
    opts.question ||
    "What Python version does AgentScope require, and how do you install it from PyPI?";

  applyRuntimeEnv(opts);

  if (!opts.json) printRunHeader(opts, url, question);

  const rag = new VectorlessRAG({
    dataDir: opts.dataDir || undefined,
    provider: process.env.LLM_PROVIDER || undefined,
    baseURL: process.env.LLM_BASE_URL || undefined,
    apiKey: process.env.LLM_API_KEY || undefined,
    model: process.env.LLM_MODEL || process.env.OLLAMA_MODEL || undefined,
    verbose: !opts.json
  });
  if (opts.crawl) {
    await rag.loadSite(url, { forceRefresh: opts.force, maxPages: opts.maxPages });
  } else {
    await rag.load(url, { forceRefresh: opts.force });
  }
  const answer = opts.crawl ? await rag.askSite(question) : await rag.ask(question);

  if (opts.json) {
    const payload = {
      url,
      question,
      answer,
      docId: rag.docId,
      crawl: opts.crawl,
      provider: rag.config.provider,
      model: rag.config.model
    };
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("\nAnswer:\n", answer);
  }
}

function applyRuntimeEnv(opts) {
  if (opts.provider) process.env.LLM_PROVIDER = opts.provider.trim();
  if (opts.baseURL) process.env.LLM_BASE_URL = opts.baseURL.trim();
  if (opts.apiKey) process.env.LLM_API_KEY = opts.apiKey.trim();
  if (opts.model) {
    process.env.LLM_MODEL = opts.model.trim();
    process.env.OLLAMA_MODEL = opts.model.trim();
  }
}

function printRunHeader(opts, url, question) {
  const provider = process.env.LLM_PROVIDER || "ollama";
  console.log("Provider:", provider);
  console.log("Model:", process.env.LLM_MODEL || process.env.OLLAMA_MODEL || "llama3.2 (default)");
  if (provider === "ollama") {
    console.log("Ollama:", process.env.OLLAMA_HOST || "http://127.0.0.1:11434");
  } else {
    console.log("Base URL:", process.env.LLM_BASE_URL || "(missing)");
  }
  console.log("Data dir:", opts.dataDir || process.env.VECTORLESS_DATA_DIR || "(cwd)/data/vectorless-rag");
  console.log("URL:", url);
  console.log("Question:", question);
  console.log("Force refresh:", opts.force);
  console.log("Crawl mode:", opts.crawl);
  if (opts.crawl) console.log("Max pages:", opts.maxPages);
  console.log("---");
}

function isMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  try {
    await run();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
