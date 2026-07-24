<script setup lang="ts">
import { resolveMediaUrl } from '@/api/echo'
import type { EchoItem } from '@/types'
import { formatRelativeTime } from '@/utils/time'

defineProps<{ title: string; items: EchoItem[]; loading: boolean }>()
const emit = defineEmits<{ open: [id: string] }>()
</script>

<template>
  <section class="history-list">
    <div class="section-heading"><h2>{{ title }}</h2><span>{{ items.length }}</span></div>
    <p v-if="loading" class="quiet-state">正在整理漂流轨迹...</p>
    <p v-else-if="!items.length" class="quiet-state">这里还没有离开你手边的话。</p>
    <button v-for="item in items" v-else :key="item.id" class="history-item" :class="{ 'has-image': item.image_url }" type="button" @click="emit('open', item.id)">
      <span class="history-symbol">{{ item.type === 'bottle' ? '◒' : '⌁' }}</span>
      <img v-if="item.image_url" class="history-thumb" :src="resolveMediaUrl(item.image_url)" alt="" />
      <span class="history-copy">{{ item.content }}</span>
      <time :datetime="item.created_at">{{ formatRelativeTime(item.created_at) }}</time>
      <span class="history-metrics">{{ item.views }} 次停留<span v-if="item.likes !== undefined"> · {{ item.likes }} 赞</span></span>
    </button>
  </section>
</template>
