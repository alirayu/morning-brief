// Cloudflare Worker 后端代码
// 用途：帮前端抓 RSS 和原文正文，减少浏览器 CORS 限制。
// 不需要 API Key，不接 AI，只负责抓取和抽取正文。

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return json({ error: "Missing ?url=" }, 400);
    }

    if (url.pathname === "/rss") {
      return fetchRss(target);
    }

    if (url.pathname === "/extract") {
      return extractArticle(target);
    }

    return json({ error: "Use /rss?url= or /extract?url=" }, 404);
  },
};

async function fetchRss(target) {
  try {
    const res = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 MorningBriefBot/1.0",
        "Accept": "application/rss+xml, application/xml, text/xml, text/html,*/*",
      },
    });

    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=900",
      },
    });
  } catch (err) {
    return new Response("", {
      status: 502,
      headers: CORS_HEADERS,
    });
  }
}

async function extractArticle(target) {
  try {
    const res = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 MorningBriefBot/1.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const html = await res.text();
    const text = extractTextFromHtml(html);

    return json({
      url: target,
      text: text.slice(0, 16000),
    });
  } catch (err) {
    return json({
      url: target,
      text: "",
      error: String(err),
    }, 502);
  }
}

function extractTextFromHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<\/(p|h1|h2|h3|li|blockquote|article|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split("\n")
    .map(s => s.replace(/\s+/g, " ").trim())
    .filter(s => s.length > 60)
    .filter(s => !/cookie|privacy policy|subscribe|sign up|advertisement/i.test(s))
    .slice(0, 80)
    .join("\n\n");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
