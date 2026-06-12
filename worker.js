const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MODEL = "openrouter/free";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    const url = new URL(request.url);
    const target = url.searchParams.get("url");
    if (url.pathname === "/rss") { if (!target) return json({ error: "Missing url" }, 400); return fetchRss(target); }
    if (url.pathname === "/extract") { if (!target) return json({ error: "Missing url" }, 400); return extractArticle(target); }
    if (url.pathname === "/brief" && request.method === "POST") { const body = await request.json(); return generateBrief(body, env); }
    return json({ ok: true, usage: "/rss /extract /brief" });
  },
};

async function fetchRss(target) {
  const res = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0 MorningBriefBot/1.0" } });
  const text = await res.text();
  return new Response(text, { headers: { ...CORS_HEADERS, "Content-Type": "application/xml;charset=utf-8" } });
}

async function extractArticle(target) {
  const res = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0 MorningBriefBot/1.0" } });
  const html = await res.text();
  const text = cleanHtml(html);
  return json({ url: target, text });
}

async function generateBrief(body, env) {
  const articles = body.articles || [];
  const language = body.language || "zh-CN";
  if (!env.OPENROUTER_API_KEY) return json({ error: "Missing OPENROUTER_API_KEY secret" }, 500);

  let outputRule = "请用简体中文写完整晨报，不要夹英文；英文标题要意译成中文。";
  let sectionRule = "分为：[今日总览]、[科技]、[AI]、[能源]、[太空]、[医疗]、[最后总结]。";

  if (language === "zh-HK") {
    outputRule = "請用繁體中文和自然香港書面語寫完整晨報；可帶少量粵語語氣，但不要太口語；英文標題要意譯成繁體中文。";
    sectionRule = "分為：[今日總覽]、[科技]、[AI]、[能源]、[太空]、[醫療]、[最後總結]。";
  }

  if (language === "en-US") {
    outputRule = "Please write the whole brief in natural English. Translate non-English terms into English where needed.";
    sectionRule = "Use these section titles: [Overview], [Technology], [AI], [Energy], [Space], [Medical], [Final Takeaway].";
  }

  const prompt = `
You are a calm morning news brief editor.

Output language rule:
${outputRule}

Structure rule:
${sectionRule}

Formatting rules:
- Use [section title] only. Do not use Markdown headings.
- Do not use **bold** symbols.
- Remove ads, navigation, login prompts, newsletter text, cookie notices and unrelated footer text.
- Explain what happened, why it matters, and what may happen next.
- Keep it suitable for listening by TTS.
- Target length: about 10 minutes of listening.

News materials:
${articles.map((a, i) => `
[${i + 1}]
Category: ${a.cat}
Source: ${a.source}
Title: ${a.title}
Content: ${(a.text || a.summary || "").slice(0, 5000)}
`).join("\n")}
`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://alirayu.github.io",
      "X-Title": "Morning Brief",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });

  const data = await res.json();
  const article = data?.choices?.[0]?.message?.content || "";
  return json({ article, raw: data });
}

function cleanHtml(html) {
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
    .filter(s => !/cookie|privacy|subscribe|sign up|advertisement|skip to content|newsletter|javascript|vercel security/i.test(s))
    .slice(0, 80)
    .join("\n\n")
    .slice(0, 16000);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json;charset=utf-8" },
  });
}

