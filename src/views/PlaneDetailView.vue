<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { echoApi } from '@/api/echo'
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

<style scoped>
.plane-detail-shell {
  min-height: 100vh;
  padding-bottom: 80px;
  background: #101e28;
}

.plane-back-button {
  display: block;
  width: min(780px, calc(100% - 48px));
  margin: 45px auto 18px;
  padding: 0;
  border: 0;
  color: #aac5bd;
  background: none;
  text-align: left;
  font-size: 13px;
}

.plane-letter {
  width: min(780px, calc(100% - 48px));
  min-height: 420px;
  margin: auto;
  padding: clamp(30px, 7vw, 72px);
  border-top: 5px solid #d8c77b;
  color: #f5f0df;
  background: #28372f;
  box-shadow: 16px 18px 0 rgba(0, 0, 0, .12);
}

.plane-letter.scene-sky { background: #284150; }
.plane-letter.scene-window { background: #39413b; }
.plane-letter.scene-tree { background: #28372f; }

.plane-letter-header,
.plane-letter-footer {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  color: #c1d1c5;
  font-size: 13px;
}

.plane-content {
  max-width: 620px;
  margin: 72px 0;
  font-family: Georgia, "Songti SC", serif;
  font-size: clamp(26px, 4vw, 40px);
  line-height: 1.6;
  white-space: pre-wrap;
}

.plane-views {
  margin-top: 24px;
  color: #93aaa2;
  font-size: 13px;
}

.plane-date {
  margin: 0 0 28px;
  color: #c1d1c5;
  font-size: 13px;
}

.plane-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 34px;
}

.plane-actions button,
.plane-actions input {
  min-height: 36px;
  padding: 0 11px;
  border: 1px solid #82978d;
  border-radius: 3px;
  background: transparent;
  color: #e4eee7;
}

.plane-actions button.selected {
  background: #d9be76;
  border-color: #d9be76;
  color: #263d42;
}

.plane-actions form {
  display: flex;
  gap: 6px;
}

.plane-actions input {
  width: 175px;
}

.plane-actions .report-button {
  margin-left: auto;
  color: #e6aaa0;
  border-color: transparent;
}

.plane-author-insight {
  margin-top: 34px;
  padding-top: 25px;
  border-top: 1px solid rgba(196, 205, 194, .35);
}

.plane-author-insight > p {
  color: #c1d1c5;
}

.plane-comments h2 {
  font-size: 14px;
  font-weight: 600;
}

.plane-comment-entry {
  padding: 11px 0;
  border-bottom: 1px solid rgba(204, 212, 202, .25);
}

.plane-comment-entry p {
  margin: 0;
}

.plane-comment-entry .plane-comment-meta {
  padding-bottom: 5px;
  color: #a8c0ba;
  font-size: 12px;
}

.plane-reply {
  margin: 0 0 36px;
  padding: 16px;
  border-left: 3px solid #d8c77b;
  color: #e2eadf;
  white-space: pre-line;
  line-height: 1.7;
}

.plane-reply-pending {
  margin: 0 0 36px;
  color: #93aaa2;
  font-size: 13px;
}

.plane-error {
  width: min(780px, calc(100% - 48px));
  margin: 40px auto;
}

@media (max-width: 680px) {
  .plane-letter-header,
  .plane-letter-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .plane-actions form {
    width: 100%;
  }

  .plane-actions input {
    flex: 1;
  }

  .plane-actions .report-button {
    margin-left: 0;
  }
}
</style>
