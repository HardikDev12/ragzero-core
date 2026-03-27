export function sanitizeInput(text) {
  if (!text) return "";

  return text
    .replace(/<script.*?>.*?<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .slice(0, 10000);
}

export function sanitizeTree(node) {
  if (!node) return;
  node.content = sanitizeInput(node.content);
  for (const c of node.children || []) sanitizeTree(c);
}