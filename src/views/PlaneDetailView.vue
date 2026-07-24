<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { echoApi, resolveMediaUrl } from '@/api/echo'
import AppHeader from '@/components/AppHeader.vue'
import { useUserStore } from '@/stores/user'
import type { EchoItem } from '@/types'
import { formatFlightDuration, formatRelativeTime } from '@/utils/time'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const item = ref<EchoItem | null>(null)
const error = ref('')
const comment = ref('')
const commenting = ref(false)
const sceneLabel = computed(() => {
  const labels = { sky: '飞向天空', window: '落在窗边', tree: '停在树梢' }
  return labels[item.value?.scene || 'sky']
})

async function load() {
  if (!user.profile) return
  try {
    item.value = await echoApi.getPlane(String(route.params.id), user.profile.id)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '无法打开这架纸飞机。'
  }
}

async function like() {
  if (!item.value || !user.profile) return
  try {
    const result = await echoApi.togglePlaneLike(item.value.id, user.profile.id)
    item.value.liked = result.liked
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '操作未能完成。'
  }
}

async function sendComment() {
  if (!item.value || !user.profile || !comment.value.trim()) return
  commenting.value = true
  try {
    await echoApi.planeComment(item.value.id, user.profile.id, comment.value)
    comment.value = ''
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '留言未能送达。'
  } finally {
    commenting.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="plane-detail-shell">
    <AppHeader />
    <button class="plane-back-button" type="button" @click="router.push({ name: 'history' })">返回档案</button>
    <article v-if="item" class="plane-letter" :class="`scene-${item.scene || 'sky'}`">
      <header class="plane-letter-header">
        <span>⌁ 纸飞机</span>
        <span>{{ sceneLabel }}</span>
      </header>
      <img v-if="item.image_url" class="plane-image" :src="resolveMediaUrl(item.image_url)" alt="纸飞机带来的图片" />
      <p class="plane-content">{{ item.content }}</p>
      <p class="plane-date">{{ formatFlightDuration(item.created_at) }}</p>
      <div v-if="!item.is_author" class="plane-actions">
        <button type="button" :class="{ selected: item.liked }" @click="like">{{ item.liked ? '已留下心意' : '留下心意' }}</button>
        <form @submit.prevent="sendComment"><input v-model="comment" maxlength="500" placeholder="留一句话给作者" /><button :disabled="commenting" type="submit">送出</button></form>
        <button class="report-button" type="button">举报</button>
      </div>
      <div v-else class="plane-author-insight">
        <p>被阅读 {{ item.views }} 次 · 收到 {{ item.likes || 0 }} 次心意</p>
        <blockquote v-if="item.reply" class="plane-reply">{{ item.reply }}</blockquote>
        <p v-else class="plane-reply-pending">开发组暂未回信</p>
        <div v-if="item.comments?.length" class="plane-comments">
          <h2>留给你的话</h2>
          <div v-for="entry in item.comments" :key="entry.id" class="plane-comment-entry">
            <p class="plane-comment-meta">来自 {{ entry.nickname }} · {{ formatRelativeTime(entry.created_at) }}</p>
            <p>{{ entry.content }}</p>
          </div>
        </div>
      </div>
      <footer class="plane-letter-footer">
        <span>{{ item.nickname }} · {{ item.region }}</span>
        <span>投出于 {{ new Date(item.created_at).toLocaleString('zh-CN') }}</span>
      </footer>
    </article>
    <p v-else-if="error" class="form-error plane-error">{{ error }}</p>
    <p v-else class="quiet-state">正在打开纸飞机...</p>
  </main>
</template>
