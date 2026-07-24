import type {
  EchoItem,
  SoulDialogue,
  SoulMatchResult,
  SoulProfile,
  UserProfile,
} from '@/types'

const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

interface ApiEnvelope<T> {
  data: T
  message?: string
}

async function requestEnvelope<T>(path: string, options: RequestInit = {}): Promise<ApiEnvelope<T>> {
  if (!baseUrl) {
    throw new Error('未配置 VITE_API_BASE_URL。')
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const body = await response.json()
  if (!response.ok) {
    throw new Error(body.error?.message || '请求未能完成。')
  }
  return body as ApiEnvelope<T>
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const body = await requestEnvelope<T>(path, options)
  return body.data
}

export const echoApi = {
  createUser: (profile: UserProfile) =>
    request<UserProfile>('/users', { method: 'POST', body: JSON.stringify(profile) }),
  publish: (kind: 'bottle' | 'plane', userId: string, content: string) =>
    request<EchoItem>(`/${kind === 'bottle' ? 'bottles' : 'planes'}`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, content }),
    }),
  discoverBottle: (userId: string) =>
    requestEnvelope<EchoItem | null>(`/bottles/discover?user_id=${encodeURIComponent(userId)}`),
  discoverPlane: (userId: string) =>
    requestEnvelope<EchoItem | null>(`/planes/discover?user_id=${encodeURIComponent(userId)}`),
  getBottle: (id: string, userId: string) =>
    request<EchoItem>(`/bottles/${id}?user_id=${encodeURIComponent(userId)}`),
  getPlane: (id: string, userId: string) =>
    request<EchoItem>(`/planes/${id}?user_id=${encodeURIComponent(userId)}`),
  getMine: (kind: 'bottle' | 'plane', userId: string) =>
    request<EchoItem[]>(`/${kind === 'bottle' ? 'bottles' : 'planes'}/mine/${encodeURIComponent(userId)}`),
  toggleLike: (id: string, userId: string) =>
    request<{ liked: boolean }>(`/bottles/${id}/likes`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  togglePlaneLike: (id: string, userId: string) =>
    request<{ liked: boolean }>(`/planes/${id}/likes`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  comment: (id: string, userId: string, content: string) =>
    request<{ sent: boolean }>(`/bottles/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, content }),
    }),
  planeComment: (id: string, userId: string, content: string) =>
    request<{ sent: boolean }>(`/planes/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, content }),
    }),
  getSoulProfile: (userId = 'yeve', refresh = false) =>
    request<SoulProfile>(
      `/agent/profile?user_id=${encodeURIComponent(userId)}${refresh ? '&refresh=true' : ''}`,
    ),
  matchSoulAgents: (userId = 'yeve', limit = 3) =>
    request<SoulMatchResult>('/agent/match', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, limit }),
    }),
  runSoulDialogue: (userId = 'yeve', targetUserId?: string) =>
    request<SoulDialogue>('/agent/dialogue', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        ...(targetUserId ? { target_user_id: targetUserId } : {}),
      }),
    }),
  transcribeRingAudio: async (audio: Uint8Array): Promise<string> => {
    if (!baseUrl) throw new Error('未配置 VITE_API_BASE_URL。')
    const form = new FormData()
    const bytes = new ArrayBuffer(audio.byteLength)
    new Uint8Array(bytes).set(audio)
    form.append('file', new Blob([bytes], { type: 'application/octet-stream' }), 'ring-recording.bin')
    const response = await fetch(`${baseUrl}/audio/transcriptions`, { method: 'POST', body: form })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error?.message || '语音转文字失败。')
    return body.data.text as string
  },
}
