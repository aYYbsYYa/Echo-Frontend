export type EchoKind = 'bottle' | 'plane'

export interface UserProfile {
  id: string
  nickname: string
  birthday: string
  gender: string
  region: string
  avatar: string
}

export interface EchoItem {
  id: string
  content: string
  nickname: string
  avatar: string
  region: string
  created_at: string
  type: EchoKind
  scene?: 'sky' | 'window' | 'tree'
  views: number
  likes?: number
  comments?: EchoComment[]
  reply?: string | null
  liked?: boolean
  is_author?: boolean
}

export interface EchoComment {
  id: string
  content: string
  nickname: string
  created_at: string
}

export interface SoulPersona {
  identity: string
  traits: string[]
  emotion_pattern: string[]
  interests: string[]
  values: string[]
}

export interface SoulProfile {
  id: string
  user_id: string
  name: string
  history_count: number
  persona: SoulPersona
  communication_style: { tone: string }
  generated_by: 'ai' | 'demo_fallback' | 'demo_seed'
  updated_at: string
}

export interface SoulMatch {
  user_id: string
  agent: string
  score: number
  reason: string[]
  preview: string
}

export interface SoulMatchResult {
  id: string
  user_id: string
  matches: SoulMatch[]
  created_at: string
}

export interface SoulDialogueMessage {
  from: string
  user_id: string
  text: string
}

export interface SoulDialogue {
  id: string
  agent_a: string
  agent_b: string
  score: number
  reason: string[]
  conversation: SoulDialogueMessage[]
  echo: string
  created_at: string
}
