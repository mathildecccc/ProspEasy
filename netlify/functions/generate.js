// Providers: OpenAI / OpenRouter / Gemini (CommonJS, Node 18+)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return cors(200, "");

  try {
    const { systemPrompt, language = "fr", strategy = "hybrid" } =
      JSON.parse(event.body || "{}");
    if (!systemPrompt) return cors(400, "Missing systemPrompt");

    const hasOpenAI = !!(OPENROUTER_API_KEY || OPENAI_API_KEY);
    const hasGemini = !!GEMINI_API_KEY;

    let text = "";
    let meta = { provider_used: "", model_used: "" };

    if (strategy === "openai") {
      if (!hasOpenAI) throw new Error("OpenAI/OpenRouter not configured");
      text = await generateWithOpenAI(systemPrompt);
      meta = { provider_used: "openai", model_used: resolvedOpenAIModel() };
    } else if (strategy === "gemini") {
      if (!hasGemini) throw new Error("Gemini not configured");
      text = await generateWithGemini(systemPrompt, language);
      meta = { provider_used: "gemini", model_used: GEMINI_MODEL };
    } else {
      if (!hasOpenAI && !hasGemini) throw new Error("No provider configured");
      const calls = [];
      if (hasOpenAI) calls.push(generateWithOpenAI(systemPrompt).then(t=>({who:"openai", t, model:resolvedOpenAIModel()})).catch(e=>({who:"openai", err:String(e)})));
      if (hasGemini) calls.push(generateWithGemini(systemPrompt, language).then(t=>({who:"gemini", t, model:GEMINI_MODEL})).catch(e=>({who:"gemini", err:String(e)})));
      const res = await Promise.all(calls);
      const cand = res.filter(c => c && !c.err);
      if (!cand.length) throw new Error(`Both providers failed: ${res.map(r => `${r.who}:${r.err || 'ok'}`).join(" | ")}`);
      const scored = cand.map(c => ({ ...c, json: extractJSON(c.t), score: scoreOutput(c.t) }));
      const withJson = scored.filter(s => !!s.json);
      const chosen = (withJson.length ? withJson : scored).sort((a,b)=>b.score - a.score)[0];
      text = chosen.t; meta = { provider_used: chosen.who, model_used: chosen.model };
      const jsonCandidate = extractJSON(text);
      if (jsonCandidate) {
        try {
          const data = JSON.parse(jsonCandidate);
          let needsRefine = false;
          if (Array.isArray(data.prospects)) {
            for (const p of data.prospects) {
              if (p && typeof p.message_linkedin_invite === "string" && p.message_linkedin_invite.length < 200) {
                needsRefine = true; break;
              }
            }
          }
          if (needsRefine) {
            const refinePrompt = `${systemPrompt}

CONTRAINTE RAJOUTÉE: rallonge les "message_linkedin_invite" pour qu'ils fassent >200 caractères chacun, sans changer le sens. Renvoie UNIQUEMENT le même bloc ### JSON corrigé.`;
            const refined = meta.provider_used === "gemini"
              ? await generateWithGemini(refinePrompt, language)
              : await generateWithOpenAI(refinePrompt);
            const jsonRefined = extractJSON(refined);
            if (jsonRefined) text = refined;
          }
        } catch {}
      }
    }

    const jsonBlock = extractJSON(text);
    const response = jsonBlock ? JSON.parse(jsonBlock) : fallbackShape(language);

    return cors(200, { ...response, raw_markdown: text, ...meta }, meta);
  } catch (e) {
    return cors(500, `generate_error: ${String(e)}`);
  }
};

function cors(statusCode, body, meta) {
  const headers = {
    "Content-Type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  if (meta?.provider_used) headers["x-provider-used"] = meta.provider_used;
  if (meta?.model_used) headers["x-model-used"] = meta.model_used;
  return { statusCode, headers, body: typeof body === "string" ? body : JSON.stringify(body) };
}

function extractJSON(text) {
  const fence = "```json";
  const startFence = text.lastIndexOf(fence);
  if (startFence !== -1) {
    const endFence = text.indexOf("```", startFence + fence.length);
    if (endFence !== -1) {
      const block = text.slice(startFence + fence.length, endFence).trim();
      try { JSON.parse(block); return block; } catch {}
    }
  }
  let depth = 0, end = -1, start = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "}") { if (depth === 0) end = i; depth++; }
    else if (ch === "{") { depth--; if (depth === 0) { start = i; break; } }
  }
  if (start >= 0 && end > start) {
    const candidate = text.slice(start, end + 1);
    try { JSON.parse(candidate); return candidate; } catch {}
  }
  return null;
}

