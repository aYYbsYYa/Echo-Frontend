<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { echoApi, resolveMediaUrl } from '@/api/echo'
import { useUserStore } from '@/stores/user'
import type { EchoItem } from '@/types'
import { formatDriftDuration, formatFlightDuration, formatRelativeTime } from '@/utils/time'

const props = defineProps<{ item: EchoItem | null; loading: boolean; emptyMessage: string }>()
const user = useUserStore()
const detailItem = ref<EchoItem | null>(null)
const comment = ref('')
const commenting = ref(false)
const error = ref('')
const loadingDetail = ref(false)

const displayTime = computed(() => {
  if (!detailItem.value) return ''
  return detailItem.value.type === 'bottle'
    ? formatDriftDuration(detailItem.value.created_at)
    : formatFlightDuration(detailItem.value.created_at)
})

const sceneLabel = computed(() => {
  if (detailItem.value?.type !== 'plane') return ''
  const labels = { sky: '飞向天空', window: '落在窗边', tree: '停在树梢' }
  return labels[detailItem.value.scene || 'sky']
})

async function loadDetail() {
  if (!props.item || !user.profile) return
  loadingDetail.value = true
  error.value = ''
  try {
    if (props.item.type === 'bottle') {
      detailItem.value = await echoApi.getBottle(props.item.id, user.profile.id)
    } else {
      detailItem.value = await echoApi.getPlane(props.item.id, user.profile.id)
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '无法加载详情。'
  } finally {
    loadingDetail.value = false
  }
}

async function like() {
  if (!detailItem.value || !user.profile) return
  try {
    const result = detailItem.value.type === 'bottle'
      ? await echoApi.toggleLike(detailItem.value.id, user.profile.id)
      : await echoApi.togglePlaneLike(detailItem.value.id, user.profile.id)
    detailItem.value.liked = result.liked
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '操作未能完成。'
  }
}

async function sendComment() {
  if (!detailItem.value || !user.profile || !comment.value.trim()) return
  commenting.value = true
  try {
    if (detailItem.value.type === 'bottle') {
      await echoApi.comment(detailItem.value.id, user.profile.id, comment.value)
    } else {
      await echoApi.planeComment(detailItem.value.id, user.profile.id, comment.value)
    }
    comment.value = ''
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '留言未能送达。'
  } finally {
    commenting.value = false
  }
}

watch(() => props.item, (newItem) => {
  if (newItem) {
    loadDetail()
  } else {
    detailItem.value = null
    comment.value = ''
    error.value = ''
  }
})

onMounted(() => {
  if (props.item) loadDetail()
})
</script>

<template>
  <article class="discovery-card" :class="{ 'is-plane': item?.type === 'plane' }">
    <div v-if="loading" class="quiet-state">正在等一段文字靠岸...</div>
    <template v-else-if="item && detailItem">
      <span class="object-mark" aria-hidden="true">{{ detailItem.type === 'bottle' ? '◒' : '⌁' }}</span>
      
      <div v-if="detailItem.type === 'plane'" class="detail-scene-label">
        <span>⌁ 纸飞机</span>
        <span>{{ sceneLabel }}</span>
      </div>
      
      <div class="detail-meta">
        <span>{{ detailItem.avatar }} {{ detailItem.nickname }}</span>
        <span>{{ detailItem.region }}</span>
        <span>{{ displayTime }}</span>
      </div>

      <img v-if="detailItem.image_url" class="discovery-image" :src="resolveMediaUrl(detailItem.image_url)" :alt="`${detailItem.type === 'bottle' ? '漂流瓶' : '纸飞机'}中的图片`" />
      
      <p class="echo-content">{{ detailItem.content }}</p>

      <div v-if="!detailItem.is_author" class="detail-actions">
        <button type="button" :class="{ selected: detailItem.liked }" @click="like">
          {{ detailItem.liked ? '已留下心意' : '留下心意' }}
        </button>
        <form @submit.prevent="sendComment">
          <input v-model="comment" maxlength="500" placeholder="留一句话给作者" />
          <button :disabled="commenting" type="submit">送出</button>
        </form>
        <button class="report-button" type="button">举报</button>
      </div>

      <div v-else class="detail-author-insight">
        <p>被阅读 {{ detailItem.views }} 次 · 收到 {{ detailItem.likes || 0 }} 次心意</p>
        <blockquote v-if="detailItem.reply">{{ detailItem.reply }}</blockquote>
        <p v-else class="reply-pending">开发组暂未回信</p>
        <div v-if="detailItem.comments?.length" class="detail-comments">
          <h3>留给你的话</h3>
          <div v-for="entry in detailItem.comments" :key="entry.id" class="comment-entry">
            <p class="comment-meta">来自 {{ entry.nickname }} · {{ formatRelativeTime(entry.created_at) }}</p>
            <p>{{ entry.content }}</p>
          </div>
        </div>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>
    </template>
    <div v-else-if="loadingDetail" class="quiet-state">正在加载详情...</div>
    <div v-else class="quiet-state">{{ emptyMessage }}</div>
  </article>
</template>
