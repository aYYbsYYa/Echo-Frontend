<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import { echoApi } from '@/api/echo'
import AppHeader from '@/components/AppHeader.vue'
import type {
  SoulDialogue,
  SoulDialogueMessage,
  SoulDialogueStreamEvent,
  SoulMatch,
  SoulMatchResult,
  SoulProfile,
} from '@/types'

const DEMO_USER_ID = 'yeve'

const profile = ref<SoulProfile | null>(null)
const matchResult = ref<SoulMatchResult | null>(null)
const selectedMatch = ref<SoulMatch | null>(null)
const dialogue = ref<SoulDialogue | null>(null)
const liveConversation = ref<SoulDialogueMessage[]>([])
const liveEcho = ref('')
const streamMeta = ref<Pick<SoulDialogue, 'agent_a' | 'agent_b' | 'score' | 'reason'> | null>(null)
const dialogueSequence = ref<HTMLElement | null>(null)
const history = ref<SoulDialogue[]>([])
const expandedHistory = ref<Set<string>>(new Set())
const pendingDeleteId = ref('')
const deletingId = ref('')
const deleteErrors = ref<Record<string, string>>({})

const loadingProfile = ref(true)
const refreshing = ref(false)
const matching = ref(false)
const colliding = ref(false)
const loadingHistory = ref(true)
const dialoguePhase = ref<'idle' | 'connecting' | 'speaking' | 'summarizing' | 'saving' | 'complete' | 'error'>('idle')
const profileError = ref('')
const matchError = ref('')
const dialogueError = ref('')
const historyError = ref('')
let dialogueRequestId = 0
let dialogueController: AbortController | null = null

const sourceAgent = computed(() => streamMeta.value?.agent_a || profile.value?.name || 'Yeve')
const targetAgent = computed(() => streamMeta.value?.agent_b || selectedMatch.value?.agent || '等待共鸣')
const visibleConversation = computed(() => dialogue.value?.conversation || liveConversation.value)
const visibleEcho = computed(() => dialogue.value?.echo || liveEcho.value)
const connectionState = computed(() => {
  if (colliding.value) return '碰撞中'
  if (dialogue.value) return '回响已形成'
  if (selectedMatch.value) return '已选择'
  if (matchResult.value) return '等待选择'
  return '尚未连接'
})
const dialogueStatus = computed(() => {
  if (dialoguePhase.value === 'connecting') return '正在建立两端 Soul Agent 的连接...'
  if (dialoguePhase.value === 'summarizing') return '三轮交流已完成，正在整理最终回响...'
  if (dialoguePhase.value === 'saving') return '最终回响已形成，正在写入历史记录...'
  const nextAgent = liveConversation.value.length % 2 === 0 ? sourceAgent.value : targetAgent.value
  return `${nextAgent} 正在组织下一条表达...`
})

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || /failed to fetch|networkerror|load failed/i.test(error.message)) {
    return fallback
  }
  return error.message
}

function resetDialogue() {
  dialogue.value = null
  liveConversation.value = []
  liveEcho.value = ''
  streamMeta.value = null
  dialoguePhase.value = 'idle'
}

function mergeHistory(record: SoulDialogue) {
  history.value = [record, ...history.value.filter((item) => item.id !== record.id)]
}

