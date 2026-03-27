/**
 * Helpers for the header-tree index (vectorless / tree RAG).
 */

/** Compact tree for LLM navigation (no raw body text). */
export function compactForLLM(node, depth = 0) {
  if (depth > 12) return { id: node.id, title: node.title, summary: clip(node.summary, 600), children: [] };
  return {
    id: node.id,
    title: node.title,
    summary: clip(node.summary, 800),
    children: (node.children || []).map((c) => compactForLLM(c, depth + 1))
  };
}

function clip(s, n) {
  if (!s) return "";
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

export function findNodeById(root, id) {
  if (root.id === id) return root;
  for (const c of root.children || []) {
    const hit = findNodeById(c, id);
    if (hit) return hit;
  }
  return null;
}

/** Collect this node's text plus all descendants (for answer context). */
export function gatherSubtreeText(node) {
  const parts = [];
  if (node.content?.trim()) parts.push(node.content.trim());
  for (const c of node.children || []) {
    const t = gatherSubtreeText(c);
    if (t) parts.push(t);
  }
  return parts.join("\n\n");
}

export function collectNodesByIds(root, ids) {
  const want = new Set(ids);
  const out = [];
  function walk(n) {
    if (want.has(n.id)) out.push(n);
    for (const c of n.children || []) walk(c);
  }
  walk(root);
  return out;
}
