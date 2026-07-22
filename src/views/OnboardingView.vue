<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useUserStore } from '@/stores/user'

const user = useUserStore()
const router = useRouter()
const form = reactive({ nickname: '', birthday: '', gender: '', region: '' })
const error = ref('')
const saving = ref(false)

async function submit() {
  if (!form.nickname.trim() || !form.birthday || !form.gender) {
    error.value = '请完整留下昵称、生日与性别。'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await user.initialize({ ...form, region: form.region.trim() || '未标注' })
    await router.replace('/')
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '身份初始化未完成。'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="onboarding-shell">
    <div class="onboarding-orbit" aria-hidden="true"></div>
    <section class="onboarding-panel">
      <p class="eyebrow">Yeve Echo</p>
      <h1>让一句话，<br />遇见愿意停下的人。</h1>
      <p class="intro">这里没有关注、好友或聊天记录。只留下一枚匿名印记，让文字能够漂流。</p>
      <form @submit.prevent="submit">
        <label>怎么称呼你<input v-model="form.nickname" maxlength="20" autocomplete="nickname" placeholder="昵称" /></label>
        <label>出生日期<input v-model="form.birthday" type="date" /></label>
        <label>性别<select v-model="form.gender"><option value="" disabled>请选择</option><option value="female">女性</option><option value="male">男性</option><option value="prefer_not_to_say">不标注</option></select></label>
        <label>你此刻在<input v-model="form.region" maxlength="30" placeholder="城市或一段模糊的地方" /></label>
        <button class="primary-button" :disabled="saving" type="submit">{{ saving ? '正在留下印记' : '开始漂流' }}</button>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      </form>
    </section>
  </main>
</template>
