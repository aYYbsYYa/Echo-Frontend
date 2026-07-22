<script setup lang="ts">
import { ref } from 'vue'

import { echoApi } from '@/api/echo'
import { useUserStore } from '@/stores/user'
import type { EchoKind } from '@/types'

const emit = defineEmits<{ published: [kind: EchoKind, message: string] }>()
const user = useUserStore()
const kind = ref<EchoKind>('bottle')
const content = ref('')
const status = ref('')
const sending = ref(false)

async function publish() {
  if (!content.value.trim() || !user.profile) return
  sending.value = true
  status.value = ''
  try {
    await echoApi.publish(kind.value, user.profile.id, content.value)
    const message = kind.value === 'bottle' ? '漂流瓶已交给海面。' : '纸飞机已随风出发。'
    content.value = ''
    status.value = message
    emit('published', kind.value, message)
  } catch (error) {
    status.value = error instanceof Error ? error.message : '发送未能完成。'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section class="compose-panel" aria-label="写下并发送一句话">
    <div class="segment-control" role="tablist" aria-label="投递方式">
      <button :class="{ active: kind === 'bottle' }" type="button" @click="kind = 'bottle'">漂流瓶</button>
      <button :class="{ active: kind === 'plane' }" type="button" @click="kind = 'plane'">纸飞机</button>
    </div>
    <label class="sr-only" for="echo-content">想交给世界的一句话</label>
    <textarea id="echo-content" v-model="content" maxlength="500" placeholder="把一句话交给世界..." />
    <div class="compose-footer">
      <span>{{ content.length }}/500</span>
      <button class="send-button" type="button" :disabled="sending || !content.trim()" @click="publish">
        {{ sending ? '正在出发' : kind === 'bottle' ? '投入海面' : '放飞' }}
      </button>
    </div>
    <p v-if="status" class="status-message" role="status">{{ status }}</p>
  </section>
</template>
