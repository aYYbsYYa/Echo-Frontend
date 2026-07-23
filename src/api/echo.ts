import type { DiscoverMode, EchoItem, UserProfile } from '@/types'

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
  discoverBottle: (userId: string, mode: DiscoverMode) =>
    requestEnvelope<EchoItem | null>(`/bottles/discover?user_id=${encodeURIComponent(userId)}&mode=${mode}`),
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
}
