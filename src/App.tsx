import { useMemo, useState } from 'react'
import type { FormState, SignalItem, CompanyItem, PersonHit, ProspectResult, ObjectionPack } from './lib/types'
import ResultCard from './components/ResultCard'
import { buildSystemPrompt } from './lib/prompt'
import { parseQuery, estimateCost } from './lib/utils'

const defaultForm: FormState = {
  mode: 'single',
  query: 'Gifi, Mérignac',
  companies: '',
  sector: '',
  sectorCity: '',
  selectedCompanies: [],
  company: 'Gifi',
  city: 'Mérignac',
  offer: '',
  language: 'fr',
  depth: 'pro',
  tone: 'pro',
  frameworks: { spin: true, challenger: true, medic: true, pas: false, aida: false },
  provider: 'hybrid',
  cta: 'call15',
  budgetMode: 'normal'
}

export default function App() {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [loading, setLoading] = useState(false)
  const [signals, setSignals] = useState<SignalItem[]>([])
  const [sectorCompanies, setSectorCompanies] = useState<CompanyItem[]>([])
  const [people, setPeople] = useState<PersonHit[]>([])
  const [objections, setObjections] = useState<ObjectionPack[]>([])
  const [result, setResult] = useState<ProspectResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const companiesToProcess = useMemo(() => {
    if (form.mode === 'single') {
      const { company, city } = parseQuery(form.query)
      return company ? [{ name: company, city: city || form.city }] : []
    }
    if (form.mode === 'multi') {
      const lines = (form.companies || '').split('\n').map(s => s.trim()).filter(Boolean)
      return lines.map(l => {
        const { company, city } = parseQuery(l)
        return { name: company, city }
      })
    }
    return (form.selectedCompanies || []).map(n => ({ name: n, city: form.sectorCity }))
  }, [form])

  async function fetchSignals(company: string, city: string) {
    try {
      const r = await fetch('/api/signals', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ company, city, limit: 5 }) })
      const d = await r.json(); return d.signals as SignalItem[]
    } catch { return [] }
  }
  async function fetchCompaniesBySector(sector: string, city: string) {
    try {
      const r = await fetch('/api/companies', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ sector, city }) })
      const d = await r.json(); return d.companies as CompanyItem[]
    } catch { return [] }
  }
  async function fetchPeople(company: string, city: string, offer: string) {
    try {
      const r = await fetch('/api/people', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ company, city, offer }) })
      const d = await r.json(); return d.people as PersonHit[]
    } catch { return [] }
  }
  async function fetchObjections(company: string, offer: string) {
    try {
      const r = await fetch('/api/objections', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ company, offer }) })
      const d = await r.json(); return d.packs as ObjectionPack[]
    } catch { return [] }
  }

  async function generate() {
    setLoading(true); setError(null); setResult(null)
    try {
      const c = companiesToProcess[0]
      if (!c) throw new Error('Renseigne l’entreprise (ou choisis des entreprises).')
      const [sig, ppl, obj] = await Promise.all([
        fetchSignals(c.name, c.city || ''),
        fetchPeople(c.name, c.city || '', form.offer || ''),
        fetchObjections(c.name, form.offer || '')
      ])
      setSignals(sig); setPeople(ppl); setObjections(obj)
      const derived = { ...form, company: c.name, city: c.city || '' }
      const sysPrompt = buildSystemPrompt(derived, sig, ppl, obj)
      const r = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: sysPrompt, language: form.language, strategy: form.provider || 'hybrid' })
      })
      const txt = await r.text()
      if (!r.ok) throw new Error(txt || ('HTTP ' + r.status))
      const data = JSON.parse(txt) as ProspectResult
      setResult(data)
    } catch(e:any) {
      setError(e.message || 'Erreur inconnue')
    } finally { setLoading(false) }
  }

  const canSubmit = useMemo(() => {
    if (form.mode === 'single') return form.query.trim().length > 1
    if (form.mode === 'multi') return (form.companies.trim().length > 1)
    return (form.sector.trim().length > 1 && form.selectedCompanies.length > 0)
  }, [form])

  const cost = estimateCost(form.budgetMode || 'normal', Math.max(1, companiesToProcess.length))

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <img src="./logo.svg" className="w-8 h-8" />
          <div>
            <h1 className="text-xl font-semibold">Prospeasy v3.3.3</h1>
            <p className="text-gray-600 text-sm">Single/Multi/Secteur · Signaux utiles · Décideurs · Messages SPIN/Challenger/MEDDIC.</p>
          </div>
        </div>
        <div className="text-xs text-gray-600">Coût estimé: ~€{cost.toFixed(2)}</div>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 card space-y-4">
          <h2 className="font-semibold">Paramètres</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Mode</label>
              <select value={form.mode} onChange={e=>setForm({...form, mode:e.target.value as any})} className="input">
                <option value="single">Single (Entreprise + Ville)</option>
                <option value="multi">Multi-entreprises (liste)</option>
                <option value="sector">Par secteur</option>
              </select>
            </div>

            {form.mode === 'single' && (
              <div>
                <label className="text-sm font-medium">Requête (Entreprise + Ville)</label>
                <input value={form.query} onChange={e=>setForm({...form, query:e.target.value})} className="input" placeholder="Ex: Gifi, Mérignac" />
              </div>
            )}

            {form.mode === 'multi' && (
              <div>
                <label className="text-sm font-medium">Entreprises (une par ligne)</label>
                <textarea value={form.companies} onChange={e=>setForm({...form, companies:e.target.value})} className="input" placeholder={"Ex:\nGifi, Mérignac\nBoulanger, Lille\n..."} rows={6} />
              </div>
            )}

            {form.mode === 'sector' && (
              <div className="space-y-2">
                <div>
                  <label className="text-sm font-medium">Secteur</label>
                  <input value={form.sector} onChange={e=>setForm({...form, sector:e.target.value})} className="input" placeholder="Ex: Retail, Foodtech..." />
                </div>
                <div>
                  <label className="text-sm font-medium">Zone (optionnel)</label>
                  <input value={form.sectorCity} onChange={e=>setForm({...form, sectorCity:e.target.value})} className="input" placeholder="Ex: Paris, Lyon..." />
                </div>
                <button className="btn" onClick={async ()=>{
                  const r = await fetch('/api/companies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sector: form.sector, city: form.sectorCity})})
                  const d = await r.json(); setSectorCompanies(d.companies||[])
                }}>Chercher des entreprises</button>
                {!!sectorCompanies.length && (
                  <div className="border rounded-xl p-3 max-h-48 overflow-auto">
                    {sectorCompanies.map((c,i)=>(
                      <label key={i} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.selectedCompanies.includes(c.name)} onChange={e=>{
                          const sel = new Set(form.selectedCompanies); e.target.checked? sel.add(c.name): sel.delete(c.name);
                          setForm({...form, selectedCompanies: Array.from(sel)})
                        }} />
                        <span>{c.name} <span className="text-gray-400">({c.source})</span></span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Votre offre</label>
              <textarea value={form.offer} onChange={e=>setForm({...form, offer:e.target.value})} className="input" placeholder="Ex: Solution IA qui automatise la prise de RDV multicanal" />
            </div>

            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium">Options avancées</summary>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Langue</label>
                    <select value={form.language} onChange={e=>setForm({...form, language:e.target.value as any})} className="input">
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Mode</label>
                    <select value={form.depth} onChange={e=>setForm({...form, depth:e.target.value as any})} className="input">
                      <option value="express">Express</option>
                      <option value="pro">Pro</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Ton</label>
                    <select value={form.tone} onChange={e=>setForm({...form, tone:e.target.value as any})} className="input">
                      <option value="pro">Professionnel</option>
                      <option value="friendly">Chaleureux</option>
                      <option value="challenger">Challenger</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Moteur IA</label>
                    <select value={form.provider || 'hybrid'} onChange={e=>setForm({...form, provider: e.target.value as any})} className="input">
                      <option value="auto">Auto</option>
                      <option value="openai">OpenAI/OpenRouter (GPT-5)</option>
                      <option value="gemini">Gemini (2.5 Pro)</option>
                      <option value="hybrid">Hybride (best-of-two)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Cadence/Coût</label>
                    <select value={form.budgetMode || 'normal'} onChange={e=>setForm({...form, budgetMode: e.target.value as any})} className="input">
                      <option value="eco">Éco</option>
                      <option value="normal">Normal</option>
                      <option value="quality">Qualité</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">CTA</label>
                    <select value={form.cta || 'call15'} onChange={e=>setForm({...form, cta: e.target.value as any})} className="input">
                      <option value="call15">Appel 15 min</option>
                      <option value="audit">Audit rapide</option>
                      <option value="demo">Démo 15 min</option>
                    </select>
                  </div>
                </div>
              </div>
            </details>

            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-600">Coût estimé: ~€{cost.toFixed(2)}</div>
              <div className="flex gap-2">
                <button className="btn btn-primary disabled:opacity-50" disabled={!canSubmit || loading} onClick={generate}>
                  {loading ? 'Génération...' : 'Générer'}
                </button>
                <button className="btn" onClick={()=>setForm(defaultForm)}>Réinitialiser</button>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          {error && <div className="card border border-red-300 bg-red-50 text-red-800 whitespace-pre-wrap">{error}</div>}

          {!!signals.length && (
            <div className="card">
              <h2 className="font-semibold mb-2">Signaux utiles</h2>
              <ul className="space-y-2 text-sm">
                {signals.map((s,i)=>(
                  <li key={i}>
                    <div className="flex items-center justify-between">
                      <span className="badge">{s.category}</span>
                      <span className="text-gray-500">{new Date(s.date).toLocaleDateString()} · {s.source}</span>
                    </div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-gray-700">{s.why_it_matters}</p>
                    <p className="text-gray-600">{s.summary}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!!people.length && (
            <div className="card">
              <h2 className="font-semibold mb-2">Décideurs (triés par fit)</h2>
              <ul className="space-y-2 text-sm">
                {people.map((p,i)=>(
                  <li key={i} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{p.name} — {p.role} @ {p.company}</p>
                      <p className="text-gray-700">{p.reason}</p>
                    </div>
                    <div className="badge">fit: {p.fit_score ?? 'n/a'}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result ? (
            <div className="space-y-3">
              <div className="card">
                <ResultCard data={result} />
              </div>
            </div>
          ) : (
            <div className="card text-gray-600">
              <p>Entrez une entreprise (ou un secteur), votre offre, puis cliquez <strong>Générer</strong>.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
