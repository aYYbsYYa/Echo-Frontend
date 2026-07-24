import type {
  EchoItem,
  SoulDialogue,
  SoulDialogueStreamEvent,
  SoulMatchResult,
  SoulProfile,
  UserProfile,
} from '@/types'

const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

export function resolveMediaUrl(path?: string | null): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const origin = baseUrl ? new URL(baseUrl, window.location.origin).origin : window.location.origin
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`
}

interface ApiEnvelope<T> {
  data: T
  message?: string
}

async function requestEnvelope<T>(path: string, options: RequestInit = {}): Promise<ApiEnvelope<T>> {
  if (!baseUrl) {
    throw new Error('未配置 VITE_API_BASE_URL。')
  }

  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
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

async function streamSoulDialogue(
  userId: string,
  targetUserId: string | undefined,
  onEvent: (event: SoulDialogueStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!baseUrl) throw new Error('未配置 VITE_API_BASE_URL。')
  const response = await fetch(`${baseUrl}/agent/dialogue/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      ...(targetUserId ? { target_user_id: targetUserId } : {}),
    }),
    signal,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error?.message || '实时对话请求未能完成。')
  }
  if (!response.body) throw new Error('浏览器无法读取实时对话。')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completed = false

  const consumeLine = (line: string) => {
    if (!line.trim()) return
    let event: SoulDialogueStreamEvent
    try {
      event = JSON.parse(line) as SoulDialogueStreamEvent
    } catch {
      throw new Error('实时对话响应格式异常。')
    }
    onEvent(event)
    if (event.type === 'error') throw new Error(event.data.message)
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) consumeLine(line)
      if (done) break
    }
    consumeLine(buffer)
    completed = true
  } finally {
    if (!completed) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

export const echoApi = {
  createUser: (profile: UserProfile) =>
    request<UserProfile>('/users', { method: 'POST', body: JSON.stringify(profile) }),
  publish: (kind: 'bottle' | 'plane', userId: string, content: string, image?: File | null) => {
    const path = `/${kind === 'bottle' ? 'bottles' : 'planes'}`
    if (!image) {
      return request<EchoItem>(path, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, content }),
      })
    }
    const form = new FormData()
    form.append('user_id', userId)
    form.append('content', content)
    form.append('image', image)
    return request<EchoItem>(path, { method: 'POST', body: form, headers: {} })
  },
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
  streamSoulDialogue,
  getSoulDialogues: (userId = 'yeve') =>
    request<SoulDialogue[]>(`/agent/dialogues?user_id=${encodeURIComponent(userId)}`),
  deleteSoulDialogue: (dialogueId: string, userId = 'yeve') =>
    request<{ id: string; deleted: boolean }>(
      `/agent/dialogues/${encodeURIComponent(dialogueId)}?user_id=${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    ),
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
