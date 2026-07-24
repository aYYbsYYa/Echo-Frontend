<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

import { echoApi } from '@/api/echo'
import { useUserStore } from '@/stores/user'
import type { EchoKind } from '@/types'

const props = defineProps<{ voiceDraft?: string; autoSendToken?: number }>()
const emit = defineEmits<{ published: [kind: EchoKind, message: string] }>()
const user = useUserStore()
const kind = ref<EchoKind>('bottle')
const content = ref('')
const status = ref('')
const sending = ref(false)
const image = ref<File | null>(null)
const imagePreview = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

function clearImage() {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  image.value = null
  imagePreview.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

function selectImage(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0]
  if (!selected) return
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(selected.type)) {
    status.value = '请选择 JPEG、PNG、WebP 或 GIF 图片。'
    input.value = ''
    return
  }
  if (selected.size > 5 * 1024 * 1024) {
    status.value = '图片大小不能超过 5MB。'
    input.value = ''
    return
  }
  clearImage()
  image.value = selected
  imagePreview.value = URL.createObjectURL(selected)
  status.value = ''
}

onBeforeUnmount(clearImage)

watch(() => props.voiceDraft, (draft) => {
  if (typeof draft === 'string' && draft.trim()) content.value = draft
})

watch(() => props.autoSendToken, (token, previous) => {
  if (token !== undefined && token !== previous) {
    kind.value = 'plane'
    void publish()
  }
})

async function publish() {
  if (sending.value || !content.value.trim() || !user.profile) return
  sending.value = true
  status.value = ''
  try {
    await echoApi.publish(kind.value, user.profile.id, content.value, image.value)
    const message = kind.value === 'bottle' ? '漂流瓶已交给海面。' : '纸飞机已随风出发。'
    content.value = ''
    clearImage()
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
    <div class="compose-heading">
      <div class="segment-control" role="tablist" aria-label="投递方式">
        <button :class="{ active: kind === 'bottle' }" :aria-selected="kind === 'bottle'" role="tab" type="button" @click="kind = 'bottle'">漂流瓶</button>
        <button :class="{ active: kind === 'plane' }" :aria-selected="kind === 'plane'" role="tab" type="button" @click="kind = 'plane'">纸飞机</button>
      </div>
      <span>{{ kind === 'bottle' ? '缓慢漂流' : '轻快抵达' }}</span>
    </div>
    <label class="sr-only" for="echo-content">想交给世界的一句话</label>
    <textarea id="echo-content" v-model="content" maxlength="500" placeholder="把一句话交给世界..." />
    <div v-if="imagePreview" class="compose-image-preview">
      <img :src="imagePreview" alt="待发送图片预览" />
      <div><span>{{ image?.name }}</span><button type="button" aria-label="移除图片" @click="clearImage">×</button></div>
    </div>
    <div class="compose-tools">
      <label class="image-picker" :class="{ disabled: sending }">
        <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" :disabled="sending" @change="selectImage" />
        <span aria-hidden="true">▧</span>{{ image ? '更换图片' : '附上一张图片' }}
      </label>
      <small>JPEG / PNG / WebP / GIF · 5MB 内</small>
    </div>
    <div class="compose-footer">
      <span>{{ content.length }}/500</span>
      <button class="send-button" type="button" :disabled="sending || !content.trim()" @click="publish">
        {{ sending ? '正在出发' : kind === 'bottle' ? '投入海面' : '放飞' }}
      </button>
    </div>
    <p v-if="status" class="status-message" role="status">{{ status }}</p>
  </section>
</template>
