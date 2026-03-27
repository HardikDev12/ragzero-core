import * as cheerio from "cheerio";
import { fetchHTML } from "./fetch.js";

function normalizeUrl(input) {
  const u = new URL(String(input).trim());
  u.hash = "";
  return u.toString();
}

function isHttp(url) {
  return url.protocol === "http:" || url.protocol === "https:";
}

function shouldSkipByExt(pathname) {
  return /\.(png|jpg|jpeg|gif|webp|svg|pdf|zip|tar|gz|mp4|webm|mp3|wav|css|js|xml)$/i.test(pathname);
}

function extractInternalLinks(html, pageUrl, origin) {
  const $ = cheerio.load(html);
  const out = new Set();
  $("a[href]").each((_, a) => {
    const href = ($(a).attr("href") || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) {
      return;
    }
    try {
      const u = new URL(href, pageUrl);
      if (!isHttp(u)) return;
      if (u.origin !== origin) return;
      if (shouldSkipByExt(u.pathname)) return;
      u.hash = "";
      out.add(u.toString());
    } catch {
      // Ignore malformed links.
    }
  });
  return [...out];
}

/**
 * Crawl internal pages breadth-first.
 * @param {string} startUrl
 * @param {{maxPages?: number, samePathPrefix?: boolean, verbose?: boolean}} [options]
 */
export async function crawlSite(startUrl, options = {}) {
  const { maxPages = 100, samePathPrefix = false, verbose = false } = options;
  const seed = normalizeUrl(startUrl);
  const seedUrl = new URL(seed);
  const origin = seedUrl.origin;
  const prefix = seedUrl.pathname.replace(/\/[^/]*$/, "/");

  const queue = [seed];
  const visited = new Set();
  const pages = [];

  while (queue.length && pages.length < maxPages) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const html = await fetchPage(current, verbose);
    if (!html) continue;

    pages.push({ url: current, html });
    const links = extractInternalLinks(html, current, origin);
    enqueueLinks(queue, links, visited, { samePathPrefix, prefix });
  }

  return pages;
}

async function fetchPage(url, verbose) {
  try {
    if (verbose) console.log("Crawl fetch:", url);
    return await fetchHTML(url);
  } catch (err) {
    if (verbose) console.log("Crawl skip:", url, String(err));
    return null;
  }
}

function enqueueLinks(queue, links, visited, options) {
  const { samePathPrefix, prefix } = options;
  for (const link of links) {
    if (visited.has(link)) continue;
    if (samePathPrefix && !new URL(link).pathname.startsWith(prefix)) continue;
    queue.push(link);
  }
}
