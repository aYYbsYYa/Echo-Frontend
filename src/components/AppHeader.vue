<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useUserStore } from '@/stores/user'

const route = useRoute()
const user = useUserStore()
const title = computed(() => {
  if (route.name === 'history') return '漂流档案'
  if (route.name === 'soul') return 'Soul Echo'
  return 'Yeve Echo'
})
</script>

<template>
  <header class="app-header">
    <RouterLink class="wordmark" to="/">{{ title }}</RouterLink>
    <nav aria-label="主导航">
      <RouterLink to="/">海面</RouterLink>
      <RouterLink to="/soul">回响</RouterLink>
      <RouterLink to="/history">档案</RouterLink>
    </nav>
    <span class="avatar" :title="user.profile?.nickname">{{ user.profile?.avatar }}</span>
  </header>
</template>
