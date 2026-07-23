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
      <p class="eyebrow">{{ user.profile?.nickname }} 的印记</p>
      <h1>离开之后，<br />仍在世界某处。</h1>
      <p>你投出的文字无法收回，但它们在这里留下了被停留过的痕迹。</p>
    </section>
    <p v-if="error" class="form-error archive-error">{{ error }}</p>
    <div class="archive-grid">
      <HistoryList title="我的漂流瓶" :items="bottles" :loading="loading" @open="router.push({ name: 'bottle-detail', params: { id: $event } })" />
      <HistoryList title="我的纸飞机" :items="planes" :loading="loading" @open="router.push({ name: 'plane-detail', params: { id: $event } })" />
    </div>
  </main>
</template>
