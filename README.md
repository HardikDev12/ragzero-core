# ragzero-core

![npm](https://img.shields.io/npm/v/@hardikDev12/ragzero)
![license](https://img.shields.io/npm/l/@hardikDev12/ragzero)
![downloads](https://img.shields.io/npm/dm/@hardikDev12/ragzero)

> Turn any website into an intelligent, queryable knowledge system — without embeddings.

A **next-generation LLM retrieval engine** that eliminates embeddings and vector databases by enabling models to **reason directly over structured documents**.

Instead of similarity search, ragzero-core uses:
- **Hierarchical document parsing**
- **Bottom-up semantic compression**
- **LLM-driven query planning**

This results in:
- Better reasoning over structured data
- Lower infrastructure complexity
- Fully local or multi-provider LLM support

Designed to run:
- Fully local (Ollama)
- Cloud (OpenAI-compatible providers: ChatGPT/Claude/Grok via gateway)
- Hybrid environments

---

## Why Vectorless?

Traditional RAG:
- Requires embeddings
- Needs vector databases (Pinecone, FAISS, etc.)
- Suffers from retrieval mismatch

ragzero-core:
- No embeddings
- No vector DB
- Uses LLM reasoning instead of similarity

This makes it:
- Simpler to deploy
- More flexible across models
- Better for structured documents (docs, tutorials, knowledge bases)

---

## Architecture

User → Query Planner → Section Selection → Context Builder → LLM → Answer

Pipeline:
1. Parse HTML → Heading Tree
2. Summarize bottom-up
3. Store structured JSON
4. Plan query (LLM selects sections)
5. Build context dynamically
6. Generate answer

---

## 1-Minute Example

```bash
npx @hardikDev12/ragzero "https://example.com" "What is this about?"
```

```text
-> Fetching document...
-> Building structure...
-> Answer: "This page explains ..."
```

---

## What Makes This Different

Unlike traditional RAG stacks:

- No embeddings pipeline
- No vector database dependency
- LLM acts as retriever and reasoner
- Works fully offline with Ollama

This reduces system complexity while improving reasoning quality on structured data.

---

## Comparison

| Feature | Vector DB RAG | ragzero-core |
|--------|--------------|----------------|
| Embeddings | Required | Not required |
| Vector DB | Required | Not required |
| Setup complexity | High | Low |
| Reasoning ability | Medium | High |
| Works offline | Limited | Yes (via Ollama) |

---

## Use Cases

- Documentation assistants (ChatGPT-like for docs)
- Developer knowledge bases
- Internal company wikis
- AI copilots for SaaS products
- Offline/local AI systems

---

## Who Is This For

- Developers building AI copilots
- Teams with documentation-heavy products
- Engineers avoiding vector DB complexity
- Builders creating local/offline AI tools

---

## Example Use Case

```bash
ragzero --crawl --max-pages 150 \
  --url "https://doc.agentscope.io/" \
  --question "How do I install AgentScope?"
```

Answer behavior:
- Crawls relevant documentation pages
- Merges installation details from multiple sections/pages
- Returns a grounded explanation

---

## Performance Notes

- Reduces infrastructure by removing vector DB
- Faster setup compared to traditional RAG pipelines
- Improved contextual understanding on structured documents due to hierarchical reasoning

---

## Security

- Input sanitization to reduce prompt injection risk
- Local-first storage by default
- API keys handled at runtime via env/flags (not persisted in indexed JSON)

---

## Installation

```bash
npm install @hardikDev12/ragzero
```

Or run without install:

```bash
npx @hardikDev12/ragzero --help
```

---

## CLI Quick Start

Single page:

```bash
ragzero "https://example.com/page" "What is this page about?"
```

Whole site:

```bash
ragzero --crawl --max-pages 200 \
  --url "https://doc.agentscope.io/" \
  --question "How do I install AgentScope and what are extra dependencies?"
```

Custom model provider:

```bash
ragzero \
  --provider custom \
  --base-url "https://api.openai.com/v1" \
  --api-key "<YOUR_API_KEY>" \
  --model "gpt-4o-mini" \
  --url "https://example.com/docs" \
  --question "Summarize the onboarding flow"
```

---

## CLI Reference

| Option | Short | Description |
|--------|-------|-------------|
| `--url` | `-u` | HTML page URL to fetch and index |
| `--question` | `-q` | Natural-language question |
| `--force` | | Ignore saved index; re-fetch and re-summarize |
| `--crawl` | | Crawl internal pages from seed URL and query across site index |
| `--max-pages` | | Crawl limit in site mode (default `100`) |
| `--data-dir` | `-d` | Root folder for stored JSON (overrides env) |
| `--provider` | | LLM provider: `ollama` or `custom` |
| `--base-url` | | Base URL for custom provider (`.../v1`) |
| `--api-key` | | API key for custom provider |
| `--model` | `-m` | Model name |
| `--json` | | Print one JSON object to stdout |
| `--help` | `-h` | Show usage |

---

## Programmatic API

```javascript
import { VectorlessRAG } from "@hardikDev12/ragzero";

const rag = new VectorlessRAG({
  provider: "ollama",
  model: "llama3.2",
  ollamaHost: "http://127.0.0.1:11434",
  dataDir: "./my-index",
  verbose: true
});

await rag.load("https://example.com/docs");
const answer = await rag.ask("What is the main topic?");
```

Site mode:

```javascript
await rag.loadSite("https://doc.agentscope.io/", { maxPages: 200 });
const siteAnswer = await rag.askSite("How does installation work across pages?");
```

Custom provider:

```javascript
const rag = new VectorlessRAG({
  provider: "custom",
  baseURL: "https://api.openai.com/v1",
  apiKey: process.env.LLM_API_KEY,
  model: "gpt-4o-mini"
});
```

Note: Native Anthropic/XAI APIs use different schemas. For Claude/Grok, use an OpenAI-compatible gateway/router endpoint.

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `LLM_PROVIDER` | `ollama` or `custom` | `ollama` |
| `LLM_BASE_URL` | Base URL for custom provider (`.../v1`) | unset |
| `LLM_API_KEY` | API key for custom provider | unset |
| `LLM_MODEL` | Model name for any provider | fallback to `OLLAMA_MODEL` |
| `OLLAMA_HOST` | Ollama base URL | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | Ollama model fallback | `llama3.2` |
| `VECTORLESS_DATA_DIR` | Root for persisted JSON | `./data/vectorless-rag` |

---

## Storage Layout

```text
<cwd>/data/vectorless-rag/
  documents/<docId>.json
  sites/<siteId>.json
  llm-cache.json
```

---

## How It Works (Deep Dive)

1. Fetch HTML and parse heading tree (`h1` to `h6`)
2. Sanitize section text
3. Summarize leaves and then parent nodes bottom-up
4. Persist per-page trees and optional site index
5. Query planner selects relevant nodes/docs
6. Context builder composes source text
7. LLM generates grounded answer

---

## SaaS / Chat Integration Flow

Recommended backend flow:

1. On workspace setup, run `loadSite(seedUrl, { maxPages })`
2. Persist `{ workspaceId, siteId }` in your DB
3. For each user message, run `askSite(question)`
4. Re-index asynchronously with `forceRefresh: true`

Suggested endpoints:
- `POST /knowledge/index`
- `POST /chat`
- `GET /knowledge/status`

---

## Roadmap

- [ ] Streaming responses
- [ ] Better source citations in final answers
- [ ] Plugin ingest adapters (PDF, Notion, GitHub)
- [ ] Lightweight UI dashboard
- [ ] Benchmark suite vs vector-based RAG

---

## Development

```bash
npm install
npm start
npm run test:rag
```

Package publish target:

```bash
npm pack --dry-run
npm publish --access public
```

---

## License

MIT
