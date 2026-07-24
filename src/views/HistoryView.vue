<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { echoApi } from '@/api/echo'
import AppHeader from '@/components/AppHeader.vue'
import HistoryList from '@/components/HistoryList.vue'
import { useUserStore } from '@/stores/user'
import type { EchoItem } from '@/types'

const user = useUserStore()
const router = useRouter()
const bottles = ref<EchoItem[]>([])
const planes = ref<EchoItem[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  if (!user.profile) return
  try {
    ;[bottles.value, planes.value] = await Promise.all([
      echoApi.getMine('bottle', user.profile.id),
      echoApi.getMine('plane', user.profile.id),
    ])
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '档案暂时无法打开。'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="archive-shell">
    <AppHeader />
    <section class="archive-heading">
      <p class="eyebrow">{{ user.profile?.nickname }} 的漂流年表</p>
      <h1>离开之后，<br /><em>仍在世界某处。</em></h1>
      <p>你投出的文字无法收回，但时间替它们留下了漂流、抵达与被停留过的痕迹。</p>
      <div class="archive-summary"><span><b>{{ bottles.length + planes.length }}</b> 次出发</span><span><b>{{ bottles.reduce((sum, item) => sum + item.views, 0) + planes.reduce((sum, item) => sum + item.views, 0) }}</b> 次停留</span></div>
    </section>
    <p v-if="error" class="form-error archive-error">{{ error }}</p>
    <div class="archive-grid">
      <HistoryList title="我的漂流瓶" :items="bottles" :loading="loading" @open="router.push({ name: 'bottle-detail', params: { id: $event } })" />
      <HistoryList title="我的纸飞机" :items="planes" :loading="loading" @open="router.push({ name: 'plane-detail', params: { id: $event } })" />
    </div>
  </main>
</template>
