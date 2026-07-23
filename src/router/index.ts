import { createRouter, createWebHistory } from 'vue-router'

import BottleDetailView from '@/views/BottleDetailView.vue'
import HistoryView from '@/views/HistoryView.vue'
import HomeView from '@/views/HomeView.vue'
import OnboardingView from '@/views/OnboardingView.vue'
import PlaneDetailView from '@/views/PlaneDetailView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/start', name: 'onboarding', component: OnboardingView },
    { path: '/history', name: 'history', component: HistoryView },
    { path: '/bottle/:id', name: 'bottle-detail', component: BottleDetailView },
    { path: '/plane/:id', name: 'plane-detail', component: PlaneDetailView },
  ],
})

router.beforeEach((to) => {
  const initialized = Boolean(localStorage.getItem('echo.user'))
  if (!initialized && to.name !== 'onboarding') return { name: 'onboarding' }
  if (initialized && to.name === 'onboarding') return { name: 'home' }
  return true
})

export default router
