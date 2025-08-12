// Signaux utiles (org/produit/finance/expansion)
exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return ok("");

  try {
    const { company, city = "", sector = "", limit = 5 } = JSON.parse(event.body || "{}");
    if (!company && !sector) return json(200, { signals: [] });

    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    if (!TAVILY_API_KEY) return json(200, { signals: [] });

    const negatives = [
      "horaires","horaire","ouverture magasins","catalogue","promo","promos","réduction","soldes",
      "flyer","prospectus","mappy","pagesjaunes","bonial","moovit","yelp","tripadvisor","prix","tarifs"
    ].map(w => `-${w}`).join(" ");

    const positives = [
      "nomination","gouvernance","comité exécutif","restructuration",
      "lance","nouveau produit","nouvelle offre","partenariat","intégration","co-innovation",
      "levée de fonds","fundraising","série A","série B","acquisition","fusion",
      "ouvre un bureau","expansion","recrute","hiring","plan d'embauche","RFP","appel d'offres"
    ].join(" OR ");

    const target = company ? `"${company}"` : `"${sector}"`;
    const qCity = city ? `"${city}"` : "";

    const queries = [
      `${target} (${positives}) ${qCity} ${negatives}`,
      `site:newsroom.* ${target} ${qCity} ${negatives}`,
      `site:${slugDomain(company || sector)} (${positives}) ${qCity} ${negatives}`
    ];

    const batches = await Promise.all(queries.map(q => tavily(q, TAVILY_API_KEY)));
    const raw = batches.flatMap(b => b.results || []);

    const cleaned = raw
      .filter(r => r.url && !isJunk(r))
      .map(r => scoreSignal(r, company || sector))
      .sort((a,b) => b.relevance - a.relevance)
      .slice(0, limit)
      .map(r => ({
        title: r.title,
        summary: r.content || r.snippet || "",
        source: r.source || hostname(r.url),
        date: r.published_date || new Date().toISOString(),
        category: r.category,
        why_it_matters: r.why,
        url: r.url
      }));

    return json(200, { signals: cleaned });
  } catch (e) {
    return json(500, { error: String(e) });
  }
};

function isJunk(r) {
  const u = (r.url || "").toLowerCase();
  const t = (r.title || "").toLowerCase();
  const badDomains = ["mappy","pagesjaunes","bonial","moovit","yelp","tripadvisor"];
  const badTerms = ["horaires","catalogue","promo","réduction","prospectus","prix","tarifs","flyer"];
  if (badDomains.some(d => u.includes(d))) return true;
  if (badTerms.some(w => t.includes(w))) return true;
  return false;
}

function scoreSignal(r, target) {
  const t = `${r.title} ${r.content || r.snippet || ""}`.toLowerCase();
  let cat = "autre", score = 0;
  const bump = (n) => (score += n);

  if (/(nomination|gouvernance|comité exécutif|directeur|vp|cfo|cmo|cto)/.test(t)) { cat = "organisation"; bump(50) }
  if (/(lance|nouveau produit|nouvelle offre|partenariat|intégration)/.test(t)) { cat = "produit/partenariat"; bump(45) }
  if (/(levée de fonds|fundraising|série|acquisition|fusion)/.test(t)) { cat = "finance/M&A"; bump(40) }
  if (/(ouvre un bureau|expansion|recrute|hiring|plan d'embauche)/.test(t)) { cat = "expansion/hiring"; bump(35) }

  if (target && (r.title || "").toLowerCase().includes(target.toLowerCase())) bump(10);
  const why = buildWhy(cat, r, target);
  return {
    ...r,
    source: r.source || hostname(r.url),
    category: cat,
    relevance: score,
    why
  };
}

function buildWhy(cat, r, target) {
  const s = r.source || hostname(r.url);
  if (cat === "organisation") return `Changement d’org/leadership chez ${target} — accès décisionnaire. [${s}]`;
  if (cat === "produit/partenariat") return `Lancement/partenariat lié à l’offre → message d’usage concret. [${s}]`;
  if (cat === "finance/M&A") return `Mouvement financier → budget/disruption, bon moment. [${s}]`;
  if (cat === "expansion/hiring") return `Croissance/recrutements → besoin d’outillage/accélération. [${s}]`;
  return `Signal potentiellement exploitable. [${s}]`;
}

function slugDomain(name="") { const s = name.toLowerCase().replace(/[^a-z0-9]+/g,""); return s ? `${s}.com` : "example.com"; }
function hostname(u="") { try { return new URL(u).hostname.replace("www.","") } catch { return "source" } }

async function tavily(query, key) {
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, query, search_depth: "advanced", include_answer: false, include_raw_content: false, max_results: 6 })
  });
  return resp.json();
}

function ok(body) { return { statusCode: 200, headers: baseHeaders(), body } }
function json(statusCode, body) { return { statusCode, headers: { "Content-Type":"application/json", ...baseHeaders() }, body: JSON.stringify(body) } }
function baseHeaders(){ return { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Content-Type, Authorization", "Access-Control-Allow-Methods":"POST, OPTIONS" } }
