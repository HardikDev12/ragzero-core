import { callLLM } from "./llm.js";
import { compactForLLM, collectNodesByIds, gatherSubtreeText } from "./tree.js";

function extractIdArray(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const blob = (fenced ? fenced[1] : text).trim();
  const start = blob.indexOf("[");
  const end = blob.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  try {
    const arr = JSON.parse(blob.slice(start, end + 1));
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
}

function buildNodeContext(n) {
  const body = gatherSubtreeText(n);
  const sum = (n.summary || "").trim();
  if (sum && body) {
    return `Section summary:\n${sum}\n\nSource text:\n${body}`;
  }
  return sum || body || "(no text for this section)";
}

/**
 * 1) LLM reasons over compact JSON tree (summaries only).
 * 2) Full text from selected nodes → LLM → answer.
 */
export async function askQuestion(tree, question, config) {
  const outline = compactForLLM(tree);
  const outlineJson = JSON.stringify(outline, null, 2);

  const selectionRaw = await callLLM({
    prompt: `Document outline (JSON). Fields: id, title, summary, children.
Task: choose node ids that contain the information needed to answer the question. Prefer leaf ids (e.g. n2, n3) when they hold the facts.

Outline:
${outlineJson}

Question: ${question}

Output format: a single JSON array only, for example: ["n1","n2"]
No explanation, no markdown, no other words.`,
    config,
    temperature: 0.1
  });

  let ids = extractIdArray(selectionRaw);
  if (!ids?.length) {
    const fallback = (tree.children || []).slice(0, 3).map((n) => n.id);
    ids = fallback.length ? fallback : [tree.id];
  }

  const selected = collectNodesByIds(tree, ids);
  const finalNodes = selected.length ? selected : [tree];

  const context = finalNodes
    .map((n) => `### ${n.title} (${n.id})\n${buildNodeContext(n)}`)
    .join("\n\n---\n\n");

  return await callLLM({
    prompt: `Read SOURCE below. Answer the QUESTION using only SOURCE. Write 2–6 sentences in English.

If SOURCE does not contain enough information, reply exactly: Not found

Do not refuse because of wording. Do not say the excerpts are missing or discuss the prompt format.

SOURCE:
${context}

QUESTION: ${question}`,
    config,
    temperature: 0
  });
}
