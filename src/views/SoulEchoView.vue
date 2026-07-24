<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { echoApi } from '@/api/echo'
import AppHeader from '@/components/AppHeader.vue'
import type { SoulDialogue, SoulMatch, SoulMatchResult, SoulProfile } from '@/types'

const DEMO_USER_ID = 'yeve'
const SAVED_ECHO_KEY = 'echo.soul.saved'

const profile = ref<SoulProfile | null>(null)
const matchResult = ref<SoulMatchResult | null>(null)
const selectedMatch = ref<SoulMatch | null>(null)
const dialogue = ref<SoulDialogue | null>(null)

const loadingProfile = ref(true)
const refreshing = ref(false)
const matching = ref(false)
const colliding = ref(false)
const saved = ref(false)
const profileError = ref('')
const matchError = ref('')
const dialogueError = ref('')
const saveError = ref('')
let dialogueRequestId = 0

const sourceAgent = computed(() => profile.value?.name || 'Yeve')
const targetAgent = computed(() => selectedMatch.value?.agent || '等待共鸣')
const connectionState = computed(() => {
  if (colliding.value) return '碰撞中'
  if (dialogue.value) return '回响已形成'
  if (selectedMatch.value) return '已选择'
  if (matchResult.value) return '等待选择'
  return '尚未连接'
})

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || /failed to fetch|networkerror|load failed/i.test(error.message)) {
    return fallback
  }
  return error.message
}

async function loadProfile(refresh = false) {
  if (refresh && (matching.value || colliding.value)) return
  profileError.value = ''
  if (refresh) {
    refreshing.value = true
    matchResult.value = null
    selectedMatch.value = null
    dialogue.value = null
    saved.value = false
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

async function findMatches() {
  matching.value = true
  matchError.value = ''
  dialogueError.value = ''
  selectedMatch.value = null
  dialogue.value = null
  saved.value = false
  saveError.value = ''

  try {
    matchResult.value = await echoApi.matchSoulAgents(DEMO_USER_ID, 3)
  } catch (error) {
    matchResult.value = null
    matchError.value = errorMessage(error, '暂时无法寻找共鸣，请稍后再试。')
  } finally {
    matching.value = false
  }
}

async function startDialogue(match: SoulMatch) {
  const requestId = ++dialogueRequestId
  selectedMatch.value = match
  dialogue.value = null
  dialogueError.value = ''
  saved.value = false
  saveError.value = ''
  colliding.value = true

  try {
    const result = await echoApi.runSoulDialogue(DEMO_USER_ID, match.user_id)
    if (requestId !== dialogueRequestId) return
    dialogue.value = result
  } catch (error) {
    if (requestId !== dialogueRequestId) return
    dialogueError.value = errorMessage(error, '这次灵魂碰撞没有形成回响，请重新尝试。')
  } finally {
    if (requestId === dialogueRequestId) colliding.value = false
  }
}

function saveEcho() {
  if (!dialogue.value) return

  saveError.value = ''
  try {
    localStorage.setItem(SAVED_ECHO_KEY, JSON.stringify({
      echo: dialogue.value.echo,
      agent_a: dialogue.value.agent_a,
      agent_b: dialogue.value.agent_b,
      saved_at: new Date().toISOString(),
    }))
    saved.value = true
  } catch {
    saveError.value = '浏览器未能保存这次回响，请检查本地存储权限后重试。'
  }
}

onMounted(() => loadProfile())
</script>

<template>
  <main class="soul-shell">
    <AppHeader />

    <section class="soul-intro" aria-labelledby="soul-title">
      <div>
        <p class="eyebrow">Agent-to-Agent Demo</p>
        <h1 id="soul-title">Soul Echo</h1>
      </div>
      <p>让两个由长期表达形成的 Soul Agent 先相遇，再把它们共同听见的部分留给你。</p>
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
              :disabled="colliding"
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

          <p v-if="!selectedMatch" class="soul-state">选择一个共鸣 Agent 后，它们会按顺序进行一次公开碰撞。</p>
          <p v-else-if="colliding" class="soul-state collision-status" aria-live="polite">
            {{ sourceAgent }} 正在表达，{{ targetAgent }} 正在回应...
          </p>
          <div v-else-if="dialogue" class="dialogue-sequence">
            <article v-for="(message, index) in dialogue.conversation" :key="`${message.user_id}-${index}`">
              <span>{{ index + 1 }}</span>
              <div>
                <h3>{{ message.from }}</h3>
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

    <section v-if="dialogue" class="echo-result" aria-labelledby="echo-title">
      <div class="echo-paper">
        <p class="eyebrow">Final Echo</p>
        <h2 id="echo-title">它们共同听见了</h2>
        <blockquote>{{ dialogue.echo }}</blockquote>
        <footer>
          <span>{{ dialogue.agent_a }} × {{ dialogue.agent_b }}</span>
          <button class="primary-button soul-action" type="button" :disabled="saved" @click="saveEcho">
            {{ saved ? '已保存' : '保存回响' }}
          </button>
        </footer>
        <p v-if="saveError" class="soul-error save-error" role="alert">{{ saveError }}</p>
      </div>
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
.echo-result {
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

.soul-intro > p {
  margin: 0;
  color: #aec6c0;
  line-height: 1.8;
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
.echo-paper h2 {
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

.save-error {
  margin-bottom: 0;
  color: #9a4e49;
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
  .echo-result {
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
}

@media (prefers-reduced-motion: reduce) {
  .link-line i,
  .collision-status::after {
    animation: none;
  }
}
</style>
