export type DepthMode = 'express' | 'pro'
export type Mode = 'single' | 'multi' | 'sector'

export interface FormState {
  mode: Mode
  query: string
  companies: string
  sector: string
  sectorCity: string
  selectedCompanies: string[]
  company: string
  city: string
  offer: string
  language: 'fr' | 'en'
  depth: DepthMode
  tone: 'pro' | 'friendly' | 'challenger'
  frameworks: { spin: boolean, challenger: boolean, medic: boolean, pas: boolean, aida: boolean }
  provider?: 'auto' | 'openai' | 'gemini' | 'hybrid'
  cta?: 'call15' | 'audit' | 'demo'
  budgetMode?: 'eco' | 'normal' | 'quality'
}

export interface SignalItem {
  title: string; summary: string; source: string; date: string; category: string; why_it_matters: string; url?: string
}

export interface CompanyItem { name: string; source: string }

export interface PersonHit {
  name: string; role: string; company: string; url: string; source: string; reason: string; fit_score?: number
}

export interface ProspectResult {
  entreprise_cible: string
  localisation: string
  actualite_et_enjeux: string
  prospects: Array<{
    name?: string
    profile_url?: string
    role: string
    niveau: string
    priorites: string[]
    objections: string[]
    why: string
    spin_outline: { situation: string, problem: string, implication: string, need_payoff: string }
    message_linkedin_invite: string
    message_linkedin_after_accept: string
    email: { sujet: string, corps: string }
    sequence_relance: string[]
  }>
  linkedin_invite: string
  linkedin_message: string
  email: { sujet: string, corps: string }
  email_followups: string[]
  call_script: string
  plan_action: string
  raw_markdown: string
  provider_used?: string
  model_used?: string
}

export interface ObjectionPack {
  persona: string
  objections: Array<{ title: string, rationale: string, counter_argument: string, proof: string, next_step: string }>
}
