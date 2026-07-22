<script setup lang="ts">
import { computed } from 'vue'

import type { EchoItem } from '@/types'

const props = defineProps<{ item: EchoItem | null; loading: boolean; emptyMessage: string }>()
const emit = defineEmits<{ open: [id: string] }>()
const date = computed(() =>
  props.item ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(props.item.created_at)) : '',
)
</script>

<template>
  <article class="discovery-card" :class="{ 'is-plane': item?.type === 'plane' }">
    <div v-if="loading" class="quiet-state">正在等一段文字靠岸...</div>
    <template v-else-if="item">
      <span class="object-mark" aria-hidden="true">{{ item.type === 'bottle' ? '◒' : '⌁' }}</span>
      <p class="echo-content">{{ item.content }}</p>
      <footer>
        <span class="author-line"><b>{{ item.avatar }}</b>{{ item.nickname }} · {{ item.region }}</span>
        <span>{{ date }}</span>
      </footer>
      <button class="text-button" type="button" @click="emit('open', item.id)">停下来读一会</button>
    </template>
    <div v-else class="quiet-state">{{ emptyMessage }}</div>
  </article>
</template>
