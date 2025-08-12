// Objection Forecaster
exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return ok("");

  try {
    const { company = "", offer = "" } = JSON.parse(event.body || "{}");
    const key = process.env.TAVILY_API_KEY;
    if (!company || !key) return json(200, { packs: [] });

    const domain = company.toLowerCase().replace(/[^a-z0-9]+/g,"") + ".com";
    const queries = [
      `site:${domain} (security OR securite OR trust OR rgpd OR gdpr OR dpa OR iso27001)`,
      `site:${domain} (pricing OR tarifs OR plans)`,
      `site:${domain} (integrations OR intégrations OR api)`,
      `site:${domain} (vendor OR procurement OR achat)`,
      `site:${domain} ("release notes" OR "what's new" OR nouveautés)`
    ];

    const batches = await Promise.all(queries.map(q => tavily(q, key)));
    const nuggets = [];
    for (const b of batches) {
      for (const r of (b.results || [])) {
        nuggets.push({
          title: r.title || "Info",
          snippet: r.content || r.snippet || "",
          source: hostname(r.url),
          date: r.published_date || new Date().toISOString()
        });
      }
    }

    const packs = [
      {
        persona: "Économique / Acheteur",
        objections: [
          { title: "ROI incertain", rationale: "Besoin d'impact chiffré", counter_argument: "Cas d'usage comparable: 15–25% de gain sur ...", proof: "Pricing/Plans [site, mois/année]", next_step: "Audit rapide chiffré sur 1 périmètre" },
          { title: "Coût total / Intégration", rationale: "Crainte coûts cachés", counter_argument: "Intégrations natives/API documentées", proof: "Intégrations/API [site, mois/année]", next_step: "POC 10 jours sur un flux" }
        ]
      },
      {
        persona: "Technique / Sécurité",
        objections: [
          { title: "Sécurité / RGPD", rationale: "Conformité & localisation", counter_argument: "Certifs / DPA disponibles", proof: "Trust/Sécurité [site, mois/année]", next_step: "Validation DPA avec équipe sécu" },
          { title: "Fiabilité produit", rationale: "Maturité / roadmap", counter_argument: "Release notes fréquentes", proof: "Release notes [site, mois/année]", next_step: "Revue features vs besoins" }
        ]
      }
    ];

    return json(200, { packs });
  } catch (e) {
    return json(500, { error: String(e) });
  }
};

async function tavily(query, key) {
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, query, search_depth: "advanced", include_answer: false, include_raw_content: false, max_results: 5 })
  });
  return resp.json();
}
function hostname(u=""){ try { return new URL(u).hostname.replace("www.","")} catch { return "site"} }
function ok(b){ return { statusCode:200, headers:baseHeaders(), body:b } }
function json(s,b){ return { statusCode:s, headers:{ "Content-Type":"application/json", ...baseHeaders()}, body:JSON.stringify(b)} }
function baseHeaders(){ return { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Content-Type, Authorization", "Access-Control-Allow-Methods":"POST, OPTIONS" } }
