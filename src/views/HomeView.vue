<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { echoApi } from '@/api/echo'
import AppHeader from '@/components/AppHeader.vue'
import ComposePanel from '@/components/ComposePanel.vue'
import DiscoveryCard from '@/components/DiscoveryCard.vue'
import { useUserStore } from '@/stores/user'
import type { DiscoverMode, EchoItem } from '@/types'

const user = useUserStore()
const router = useRouter()
const item = ref<EchoItem | null>(null)
const loading = ref(false)
const selectedKind = ref<'bottle' | 'plane'>('bottle')
const mode = ref<DiscoverMode>('random')
const notice = ref('把一句话放进海里，或者等一句话向你靠岸。')

async function discover() {
  if (!user.profile) return
  loading.value = true
  item.value = null
  try {
    item.value = selectedKind.value === 'bottle'
      ? await echoApi.discoverBottle(user.profile.id, mode.value)
      : await echoApi.discoverPlane(user.profile.id)
    notice.value = item.value ? '' : '此刻没有新的漂流物，海面仍在等候。'
  } catch (error) {
    notice.value = error instanceof Error ? error.message : '暂时无法抵达海面。'
  } finally {
    loading.value = false
  }
}

function onPublished(_kind: 'bottle' | 'plane', message: string) {
  notice.value = message
}
</script>

<template>
  <main class="sea-shell">
    <AppHeader />
    <section class="sea-stage">
      <div class="horizon" aria-hidden="true"></div>
      <div class="floating-bottle" aria-hidden="true"><i></i></div>
      <div class="hero-copy">
        <p class="eyebrow">不必被认识</p>
        <h1>让文字自己<br />去遇见世界。</h1>
        <p>{{ notice }}</p>
      </div>
      <ComposePanel @published="onPublished" />
    </section>

    <section class="discovery-zone">
      <div class="discover-controls">
        <div class="segment-control" role="tablist" aria-label="接收类型">
          <button :class="{ active: selectedKind === 'bottle' }" type="button" @click="selectedKind = 'bottle'">捞漂流瓶</button>
          <button :class="{ active: selectedKind === 'plane' }" type="button" @click="selectedKind = 'plane'">接纸飞机</button>
        </div>
        <div v-if="selectedKind === 'bottle'" class="mode-picker">
          <label><input v-model="mode" value="random" type="radio" /> 随机</label>
          <label><input v-model="mode" value="echo" type="radio" /> Echo</label>
        </div>
        <button class="discover-button" type="button" :disabled="loading" @click="discover">
          {{ loading ? '正在靠岸' : selectedKind === 'bottle' ? '捞起一只' : '等一阵风' }}
        </button>
      </div>
      <DiscoveryCard :item="item" :loading="loading" :empty-message="notice" @open="router.push({ name: 'bottle-detail', params: { id: $event } })" />
    </section>
  </main>
</template>
