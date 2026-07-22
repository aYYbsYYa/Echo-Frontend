import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { echoApi } from '@/api/echo'
import type { UserProfile } from '@/types'

const STORAGE_KEY = 'echo.user'

function createId(profile: Pick<UserProfile, 'nickname' | 'birthday' | 'gender'>): string {
  const input = `${profile.nickname}:${profile.birthday}:${profile.gender}:${Date.now()}:${crypto.randomUUID()}`
  let hash = 2166136261
  for (const char of input) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return `usr_${(hash >>> 0).toString(36)}${Date.now().toString(36)}`
}

export const useUserStore = defineStore('user', () => {
  const profile = ref<UserProfile | null>(null)
  const ready = ref(false)
  const isInitialized = computed(() => profile.value !== null)

  function hydrate() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        profile.value = JSON.parse(stored) as UserProfile
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    ready.value = true
  }

  async function initialize(values: Omit<UserProfile, 'id' | 'avatar'>) {
    const nickname = values.nickname.trim()
    const next: UserProfile = {
      ...values,
      nickname,
      id: createId({ ...values, nickname }),
      avatar: nickname[0],
    }
    const created = await echoApi.createUser(next)
    profile.value = created
    localStorage.setItem(STORAGE_KEY, JSON.stringify(created))
  }

  return { profile, ready, isInitialized, hydrate, initialize }
})
