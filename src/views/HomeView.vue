<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { echoApi } from '@/api/echo'
import AppHeader from '@/components/AppHeader.vue'
import ComposePanel from '@/components/ComposePanel.vue'
import DiscoveryCard from '@/components/DiscoveryCard.vue'
import RingSoundPanel from '@/components/RingSoundPanel.vue'
import { useUserStore } from '@/stores/user'
import type { EchoItem, EchoKind } from '@/types'

const user = useUserStore()
const router = useRouter()
const item = ref<EchoItem | null>(null)
const loading = ref(false)
const selectedKind = ref<'bottle' | 'plane'>('bottle')
const notice = ref('把一句话放进海里，或者等一句话向你靠岸。')
const emptyMessage = ref('还没有捞到其他人的漂流物。')
const voiceDraft = ref('')
const ringSendToken = ref(0)

function selectKind(kind: 'bottle' | 'plane') {
  selectedKind.value = kind
  item.value = null
  emptyMessage.value = kind === 'bottle' ? '还没有捞到其他人的漂流物。' : '还没有接到其他人的纸飞机。'
}

async function discover() {
  if (!user.profile) return
  loading.value = true
  item.value = null
  try {
    const result = selectedKind.value === 'bottle'
      ? await echoApi.discoverBottle(user.profile.id)
      : await echoApi.discoverPlane(user.profile.id)
    item.value = result.data
    emptyMessage.value = result.message || (
      selectedKind.value === 'bottle' ? '海面暂时安静，稍后再来。' : '风里还没有新的纸飞机。'
    )
    notice.value = item.value ? '' : emptyMessage.value
  } catch (error) {
    notice.value = error instanceof Error ? error.message : '暂时无法抵达海面。'
    emptyMessage.value = notice.value
  } finally {
    loading.value = false
  }
}

function onPublished(_kind: 'bottle' | 'plane', message: string) {
  if (_kind === 'plane') voiceDraft.value = ''
  notice.value = message
}

function onRingTranscribed(text: string) {
  voiceDraft.value = text
  notice.value = '戒指语音已转成文字，请检查后发送。'
}

function onRingConfirm() {
  if (!voiceDraft.value.trim()) {
    notice.value = '还没有可发送的戒指语音文字。'
    return
  }
  ringSendToken.value += 1
}

function openDiscovered(id: string, kind: EchoKind) {
  router.push({ name: kind === 'bottle' ? 'bottle-detail' : 'plane-detail', params: { id } })
}
</script>

<template>
  <main class="sea-shell">
    <AppHeader />
    <section class="sea-stage">
      <div class="horizon" aria-hidden="true"></div>
      <div class="floating-bottle" aria-hidden="true"><i></i></div>
      <div class="hero-copy">
        <p class="eyebrow">不必被认识 · 只需被听见</p>
        <h1>让文字自己<br /><em>去遇见世界。</em></h1>
        <p>把片刻投向陌生的海。没有关系链，没有催促，只有一次恰好的停留。</p>
        <div class="hero-status" role="status" aria-live="polite"><span aria-hidden="true"></span>{{ notice }}</div>
      </div>
      <div class="compose-stack">
        <p class="section-index"><span>01</span> 写下此刻</p>
        <ComposePanel :voice-draft="voiceDraft" :auto-send-token="ringSendToken" @published="onPublished" />
      </div>
      <RingSoundPanel @transcribed="onRingTranscribed" @confirm="onRingConfirm" />
    </section>

    <section class="discovery-zone" aria-labelledby="discover-heading">
      <div class="discover-heading">
        <p class="section-index"><span>02</span> 等待相遇</p>
        <div><h2 id="discover-heading">从远处来的回声</h2><p>每次只遇见一段，读完再决定是否停留。</p></div>
      </div>
      <div class="discover-controls">
        <div class="segment-control" role="tablist" aria-label="接收类型">
          <button :class="{ active: selectedKind === 'bottle' }" type="button" @click="selectKind('bottle')">捞漂流瓶</button>
          <button :class="{ active: selectedKind === 'plane' }" type="button" @click="selectKind('plane')">接纸飞机</button>
        </div>
        <button class="discover-button" type="button" :disabled="loading" @click="discover">
          {{ loading ? '正在靠岸' : selectedKind === 'bottle' ? '捞起一个' : '等一阵风' }}
        </button>
      </div>
      <Transition :name="selectedKind === 'bottle' ? 'surface-rise' : 'surface-flight'" mode="out-in">
        <DiscoveryCard
          :key="`${selectedKind}-${loading ? 'loading' : item?.id || 'empty'}`"
          :item="item"
          :loading="loading"
          :empty-message="emptyMessage"
          @open="openDiscovered"
        />
      </Transition>
    </section>
  </main>
</template>
