// Intent Radar
exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return ok("");

  try {
    const { company = "", city = "", offer = "", language = "fr" } = JSON.parse(event.body || "{}");
    if (!company) return json(200, { ok: true, has_new: false, signals: [], suggestion: "" });

    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    if (!TAVILY_API_KEY) return json(200, { ok: true, has_new: false, signals: [] });

    const q = `${company} (nomination OR lance OR partenariat OR levée de fonds OR acquisition OR ouvre un bureau OR recrute)`;
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_API_KEY, query: q, search_depth: "advanced", include_answer: false, include_raw_content: false, max_results: 6 })
    });
    const data = await resp.json();
    const signals = (data.results || []).slice(0,5).map(r => ({
      title: r.title, snippet: r.content || r.snippet || "", source: hostname(r.url), date: r.published_date || new Date().toISOString()
    }));

    const has_new = signals.length > 0;
    const suggestion = has_new ? `Nouveaux signaux détectés pour ${company}. Génère immédiatement des messages personnalisés (SPIN/Challenger/MEDDIC) et propose un ${language==='fr'?'appel 15 min':'15-min call'}.` : "";

    return json(200, { ok: true, has_new, signals, suggestion });
  } catch (e) {
    return json(500, { error: String(e) });
  }
};

function hostname(u=""){ try { return new URL(u).hostname.replace("www.","")} catch { return "source"} }
function ok(b){ return { statusCode:200, headers:baseHeaders(), body:b } }
function json(s,b){ return { statusCode:s, headers:{ "Content-Type":"application/json", ...baseHeaders()}, body:JSON.stringify(b)} }
function baseHeaders(){ return { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Content-Type, Authorization", "Access-Control-Allow-Methods":"POST, OPTIONS" } }
