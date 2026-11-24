import { createRouter, createWebHistory } from 'vue-router'
import { hasPlayer } from './services/player'
import StartView from './views/StartView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'start', component: StartView, meta: { public: true } },
    // Scan-scherm lazy laden: daar zit de zware TensorFlow.js-bundle achter.
    { path: '/scan', name: 'scan', component: () => import('./views/ScanView.vue'), meta: { nav: true } },
    { path: '/profiel', name: 'profiel', component: () => import('./views/ProfileView.vue'), meta: { nav: true } },
    { path: '/leaderboard', name: 'leaderboard', component: () => import('./views/LeaderboardView.vue'), meta: { nav: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  // Eerste bezoek: eerst een bijnaam kiezen.
  if (!to.meta.public && !hasPlayer()) return { name: 'start' }
  // Terugkerende speler op "/" zonder bedoeling om te wijzigen => meteen naar scannen.
  if (to.name === 'start' && hasPlayer() && to.redirectedFrom == null && !router.currentRoute.value.matched.length) {
    return { name: 'scan' }
  }
})

export default router
