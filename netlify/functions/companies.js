// Short-list d'entreprises par secteur
exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return ok("");

  try {
    const { sector = "", city = "", limit = 12 } = JSON.parse(event.body || "{}");
    const key = process.env.TAVILY_API_KEY;
    if (!sector || !key) return json(200, { companies: [] });

    const q = `"${sector}" ${city} site:linkedin.com/company OR site:fr.wikipedia.org OR site:lesechos.fr`;
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ api_key: key, query: q, search_depth:"advanced", include_answer:false, include_raw_content:false, max_results: 20 })
    });
    const data = await resp.json();

    const names = new Set();
    const companies = [];
    for (const r of (data.results || [])) {
      const title = (r.title || "").replace(/ \|.*$/,"").replace(/ - .*$/,"").trim();
      if (!title) continue;
      const clean = title.replace(/(Officiel|Wikipedia|Wikipédia)/ig,"").trim();
      if (clean.length < 2) continue;
      if (names.has(clean)) continue;
      names.add(clean);
      companies.push({ name: clean, source: hostname(r.url) });
      if (companies.length >= limit) break;
    }
    return json(200, { companies });
  } catch (e) {
    return json(500, { error: String(e) });
  }
};

function hostname(u=""){ try { return new URL(u).hostname.replace("www.","")} catch { return "source"} }
function ok(b){ return { statusCode:200, headers:baseHeaders(), body:b } }
function json(s,b){ return { statusCode:s, headers:{ "Content-Type":"application/json", ...baseHeaders()}, body:JSON.stringify(b)} }
function baseHeaders(){ return { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Content-Type, Authorization", "Access-Control-Allow-Methods":"POST, OPTIONS" } }
