import { callLLM } from "./llm.js";
import { askQuestion } from "./query.js";

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

/**
 * Ask across multiple indexed pages.
 * @param {Array<{docId: string, url: string, tree: any}>} docs
 * @param {string} question
 * @param {object} config
 */
export async function askAcrossDocs(docs, question, config) {
  if (!docs.length) return "Not found";
  const maxDocs = Math.max(1, Number.parseInt(String(config.siteTopK ?? 2), 10) || 2);

  const outline = docs.map((d) => ({
    docId: d.docId,
    url: d.url,
    title: d.tree?.children?.[0]?.title || d.tree?.title || "Document",
    summary: (d.tree?.summary || "").slice(0, 900)
  }));

  const selectionRaw = await callLLM({
    prompt: `You are choosing relevant documents for a question.
Return only a JSON array of docId values from the outline.
Pick at most ${maxDocs} documents.

Outline:
${JSON.stringify(outline, null, 2)}

Question: ${question}

Output only JSON array, for example: ["abc123","def456"]`,
    config,
    temperature: 0.1
  });

  let selectedIds = extractIdArray(selectionRaw);
  if (!selectedIds?.length) {
    selectedIds = docs.slice(0, maxDocs).map((d) => d.docId);
  }

  const selectedDocs = docs.filter((d) => selectedIds.includes(d.docId));
  const finalDocs = (selectedDocs.length ? selectedDocs : docs.slice(0, maxDocs)).slice(0, maxDocs);

  const perDocAnswers = await Promise.all(
    finalDocs.map(async (d) => {
      const ans = await askQuestion(d.tree, question, config);
      return {
      docId: d.docId,
      url: d.url,
      answer: ans
      };
    })
  );

  const usable = perDocAnswers.filter((x) => !/^not found$/i.test(String(x.answer).trim()));
  if (usable.length === 0) return "Not found";
  if (usable.length === 1) {
    return `${usable[0].answer}\n\nSource: ${usable[0].url}`;
  }

  const final = await callLLM({
    prompt: `Synthesize a final answer in English from the candidate answers below.
Use only the evidence from candidates. If all candidates are "Not found", reply exactly: Not found
When useful, mention source URLs briefly.

Question: ${question}

Candidates:
${JSON.stringify(perDocAnswers, null, 2)}`,
    config,
    temperature: 0
  });

  return final;
}
