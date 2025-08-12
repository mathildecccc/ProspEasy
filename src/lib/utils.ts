export function copyToClipboard(text: string) { navigator.clipboard.writeText(text) }
export function nowISO() { return new Date().toISOString().slice(0,19).replace('T','_') }

export function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}
export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}

export function parseQuery(q: string): { company: string; city: string } {
  const s = (q || '').trim()
  if (!s) return { company: '', city: '' }
  const idx = s.indexOf(',')
  if (idx !== -1) return { company: s.slice(0, idx).trim(), city: s.slice(idx + 1).trim() }
  for (const sep of [' in ', ' à ', ' a ', ' @ ']) {
    const pos = s.toLowerCase().indexOf(sep)
    if (pos !== -1) return { company: s.slice(0, pos).trim(), city: s.slice(pos + sep.length).trim() }
  }
  return { company: s, city: '' }
}

export function estimateCost(mode: 'eco'|'normal'|'quality', companiesCount: number) {
  const per = mode === 'eco' ? 0.002 : mode === 'quality' ? 0.02 : 0.008
  return Math.round(per * companiesCount * 100) / 100
}
