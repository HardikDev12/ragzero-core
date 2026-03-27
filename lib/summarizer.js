import { callLLM } from "./llm.js";
import { loadCache, saveCache } from "./cache.js";

const MAX_LEAF = 3500;
const MAX_CHILD_SUMMARY = 700;

function cacheKey(docId, nodeId) {
  return `${docId}:${nodeId}`;
}

/**
 * Bottom-up: leaves summarized first; parents summarize intro + child summaries.
 * Persists per-node entries in llm-cache.json to avoid repeat calls when rebuilding.
 */
export async function summarizeTreeBottomUp(root, config, docId, options = {}) {
  const { skipLlmCache = false, verbose = true } = options;
  const cache = loadCache();

  async function walk(node) {
    for (const child of node.children || []) {
      await walk(child);
    }

    const key = cacheKey(docId, node.id);
    if (!skipLlmCache && cache[key]) {
      node.summary = cache[key];
      return;
    }

    const kids = node.children || [];
    if (kids.length === 0) {
      const body = (node.content || "").slice(0, MAX_LEAF).trim();
      if (!body) {
        node.summary = "(empty section)";
      } else {
        node.summary = await callLLM({
          prompt: `Summarize the following documentation in 2–4 sentences. Reply in English only. Stay faithful to the text; do not invent commands or tools not mentioned.\n\n${body}`,
          config,
          temperature: 0.2
        });
      }
      cache[key] = node.summary;
      saveCache(cache);
      if (verbose) console.log("Summarized (leaf):", node.title || node.id);
      return;
    }

    const childBlock = kids
      .map((c) => `## ${c.title}\n${clip(c.summary || "", MAX_CHILD_SUMMARY)}`)
      .join("\n\n");
    const own = (node.content || "").trim().slice(0, 1500);

    const prompt = `Merge these documentation parts into one short abstract (2–5 sentences). Reply in English only. Stay faithful; do not invent steps or URLs not present.

Own intro (may be empty):
${own || "(none)"}

Subsection summaries:
${childBlock}

Write one concise summary for this section.`;

    node.summary = await callLLM({ prompt, config, temperature: 0.2 });
    cache[key] = node.summary;
    saveCache(cache);
    if (verbose) console.log("Summarized (branch):", node.title || node.id);
  }

  await walk(root);
  return root;
}

function clip(s, n) {
  if (!s) return "";
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}
