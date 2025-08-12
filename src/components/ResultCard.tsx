import { copyToClipboard, downloadJSON, downloadText, nowISO } from '../lib/utils'
import type { ProspectResult } from '../lib/types'
export default function ResultCard({ data }: { data: ProspectResult }) {
  const fileBase = `${data.entreprise_cible.replace(/\W+/g,'-').toLowerCase()}_${nowISO()}`
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Résultat — {data.entreprise_cible}</h2>
          <p className="text-sm text-gray-600">{data.localisation}</p>
          {data.provider_used && <p className="text-xs text-gray-500 mt-1">Généré via <span className="font-medium">{data.provider_used}</span> · {data.model_used}</p>}
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => downloadJSON(fileBase + ".json", data)}>Exporter JSON</button>
          <button className="btn" onClick={() => downloadText(fileBase + ".md", data.raw_markdown)}>Exporter Markdown</button>
        </div>
      </div>
      <div className="mt-4 space-y-6">
        <section>
          <h3 className="font-semibold">Actualité & Enjeux</h3>
          <p className="text-gray-800 whitespace-pre-wrap">{data.actualite_et_enjeux}</p>
        </section>
        <section>
          <h3 className="font-semibold">Profils Cibles (x3)</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {data.prospects.map((p, i) => (
              <div key={i} className="border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{p.name ? `${p.name} — ` : ''}{p.role} — {p.niveau}</p>
                  <button className="btn text-xs" onClick={() => copyToClipboard(p.message_linkedin_invite)}>Copier Inv.</button>
                </div>
                {p.name && p.profile_url && <p className="text-xs text-gray-500 mt-1">{p.profile_url}</p>}
                <div className="text-sm mt-2">
                  <p className="text-gray-700 whitespace-pre-wrap"><span className="font-medium">Pourquoi eux :</span> {p.why}</p>
                  <p className="font-medium mt-2">Plan SPIN</p>
                  <ul className="list-disc ml-5">
                    <li><strong>Situation:</strong> {p.spin_outline?.situation}</li>
                    <li><strong>Problème:</strong> {p.spin_outline?.problem}</li>
                    <li><strong>Implication:</strong> {p.spin_outline?.implication}</li>
                    <li><strong>Need-payoff:</strong> {p.spin_outline?.need_payoff}</li>
                  </ul>
                  <div className="mt-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">Invitation LinkedIn <span className="text-xs text-gray-500">({(p.message_linkedin_invite||'').length} car.)</span></p>
                      <button className="btn text-xs" onClick={() => copyToClipboard(p.message_linkedin_invite)}>Copier</button>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap mt-1">{p.message_linkedin_invite}</p>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">Message après acceptation</p>
                      <button className="btn text-xs" onClick={() => copyToClipboard(p.message_linkedin_after_accept)}>Copier</button>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap mt-1">{p.message_linkedin_after_accept}</p>
                  </div>
                  <div className="mt-2">
                    <p className="font-medium">Email</p>
                    <p className="text-gray-700 whitespace-pre-wrap"><strong>Sujet:</strong> {p.email.sujet}</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{p.email.corps}</p>
                  </div>
                  <div className="mt-2">
                    <p className="font-medium">Relances</p>
                    <ul className="list-disc ml-5">
                      {p.sequence_relance.map((x, j) => <li key={j} className="whitespace-pre-wrap">{x}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Invitation LinkedIn (générale)</h4>
              <button className="btn text-xs" onClick={() => copyToClipboard(data.linkedin_invite)}>Copier</button>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap mt-2">{data.linkedin_invite}</p>
          </div>
          <div className="border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Message LinkedIn (général)</h4>
              <button className="btn text-xs" onClick={() => copyToClipboard(data.linkedin_message)}>Copier</button>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap mt-2">{data.linkedin_message}</p>
          </div>
        </section>
        <section className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Email principal</h4>
              <button className="btn text-xs" onClick={() => copyToClipboard(data.email.corps)}>Copier</button>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap mt-2"><strong>Sujet:</strong> {data.email.sujet}</p>
            <p className="text-gray-700 whitespace-pre-wrap mt-1">{data.email.corps}</p>
          </div>
          <div className="border rounded-xl p-4">
            <h4 className="font-semibold">Relances Email</h4>
            <ul className="list-disc ml-5 text-gray-700">
              {data.email_followups.map((x, i) => <li key={i} className="whitespace-pre-wrap">{x}</li>)}
            </ul>
          </div>
        </section>
        <section className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-xl p-4">
            <h4 className="font-semibold">Script d’appel</h4>
            <p className="text-gray-700 whitespace-pre-wrap mt-2">{data.call_script}</p>
          </div>
          <div className="border rounded-xl p-4">
            <h4 className="font-semibold">Plan d’action (7 jours)</h4>
            <p className="text-gray-700 whitespace-pre-wrap mt-2">{data.plan_action}</p>
          </div>
        </section>
      </div>
    </div>
  )
}
