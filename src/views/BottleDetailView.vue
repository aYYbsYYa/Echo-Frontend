<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { echoApi } from '@/api/echo'
import AppHeader from '@/components/AppHeader.vue'
import { useUserStore } from '@/stores/user'
import type { EchoItem } from '@/types'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const item = ref<EchoItem | null>(null)
const comment = ref('')
const error = ref('')
const commenting = ref(false)

async function load() {
  if (!user.profile) return
  try {
    item.value = await echoApi.getBottle(String(route.params.id), user.profile.id)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '无法打开这只漂流瓶。'
  }
}

async function like() {
  if (!item.value || !user.profile) return
  try {
    const result = await echoApi.toggleLike(item.value.id, user.profile.id)
    item.value.liked = result.liked
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '操作未能完成。'
  }
}

async function sendComment() {
  if (!item.value || !user.profile || !comment.value.trim()) return
  commenting.value = true
  try {
    await echoApi.comment(item.value.id, user.profile.id, comment.value)
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
  <main class="detail-shell">
    <AppHeader />
    <button class="back-button" type="button" @click="router.back()">返回海面</button>
    <article v-if="item" class="bottle-letter">
      <div class="letter-meta"><span>{{ item.avatar }} {{ item.nickname }}</span><span>{{ item.region }}</span></div>
      <p class="letter-content">{{ item.content }}</p>
      <p class="letter-date">{{ new Date(item.created_at).toLocaleString('zh-CN') }}</p>
      <div v-if="!item.is_author" class="letter-actions">
        <button type="button" :class="{ selected: item.liked }" @click="like">{{ item.liked ? '已留下心意' : '留下心意' }}</button>
        <form @submit.prevent="sendComment"><input v-model="comment" maxlength="500" placeholder="留一句话给作者" /><button :disabled="commenting" type="submit">送出</button></form>
        <button class="report-button" type="button">举报</button>
      </div>
      <div v-else class="author-insight">
        <p>被阅读 {{ item.views }} 次 · 收到 {{ item.likes || 0 }} 次心意</p>
        <blockquote v-if="item.reply">{{ item.reply }}</blockquote>
        <div v-if="item.comments?.length" class="private-comments"><h2>留给你的话</h2><p v-for="entry in item.comments" :key="entry.id">{{ entry.content }}</p></div>
      </div>
    </article>
    <p v-else-if="error" class="form-error">{{ error }}</p>
    <p v-else class="quiet-state">正在打开漂流瓶...</p>
  </main>
</template>
