<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { echoApi } from '@/api/echo'
import AppHeader from '@/components/AppHeader.vue'
import { useUserStore } from '@/stores/user'
import type { EchoItem } from '@/types'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const item = ref<EchoItem | null>(null)
const error = ref('')
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
      <blockquote v-if="item.reply" class="plane-reply">{{ item.reply }}</blockquote>
      <p v-else class="plane-reply-pending">开发组暂未回信</p>
      <footer class="plane-letter-footer">
        <span>{{ item.nickname }} · {{ item.region }}</span>
        <span>投出于 {{ new Date(item.created_at).toLocaleString('zh-CN') }}</span>
      </footer>
      <p class="plane-views">被停留 {{ item.views }} 次</p>
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
}
</style>