function scoreOutput(text) {
  let score = text.length;
  if (text.includes("### JSON")) score += 500;
  if (text.includes('"entreprise_cible"')) score += 300;
  if (text.includes('"prospects"')) score += 300;
  if (text.includes('"message_linkedin_invite"')) score += 200;
  if (text.includes('"message_linkedin_after_accept"')) score += 200;
  return score;
}

function fallbackShape(language = "fr") {
  const t = (fr, en) => (language === "fr" ? fr : en);
  return {
    entreprise_cible: t("Inconnue", "Unknown"),
    localisation: t("N/D", "N/A"),
    actualite_et_enjeux: t("Aucune actualité disponible.", "No news available."),
    prospects: [1, 2, 3].map(() => ({
      role: t("Rôle cible", "Target role"),
      niveau: t("Seniorité", "Seniority"),
      priorites: [t("Priorité 1", "Priority 1"), t("Priorité 2", "Priority 2")],
      objections: [t("Objection 1", "Objection 1")],
      why: t("Basé sur la correspondance rôle/entreprise.", "Based on role/company fit."),
      spin_outline: { situation: t("Contexte actuel", "Current context"), problem: t("Problème clé", "Core problem"), implication: t("Conséquence business", "Business implication"), need_payoff: t("Résultat attendu", "Need-payoff") },
      message_linkedin_invite: t("Invitation LinkedIn (exemple >200c).", "LinkedIn invite (sample >200c)."),
      message_linkedin_after_accept: t("Message post-acceptation (style mail).", "Post-accept message (mail style)."),
      email: { sujet: t("Sujet email", "Email subject"), corps: t("Corps email", "Email body") },
      sequence_relance: [t("Relance 1", "Follow-up 1"), t("Relance 2", "Follow-up 2")]
    })),
    linkedin_invite: t("Bonjour, j’aimerais vous ajouter à mon réseau.", "Hello, I'd like to connect."),
    linkedin_message: t("Message initial personnalisé.", "Personalized first message."),
    email: { sujet: t("Proposition de valeur", "Value proposition"), corps: t("Bonjour...,", "Hello...,") },
    email_followups: [t("Relance J+3", "Follow-up D+3"), t("Relance J+7", "Follow-up D+7")],
    call_script: t("Ouverture → Diagnostic → Insight → Next step", "Opening → Diagnostic → Insight → Next step"),
    plan_action: t("J1: ... J2: ...", "D1: ... D2: ...")
  };
}

function resolvedOpenAIModel() {
  if (OPENROUTER_API_KEY) return OPENAI_MODEL.includes("/") ? OPENAI_MODEL : `openai/${OPENAI_MODEL}`;
  return OPENAI_MODEL;
}

async function generateWithOpenAI(systemPrompt) {
  const usingOpenRouter = !!OPENROUTER_API_KEY;
  const model = resolvedOpenAIModel();
  if (usingOpenRouter) {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENROUTER_API_KEY}` },
      body: JSON.stringify({ model, messages: [
        { role: "system", content: "Tu es un expert en prospection B2B. Réponds uniquement dans la langue demandée et fournis un bloc JSON valide conforme au schéma." },
        { role: "user", content: systemPrompt }
      ], temperature: 0.7 })
    });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || "";
  }
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model, messages: [
      { role: "system", content: "Tu es un expert en prospection B2B. Réponds uniquement dans la langue demandée et fournis un bloc JSON valide conforme au schéma." },
      { role: "user", content: systemPrompt }
    ], temperature: 0.7 })
  });
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

async function generateWithGemini(systemPrompt, language = "fr") {
  if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
  const models = [GEMINI_MODEL, "gemini-1.5-pro", "gemini-1.5-flash"];
  let lastErr;
  for (const modelId of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;
      const payload = {
        contents: [
          { role: "user", parts: [{ text: "Langue: " + language + ". Réponds en respectant le format strict demandé (texte + bloc JSON valide en fin de réponse)." }] },
          { role: "user", parts: [{ text: systemPrompt }] }
        ],
        generationConfig: { temperature: 0.7 }
      };
      const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.map(p=>p.text || "").join("") || "";
      if (!text) throw new Error("Empty Gemini response for " + modelId);
      return text;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("Gemini failed");
}
