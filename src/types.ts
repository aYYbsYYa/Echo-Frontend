export type EchoKind = 'bottle' | 'plane'
export type DiscoverMode = 'random' | 'echo'

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
