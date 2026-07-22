<script setup lang="ts">
import { onBeforeMount } from 'vue'

import { useUserStore } from '@/stores/user'

const user = useUserStore()
onBeforeMount(user.hydrate)
</script>

<template>
  <RouterView v-if="user.ready" />
</template>

<style>
@import './assets/main.css';
</style>
