import * as cheerio from "cheerio";

/**
 * Parse HTML into a header tree (h1–h6). Document order: headings open nested
 * sections; body text attaches to the current innermost section.
 */
export function parseHeaderTree(html) {
  const $ = cheerio.load(html);
  const root = {
    id: "n0",
    level: 0,
    title: "Document",
    content: "",
    children: [],
    summary: null
  };
  let idCounter = 1;
  const stack = [root];

  function onHeading(level, title) {
    if (!title) return;
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    const node = {
      id: `n${idCounter++}`,
      level,
      title,
      content: "",
      children: [],
      summary: null
    };
    parent.children.push(node);
    stack.push(node);
  }

  function onText(text) {
    const t = text.replace(/\s+/g, " ").trim();
    if (!t) return;
    const cur = stack[stack.length - 1];
    cur.content += (cur.content ? "\n" : "") + t;
  }

  const container = $("main").length
    ? $("main")
    : $("article").length
      ? $("article")
      : $("body");

  if (!container.length) {
    return root;
  }

  function walkLinear(el) {
    $(el).contents().each((_, node) => {
      if (node.type === "text") {
        const t = $(node).text();
        if (t.trim()) onText(t);
      } else if (node.type === "tag") {
        const name = node.name.toLowerCase();
        if (/^h[1-6]$/.test(name)) {
          onHeading(parseInt(name[1], 10), $(node).text().trim());
        } else {
          walkLinear(node);
        }
      }
    });
  }

  walkLinear(container[0]);
  return root;
}
