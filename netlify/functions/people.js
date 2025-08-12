// Décideurs publics + fit score
exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return ok("");

  try {
    const { company, city = "", offer = "" } = JSON.parse(event.body || "{}");
    const key = process.env.TAVILY_API_KEY;
    if (!company || !key) return json(200, { people: [] });

    const roles = roleBuckets(offer);
    const neg = "-job -emploi -stage -stagiaire -alternance -caisse -caissier -vendeur -vendeuse -promo -horaires";

    const queries = [
      `site:linkedin.com/in "${company}" (${roles.core.join(" OR ")}) ${city} ${neg}`,
      `site:linkedin.com/in "${company}" (${roles.functionals.join(" OR ")}) ${city} ${neg}`,
      `${company} comité exécutif OR gouvernance OR "équipe dirigeante"`
    ];

    const batches = await Promise.all(queries.map(q => tavily(q, key)));
    const seen = new Set(); const people = [];

    for (const b of batches) {
      for (const r of (b.results || [])) {
        if (!r.url || seen.has(r.url)) continue; seen.add(r.url);
        const title = (r.title || "").trim();
        const [nameRaw] = title.split(" - ");
        const name = nameRaw?.split("|")[0]?.trim() || "Profil";
        const role = extractRole(title);
        if (isLow(role)) continue;

        const score = fitScore(role, offer, city);
        if (score < 40) continue;

        people.push({
          name, role: role || "Rôle",
          company, url: r.url,
          source: hostname(r.url),
          reason: buildReason(role, company, city),
          fit_score: score
        });
      }
    }
    people.sort((a,b)=> (b.fit_score||0)-(a.fit_score||0));
    return json(200, { people: people.slice(0,8) });
  } catch (e) {
    return json(500, { error: String(e) })
  }
};

function roleBuckets(offer="") {
  const core = ["CEO","Directeur Général","DG","Président","COO","CFO","CMO","CIO","CTO","CDO","Chief Revenue Officer","VP Sales","VP Marketing","VP Operations","VP Growth"];
  const functionals = ["Head of","Directeur","Directrice","Director","Responsable","Manager"];
  const o = offer.toLowerCase();
  if (/(rh|talent|recrut)/.test(o)) core.push("CHRO","DRH","Chief People Officer");
  if (/(data|ia|ml|analytics|bi)/.test(o)) core.push("Chief Data Officer","Head of Data","Directeur Data");
  if (/(ecommerce|retail|omni|magasin)/.test(o)) core.push("Ecommerce Director","Head of Ecommerce","Customer Experience Director");
  return { core, functionals };
}
function extractRole(t=""){ const p=t.split(" - "); return p.length>1?p.slice(1).join(" - ").trim():t.split("|").slice(1).join(" | ").trim() }
function isLow(role=""){ return /caissier|vendeur|stagiaire|alternant|hôte|hôtesse/i.test(role) }
function fitScore(role="", offer="", city=""){
  let s=0; if (/CEO|Direct|VP|Head|Officer|Président|Directeur|Directrice/i.test(role)) s+=50;
  if (/(data|ia|ml|analytics|crm|revops|ecommerce|ops|rh|talent)/i.test(offer)) s+=30;
  if (city) s+=10; return Math.min(100,s);
}
function buildReason(role, company, city){ const where=city?` à ${city}`:""; return `Décideur (${role}) chez ${company}${where}. Aligné avec l’offre.` }
async function tavily(query,key){ const r=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:key,query,search_depth:"advanced",include_answer:false,include_raw_content:false,max_results:5})}); return r.json() }
function hostname(u=""){ try { return new URL(u).hostname.replace("www.","") } catch { return "source" } }
function ok(b){ return { statusCode:200, headers:baseHeaders(), body:b } }
function json(s,b){ return { statusCode:s, headers:{ "Content-Type": "application/json", ...baseHeaders() }, body:JSON.stringify(b) } }
function baseHeaders(){ return { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Content-Type, Authorization", "Access-Control-Allow-Methods":"POST, OPTIONS" } }