async function scrollDialogueToLatest() {
  await nextTick()
  const element = dialogueSequence.value
  if (!element) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollTo({ top: element.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' })
}

async function loadProfile(refresh = false) {
  if (refresh && (matching.value || colliding.value)) return
  profileError.value = ''
  if (refresh) {
    refreshing.value = true
    matchResult.value = null
    selectedMatch.value = null
    resetDialogue()
  } else {
    loadingProfile.value = true
  }

  try {
    profile.value = await echoApi.getSoulProfile(DEMO_USER_ID, refresh)
  } catch (error) {
    profileError.value = errorMessage(
      error,
      refresh ? '暂时无法重建画像，当前仍显示上一版。' : '暂时无法读取 Soul Agent 画像。',
    )
  } finally {
    loadingProfile.value = false
    refreshing.value = false
  }
}

async function loadHistory() {
  loadingHistory.value = true
  historyError.value = ''
  try {
    const records = await echoApi.getSoulDialogues(DEMO_USER_ID)
    history.value = dialogue.value
      ? [dialogue.value, ...records.filter((item) => item.id !== dialogue.value?.id)]
      : records
  } catch (error) {
    historyError.value = errorMessage(error, '暂时无法读取历史回响。')
  } finally {
    loadingHistory.value = false
  }
}

async function findMatches() {
  matching.value = true
  matchError.value = ''
  dialogueError.value = ''
  selectedMatch.value = null
  resetDialogue()

  try {
    matchResult.value = await echoApi.matchSoulAgents(DEMO_USER_ID, 3)
  } catch (error) {
    matchResult.value = null
    matchError.value = errorMessage(error, '暂时无法寻找共鸣，请稍后再试。')
  } finally {
    matching.value = false
  }
}

function handleDialogueEvent(event: SoulDialogueStreamEvent, requestId: number, match: SoulMatch) {
  if (requestId !== dialogueRequestId) return
  if (event.type === 'start') {
    streamMeta.value = event.data
    dialoguePhase.value = 'speaking'
    return
  }
  if (event.type === 'message') {
    liveConversation.value = [...liveConversation.value, event.data]
    dialoguePhase.value = liveConversation.value.length >= 6 ? 'summarizing' : 'speaking'
    void scrollDialogueToLatest()
    return
  }
  if (event.type === 'echo') {
    liveEcho.value = event.data.echo
    dialoguePhase.value = 'saving'
    return
  }
  if (event.type === 'done' && streamMeta.value) {
    const completed: SoulDialogue = {
      id: event.data.dialogue_id,
      user_id: DEMO_USER_ID,
      target_user_id: match.user_id,
      ...streamMeta.value,
      conversation: [...liveConversation.value],
      echo: liveEcho.value,
      created_at: event.data.created_at,
    }
    dialogue.value = completed
    dialoguePhase.value = 'complete'
    mergeHistory(completed)
    return
  }
  if (event.type === 'error') {
    dialoguePhase.value = 'error'
    dialogueError.value = event.data.message
  }
}

async function startDialogue(match: SoulMatch) {
  dialogueController?.abort()
  const controller = new AbortController()
  dialogueController = controller
  const requestId = ++dialogueRequestId
  selectedMatch.value = match
  resetDialogue()
  dialogueError.value = ''
  colliding.value = true
  dialoguePhase.value = 'connecting'

  try {
    await echoApi.streamSoulDialogue(
      DEMO_USER_ID,
      match.user_id,
      (event) => handleDialogueEvent(event, requestId, match),
      controller.signal,
    )
    if (requestId !== dialogueRequestId) return
    if (!dialogue.value) throw new Error('实时对话没有返回完整的保存结果。')
  } catch (error) {
    if (requestId !== dialogueRequestId || (error instanceof DOMException && error.name === 'AbortError')) return
    controller.abort()
    dialoguePhase.value = 'error'
    dialogueError.value = errorMessage(error, '这次灵魂碰撞没有形成完整回响，请重新尝试。')
  } finally {
    if (requestId === dialogueRequestId) {
      colliding.value = false
      if (dialogueController === controller) dialogueController = null
    }
  }
}

function toggleHistory(id: string) {
  const next = new Set(expandedHistory.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedHistory.value = next
}

function requestHistoryDelete(id: string) {
  pendingDeleteId.value = id
  const nextErrors = { ...deleteErrors.value }
  delete nextErrors[id]
  deleteErrors.value = nextErrors
}

function cancelHistoryDelete() {
  pendingDeleteId.value = ''
}

async function deleteHistoryRecord(record: SoulDialogue) {
  if (deletingId.value) return
  deletingId.value = record.id
  const nextErrors = { ...deleteErrors.value }
  delete nextErrors[record.id]
  deleteErrors.value = nextErrors

  try {
    await echoApi.deleteSoulDialogue(record.id, DEMO_USER_ID)
    history.value = history.value.filter((item) => item.id !== record.id)
    const nextExpanded = new Set(expandedHistory.value)
    nextExpanded.delete(record.id)
    expandedHistory.value = nextExpanded
    pendingDeleteId.value = ''
    if (dialogue.value?.id === record.id) resetDialogue()
  } catch (error) {
    deleteErrors.value = {
      ...deleteErrors.value,
      [record.id]: errorMessage(error, '未能删除这条历史回响，请重新尝试。'),
    }
  } finally {
    deletingId.value = ''
  }
}

function formatDialogueTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

onMounted(() => {
  void loadProfile()
  void loadHistory()
})

onBeforeUnmount(() => dialogueController?.abort())
</script>

<template>
  <main class="soul-shell">
    <AppHeader />

    <section class="soul-intro" aria-labelledby="soul-title">
      <div>
        <p class="eyebrow">Agent-to-Agent Demo</p>
        <h1 id="soul-title">Soul Echo</h1>
      </div>
      <div class="intro-copy">
        <p>让两个由长期表达形成的 Soul Agent 先相遇，再把它们共同听见的部分留给你。</p>
        <a href="#soul-history">查看历史回响</a>
      </div>
    </section>

    <section class="soul-arena" aria-labelledby="arena-title">
      <div class="arena-heading">
        <div>
          <p class="eyebrow">Soul Link</p>
          <h2 id="arena-title">灵魂碰撞场</h2>
        </div>
        <span class="connection-label" aria-live="polite">{{ connectionState }}</span>
      </div>

      <div class="soul-link" :class="{ connected: selectedMatch, colliding, complete: dialogue }">
        <div class="soul-node source-node">
          <span>A</span>
          <strong>{{ sourceAgent }}</strong>
          <small>你的 Demo Agent</small>
        </div>
        <div class="link-line" aria-hidden="true"><i></i></div>
        <div class="soul-node target-node">
          <span>B</span>
          <strong>{{ targetAgent }}</strong>
          <small>{{ selectedMatch ? `共鸣度 ${selectedMatch.score}%` : '从候选中选择' }}</small>
        </div>
      </div>
    </section>

    <section class="soul-workspace">
      <aside class="profile-sheet" aria-labelledby="profile-title" :aria-busy="loadingProfile || refreshing">
        <div class="section-title-row">
          <div>
            <p class="eyebrow">Soul Profile</p>
            <h2 id="profile-title">{{ profile?.name || 'Yeve' }} 的表达画像</h2>
          </div>
          <button
            class="quiet-button"
            type="button"
            :disabled="loadingProfile || refreshing || matching || colliding"
            @click="loadProfile(true)"
          >
            {{ refreshing ? '重建中' : '重建画像' }}
          </button>
        </div>

        <p v-if="loadingProfile" class="soul-state">正在从长期表达中整理画像...</p>
        <div v-else-if="profile" class="profile-content">
          <p v-if="profileError" class="soul-error inline-error" role="alert">{{ profileError }}</p>
          <blockquote>{{ profile.persona.identity }}</blockquote>

          <dl class="profile-facts">
            <div>
              <dt>表达样本</dt>
              <dd>{{ profile.history_count }} 条</dd>
            </div>
            <div>
              <dt>沟通语气</dt>
              <dd>{{ profile.communication_style.tone }}</dd>
            </div>
          </dl>

          <div class="persona-group">
            <h3>性格倾向</h3>
            <div class="trait-list">
              <span v-for="trait in profile.persona.traits" :key="trait">{{ trait }}</span>
            </div>
          </div>
          <div class="persona-group">
            <h3>情绪模式</h3>
            <p>{{ profile.persona.emotion_pattern.join(' · ') }}</p>
          </div>
          <div class="persona-group">
            <h3>持续关注</h3>
            <p>{{ profile.persona.interests.join(' · ') }}</p>
          </div>
          <div class="persona-group">
            <h3>重视的事</h3>
            <p>{{ profile.persona.values.join(' · ') }}</p>
          </div>
        </div>

        <div v-else class="soul-error" role="alert">
          <p>{{ profileError }}</p>
          <button class="quiet-button" type="button" @click="loadProfile()">重新读取</button>
        </div>
      </aside>

      <div class="collision-flow">
        <section class="match-section" aria-labelledby="match-title">
          <div class="section-title-row">
            <div>
              <p class="eyebrow">Agent Pool</p>
              <h2 id="match-title">寻找可解释的共鸣</h2>
            </div>
            <button
              class="primary-button soul-action"
              type="button"
              :disabled="!profile || refreshing || matching || colliding"
              @click="findMatches"
            >
              {{ matching ? '正在寻找' : matchResult ? '重新寻找' : '寻找共鸣' }}
            </button>
          </div>

          <p v-if="!matchResult && !matching && !matchError" class="soul-state">
            匹配只比较 Demo Agent 的兴趣、情绪与价值观信号，不读取真实用户资料。
          </p>
          <p v-if="matching" class="soul-state" aria-live="polite">正在让 Yeve 的信号靠近 Agent Pool...</p>
          <div v-if="matchError" class="soul-error" role="alert">{{ matchError }}</div>

          <div v-if="matchResult" class="match-list">
            <button
              v-for="match in matchResult.matches"
              :key="match.user_id"
              class="match-item"
              :class="{ selected: selectedMatch?.user_id === match.user_id }"
              type="button"
              @click="startDialogue(match)"
            >
              <span class="match-score">{{ match.score }}<small>%</small></span>
              <span class="match-copy">
                <span class="match-name">{{ match.agent }}</span>
                <span class="match-preview">{{ match.preview }}</span>
                <span class="match-reason">{{ match.reason.join('；') }}</span>
              </span>
              <span class="match-command">碰撞</span>
            </button>
          </div>
        </section>

        <section class="dialogue-section" aria-labelledby="dialogue-title" :aria-busy="colliding">
          <div class="section-title-row">
            <div>
              <p class="eyebrow">Soul Collision</p>
              <h2 id="dialogue-title">Agent 对话</h2>
            </div>
          </div>

          <p v-if="!selectedMatch" class="soul-state">选择一个共鸣 Agent 后，它们会轮流进行三轮公开碰撞。</p>
          <p v-else-if="colliding" class="soul-state collision-status" aria-live="polite">
            {{ dialogueStatus }}
          </p>
          <div
            v-if="visibleConversation.length"
            ref="dialogueSequence"
            class="dialogue-sequence"
            :class="{ 'is-live': colliding }"
            aria-live="polite"
          >
            <article v-for="(message, index) in visibleConversation" :key="`${message.user_id}-${index}`">
              <span>{{ index + 1 }}</span>
              <div>
                <h3>
                  {{ message.from }}
                  <small v-if="message.round">第 {{ message.round }} 轮</small>
                </h3>
                <p>{{ message.text }}</p>
              </div>
            </article>
          </div>
          <div v-if="dialogueError" class="soul-error" role="alert">
            <p>{{ dialogueError }}</p>
            <button v-if="selectedMatch" class="quiet-button" type="button" @click="startDialogue(selectedMatch)">
              再碰撞一次
            </button>
          </div>
        </section>
      </div>
    </section>

    <section v-if="visibleEcho" class="echo-result" aria-labelledby="echo-title">
      <div class="echo-paper">
        <p class="eyebrow">Final Echo</p>
        <h2 id="echo-title">它们共同听见了</h2>
        <blockquote>{{ visibleEcho }}</blockquote>
        <footer>
          <span>{{ sourceAgent }} × {{ targetAgent }}</span>
          <strong class="auto-save-status">
            {{ dialogue ? '已自动保存到历史回响' : '正在保存历史回响' }}
          </strong>
        </footer>
      </div>
    </section>

    <section id="soul-history" class="history-section" aria-labelledby="history-title" :aria-busy="loadingHistory">
      <div class="history-heading">
        <div>
          <p class="eyebrow">Echo Archive</p>
          <h2 id="history-title">历史回响</h2>
        </div>
        <button class="quiet-button" type="button" :disabled="loadingHistory" @click="loadHistory">
          {{ loadingHistory ? '读取中' : '重新读取' }}
        </button>
      </div>

      <p v-if="loadingHistory && !history.length" class="soul-state">正在从服务端读取已经完成的回响...</p>
      <div v-else-if="historyError && !history.length" class="soul-error" role="alert">
        <p>{{ historyError }}</p>
        <button class="quiet-button" type="button" @click="loadHistory">重新读取</button>
      </div>
      <p v-else-if="!history.length" class="history-empty">完成第一次三轮碰撞后，完整对话会自动出现在这里。</p>

      <div v-else class="history-list">
        <article v-for="record in history" :key="record.id" class="history-record">
          <div class="history-record-row">
            <button
              class="history-summary"
              type="button"
              :aria-expanded="expandedHistory.has(record.id)"
              :aria-controls="`history-${record.id}`"
              @click="toggleHistory(record.id)"
            >
              <span class="history-agents">{{ record.agent_a }} × {{ record.agent_b }}</span>
              <time :datetime="record.created_at">{{ formatDialogueTime(record.created_at) }}</time>
              <span class="history-echo">{{ record.echo }}</span>
              <span class="history-score">共鸣度 {{ record.score }}%</span>
              <span class="history-toggle">
                {{ expandedHistory.has(record.id) ? '收起对话' : '查看对话' }}
                <i aria-hidden="true">⌄</i>
              </span>
            </button>
            <button
              class="history-delete"
              type="button"
              :aria-label="`删除 ${record.agent_a} 与 ${record.agent_b} 的历史回响`"
              title="永久删除"
              :disabled="deletingId === record.id || loadingHistory"
              @click="requestHistoryDelete(record.id)"
            >
              ×
            </button>
          </div>

          <div v-if="pendingDeleteId === record.id" class="delete-confirm" role="alert">
            <p>将永久删除完整对话和最终回响，此操作无法恢复。</p>
            <div>
              <button class="quiet-button" type="button" :disabled="deletingId === record.id" @click="cancelHistoryDelete">
                取消
              </button>
              <button
                class="delete-confirm-button"
                type="button"
                :disabled="deletingId === record.id"
                @click="deleteHistoryRecord(record)"
              >
                {{ deletingId === record.id ? '删除中' : '确认删除' }}
              </button>
            </div>
          </div>
          <p v-if="deleteErrors[record.id]" class="delete-error" role="alert">{{ deleteErrors[record.id] }}</p>

          <div v-if="expandedHistory.has(record.id)" :id="`history-${record.id}`" class="history-detail">
            <div class="history-dialogue">
              <article v-for="(message, index) in record.conversation" :key="`${record.id}-${index}`">
                <span>{{ index + 1 }}</span>
                <div>
                  <h3>
                    {{ message.from }}
                    <small v-if="message.round">第 {{ message.round }} 轮</small>
                  </h3>
                  <p>{{ message.text }}</p>
                </div>
              </article>
            </div>
            <blockquote>{{ record.echo }}</blockquote>
          </div>
        </article>
      </div>
      <p v-if="historyError && history.length" class="soul-error history-inline-error" role="alert">
        {{ historyError }} 当前仍显示上一次读取的记录。
      </p>
    </section>
  </main>
</template>

<style scoped>
.soul-shell {
  min-height: 100vh;
  padding-bottom: 96px;
  background:
    linear-gradient(rgba(117, 177, 167, .08) 1px, transparent 1px),
    #081b28;
  background-size: 100% 72px;
}

.soul-intro,
.soul-arena,
.soul-workspace,
.echo-result,
.history-section {
  width: min(1040px, calc(100% - 48px));
  margin-inline: auto;
}

.soul-intro {
  display: grid;
  grid-template-columns: 1fr minmax(280px, 420px);
  align-items: end;
  gap: 48px;
  padding: 72px 0 48px;
  border-bottom: 1px solid #33525a;
}

.soul-intro h1 {
  margin: 0;
  color: #fff4db;
  font-family: Georgia, "Songti SC", serif;
  font-size: clamp(48px, 8vw, 92px);
  font-weight: 400;
  line-height: .95;
}

.intro-copy {
  display: grid;
  justify-items: start;
  gap: 18px;
}

.intro-copy p {
  margin: 0;
  color: #aec6c0;
  line-height: 1.8;
}

.intro-copy a {
  color: #e2ca82;
  font-size: 13px;
  text-underline-offset: 5px;
}

.soul-arena {
  padding: 42px 0 54px;
  border-bottom: 1px solid #33525a;
}

.arena-heading,
.section-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.arena-heading h2,
.section-title-row h2,
.echo-paper h2,
.history-heading h2 {
  margin: 0;
  color: #f5ead2;
  font-family: Georgia, "Songti SC", serif;
  font-size: 24px;
  font-weight: 400;
}

.connection-label {
  padding-top: 2px;
  color: #91bcb3;
  font-size: 12px;
}

.soul-link {
  display: grid;
  grid-template-columns: 180px minmax(120px, 1fr) 180px;
  align-items: center;
  max-width: 760px;
  margin: 48px auto 0;
}

.soul-node {
  width: 180px;
  aspect-ratio: 1;
  display: grid;
  grid-template-rows: 1fr auto auto 1fr;
  place-items: center;
  border: 1px solid #527b79;
  border-radius: 50%;
  color: #dceae4;
  background: #0e3340;
  box-shadow: inset 0 0 0 10px rgba(111, 176, 164, .04);
  transition: border-color .35s ease, box-shadow .35s ease, transform .35s ease;
}

.soul-node > span {
  align-self: end;
  margin-bottom: 14px;
  color: #d9c47f;
  font-family: Georgia, serif;
  font-size: 13px;
}

.soul-node strong {
  max-width: 130px;
  overflow: hidden;
  color: #fff4d8;
  font-family: Georgia, "Songti SC", serif;
  font-size: 25px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.soul-node small {
  max-width: 130px;
  margin-top: 8px;
  overflow: hidden;
  color: #91ada8;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.target-node {
  border-style: dashed;
  background: #122e37;
}

.link-line {
  height: 1px;
  position: relative;
  overflow: hidden;
  background: #34575c;
}

.link-line i {
  position: absolute;
  inset: 0 auto 0 -34%;
  width: 34%;
  background: #e2ca82;
  opacity: 0;
}

.soul-link.connected .soul-node {
  border-color: #8abdb0;
  border-style: solid;
}

.soul-link.connected .link-line {
  background: #668f88;
}

.soul-link.colliding .soul-node {
  box-shadow: inset 0 0 0 10px rgba(111, 176, 164, .08), 0 0 36px rgba(111, 176, 164, .14);
  transform: scale(1.025);
}

.soul-link.colliding .link-line i {
  opacity: 1;
  animation: signal 1.2s linear infinite;
}

.soul-link.complete .link-line {
  height: 2px;
  background: #e2ca82;
  box-shadow: 0 0 18px rgba(226, 202, 130, .34);
}

.soul-workspace {
  display: grid;
  grid-template-columns: minmax(300px, .85fr) minmax(0, 1.35fr);
  gap: 64px;
  padding: 64px 0;
}

.profile-sheet {
  align-self: start;
  padding: 28px;
  border-top: 4px solid #d9c47f;
  color: #273f43;
  background: #e8ede4;
  box-shadow: 12px 14px 0 rgba(0, 0, 0, .12);
}

.profile-sheet .eyebrow,
.echo-paper .eyebrow {
  color: #816d3d;
}

.profile-sheet .section-title-row h2 {
  color: #273f43;
  font-size: 21px;
}

.quiet-button {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid #62827b;
  border-radius: 3px;
  color: inherit;
  background: transparent;
}

.quiet-button:hover:not(:disabled) {
  border-color: #b69950;
  color: #775f29;
}

.profile-content blockquote {
  margin: 32px 0;
  padding-left: 18px;
  border-left: 3px solid #c7aa62;
  font-family: Georgia, "Songti SC", serif;
  font-size: 20px;
  line-height: 1.65;
}

.profile-facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 0 0 28px;
  border-block: 1px solid #bdc9be;
}

.profile-facts div {
  padding: 14px 0;
}

.profile-facts div + div {
  padding-left: 18px;
  border-left: 1px solid #bdc9be;
}

.profile-facts dt,
.persona-group h3 {
  color: #6d8179;
  font-size: 11px;
  font-weight: 600;
}

.profile-facts dd {
  margin: 5px 0 0;
  font-size: 14px;
}

.persona-group + .persona-group {
  margin-top: 22px;
}

.persona-group h3 {
  margin: 0 0 9px;
}

.persona-group p {
  margin: 0;
  color: #45625d;
  font-size: 14px;
  line-height: 1.65;
}

.trait-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.trait-list span {
  padding: 5px 8px;
  border: 1px solid #9cafa5;
  border-radius: 2px;
  color: #385750;
  font-size: 12px;
}

.collision-flow {
  display: grid;
  gap: 54px;
}

.soul-action {
  min-height: 38px;
  padding: 0 14px;
}

.soul-state,
.soul-error {
  margin: 28px 0 0;
  color: #9eb7b1;
  font-size: 13px;
  line-height: 1.7;
}

.profile-sheet .soul-state,
.profile-sheet .soul-error {
  color: #566f69;
}

.soul-error {
  color: #efaaa0;
}

.soul-error p {
  margin: 0 0 12px;
}

.inline-error {
  margin-top: 22px;
}

.match-list {
  display: grid;
  gap: 10px;
  margin-top: 25px;
}

.match-item {
  width: 100%;
  min-height: 112px;
  display: grid;
  grid-template-columns: 72px 1fr auto;
  align-items: center;
  gap: 18px;
  padding: 18px;
  border: 1px solid #34565e;
  border-radius: 5px;
  color: inherit;
  background: #0d2835;
  text-align: left;
  transition: border-color .2s ease, background .2s ease, transform .2s ease;
}

.match-item:hover:not(:disabled),
.match-item.selected {
  border-color: #bda864;
  background: #12323c;
  transform: translateX(4px);
}

.match-score {
  color: #ead28c;
  font-family: Georgia, serif;
  font-size: 34px;
}

.match-score small {
  font-size: 13px;
}

.match-copy {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.match-name {
  color: #eff5ea;
  font-family: Georgia, "Songti SC", serif;
  font-size: 20px;
}

.match-preview,
.match-reason {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-preview {
  color: #bfd1cb;
  font-size: 13px;
}

.match-reason {
  color: #799d97;
  font-size: 11px;
}

.match-command {
  color: #d9c47f;
  font-size: 12px;
}

.dialogue-section {
  min-height: 220px;
  padding-top: 30px;
  border-top: 1px solid #345159;
}

.collision-status::after {
  content: "";
  display: inline-block;
  width: 22px;
  height: 1px;
  margin-left: 10px;
  vertical-align: middle;
  background: #e2ca82;
  animation: breathe 1s ease-in-out infinite alternate;
}

.dialogue-sequence {
  display: grid;
  margin-top: 28px;
}

.dialogue-sequence.is-live {
  max-height: 470px;
  padding-right: 10px;
  overflow-y: auto;
  scrollbar-color: #52766f transparent;
}

.dialogue-sequence article {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 16px;
  padding: 0 0 26px;
  position: relative;
}

.dialogue-sequence article:not(:last-child)::before {
  content: "";
  width: 1px;
  position: absolute;
  top: 28px;
  bottom: 0;
  left: 15px;
  background: #42646a;
}

.dialogue-sequence article > span {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  z-index: 1;
  border: 1px solid #75958e;
  border-radius: 50%;
  color: #e1cc88;
  background: #081b28;
  font-family: Georgia, serif;
  font-size: 12px;
}

.dialogue-sequence h3 {
  margin: 2px 0 9px;
  color: #ebd48e;
  font-family: Georgia, "Songti SC", serif;
  font-size: 17px;
  font-weight: 400;
}

.dialogue-sequence h3 small,
.history-dialogue h3 small {
  margin-left: 8px;
  color: #7f9e97;
  font-family: inherit;
  font-size: 10px;
  font-weight: 400;
}

.dialogue-sequence p {
  margin: 0;
  color: #ceddd8;
  line-height: 1.75;
}

.echo-result {
  padding-top: 10px;
}

.echo-paper {
  width: min(760px, 100%);
  margin: auto;
  padding: clamp(34px, 7vw, 68px);
  border-top: 5px solid #d7bb70;
  color: #263e42;
  background: #edf0e6;
  box-shadow: 16px 18px 0 rgba(0, 0, 0, .14);
}

.echo-paper h2 {
  color: #263e42;
  font-size: 25px;
}

.echo-paper blockquote {
  margin: 48px 0 54px;
  font-family: Georgia, "Songti SC", serif;
  font-size: clamp(25px, 4vw, 38px);
  line-height: 1.65;
  white-space: pre-line;
}

.echo-paper footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-top: 20px;
  border-top: 1px solid #c1cdc2;
  color: #617a73;
  font-size: 12px;
}

.auto-save-status {
  color: #52766e;
  font-size: 12px;
  font-weight: 600;
}

.history-section {
  padding-top: 84px;
  scroll-margin-top: 24px;
}

.history-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 22px;
  border-bottom: 1px solid #456068;
}

.history-heading .eyebrow {
  margin-bottom: 7px;
}

.history-empty {
  margin: 30px 0 0;
  padding: 28px 0;
  border-bottom: 1px solid #29464f;
  color: #8fa9a3;
  line-height: 1.7;
}

.history-list {
  display: grid;
}

.history-record {
  border-bottom: 1px solid #34525a;
}

.history-record-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 38px;
  align-items: center;
  gap: 8px;
}

.history-summary {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(150px, .75fr) minmax(0, 2fr) auto;
  gap: 9px 24px;
  align-items: center;
  padding: 24px 4px;
  border: 0;
  border-radius: 0;
  color: inherit;
  background: transparent;
  text-align: left;
}

.history-summary:hover {
  background: rgba(102, 143, 136, .07);
}

.history-delete {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid #526d70;
  border-radius: 50%;
  color: #a8bbb7;
  background: transparent;
  font-family: Arial, sans-serif;
  font-size: 21px;
  line-height: 1;
}

.history-delete:hover:not(:disabled) {
  border-color: #c98278;
  color: #f0aaa0;
  background: rgba(174, 83, 75, .08);
}

.history-agents {
  color: #f0dc9d;
  font-family: Georgia, "Songti SC", serif;
  font-size: 18px;
}

.history-summary time {
  grid-column: 1;
  color: #76958e;
  font-size: 11px;
}

.history-echo {
  grid-column: 2;
  grid-row: 1 / span 2;
  display: -webkit-box;
  overflow: hidden;
  color: #c9d9d4;
  line-height: 1.65;
  white-space: pre-line;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.history-score {
  grid-column: 3;
  grid-row: 1;
  color: #8fb0a8;
  font-size: 11px;
}

.history-toggle {
  grid-column: 3;
  grid-row: 2;
  color: #d8c27f;
  font-size: 12px;
  white-space: nowrap;
}

.history-toggle i {
  display: inline-block;
  margin-left: 5px;
  font-style: normal;
  transition: transform .2s ease;
}

.history-summary[aria-expanded="true"] .history-toggle i {
  transform: rotate(180deg);
}

.delete-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin: 0 46px 22px 4px;
  padding: 16px 18px;
  border-left: 3px solid #bd776d;
  color: #d8c8c3;
  background: rgba(128, 57, 52, .16);
}

.delete-confirm p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.delete-confirm > div {
  display: flex;
  flex: none;
  gap: 8px;
}

.delete-confirm-button {
  min-height: 34px;
  padding: 0 11px;
  border: 1px solid #c98278;
  border-radius: 3px;
  color: #ffe7e1;
  background: #7f3f3b;
}

.delete-confirm-button:hover:not(:disabled) {
  background: #92504a;
}

.delete-error {
  margin: 0 46px 20px 4px;
  color: #efaaa0;
  font-size: 12px;
}

.history-detail {
  padding: 4px 0 34px min(11vw, 112px);
}

.history-dialogue {
  display: grid;
}

.history-dialogue article {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 14px;
  padding: 0 0 22px;
}

.history-dialogue article > span {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid #55766f;
  border-radius: 50%;
  color: #d9c47f;
  font-family: Georgia, serif;
  font-size: 11px;
}

.history-dialogue h3 {
  margin: 1px 0 7px;
  color: #dfca89;
  font-family: Georgia, "Songti SC", serif;
  font-size: 15px;
  font-weight: 400;
}

.history-dialogue p {
  margin: 0;
  color: #b8ccc6;
  font-size: 14px;
  line-height: 1.75;
}

.history-detail > blockquote {
  margin: 6px 0 0 42px;
  padding: 20px 22px;
  border-left: 3px solid #c4aa65;
  color: #2c4749;
  background: #e7ebe2;
  font-family: Georgia, "Songti SC", serif;
  line-height: 1.75;
  white-space: pre-line;
}

.history-inline-error {
  margin-top: 20px;
}

button:focus-visible {
  outline: 2px solid #f2d985;
  outline-offset: 3px;
}

@keyframes signal {
  to { left: 100%; }
}

@keyframes breathe {
  to { width: 42px; opacity: .45; }
}

@media (max-width: 820px) {
  .soul-intro,
  .soul-workspace {
    grid-template-columns: 1fr;
  }

  .soul-intro {
    gap: 28px;
  }

  .soul-workspace {
    gap: 54px;
  }
}

@media (max-width: 600px) {
  .soul-intro,
  .soul-arena,
  .soul-workspace,
  .echo-result,
  .history-section {
    width: calc(100% - 32px);
  }

  .soul-intro {
    padding-top: 50px;
  }

  .soul-link {
    grid-template-columns: 118px minmax(34px, 1fr) 118px;
    margin-top: 38px;
  }

  .soul-node {
    width: 118px;
  }

  .soul-node strong {
    max-width: 88px;
    font-size: 19px;
  }

  .soul-node small {
    max-width: 88px;
    font-size: 9px;
  }

  .profile-sheet {
    padding: 22px;
  }

  .section-title-row {
    align-items: flex-start;
  }

  .section-title-row h2 {
    font-size: 21px;
  }

  .match-item {
    grid-template-columns: 52px 1fr;
    gap: 14px;
    padding: 15px;
  }

  .match-score {
    font-size: 27px;
  }

  .match-command {
    display: none;
  }

  .match-preview,
  .match-reason {
    white-space: normal;
  }

  .echo-paper footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .history-summary {
    grid-template-columns: 1fr auto;
    gap: 8px 14px;
    padding: 21px 2px;
  }

  .history-agents,
  .history-summary time,
  .history-echo {
    grid-column: 1 / -1;
  }

  .history-agents {
    grid-row: auto;
  }

  .history-summary time {
    grid-row: auto;
  }

  .history-echo {
    grid-row: auto;
  }

  .history-score,
  .history-toggle {
    grid-row: auto;
  }

  .history-score {
    grid-column: 1;
  }

  .history-toggle {
    grid-column: 2;
  }

  .history-detail {
    padding-left: 0;
  }

  .history-record-row {
    grid-template-columns: minmax(0, 1fr) 34px;
    gap: 4px;
  }

  .delete-confirm {
    align-items: stretch;
    flex-direction: column;
    margin-right: 38px;
  }

  .delete-confirm > div {
    justify-content: flex-end;
  }

  .delete-error {
    margin-right: 38px;
  }

  .history-detail > blockquote {
    margin-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .link-line i,
  .collision-status::after {
    animation: none;
  }

  .history-toggle i {
    transition: none;
  }
}
</style>
