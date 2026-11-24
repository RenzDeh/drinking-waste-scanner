<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getPlayerScans, firebaseEnabled } from '../services/scans'
import { playerState } from '../services/player'
import { BONUS_CLASS, CLASS_INFO, CLASSES, EURO_PER_POINT } from '../config'

const scans = ref([])
const loading = ref(true)
const error = ref('')

const total = computed(() => scans.value.reduce((s, x) => s + x.punten, 0))
const euro = computed(() =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(total.value * EURO_PER_POINT),
)
const perClass = computed(() =>
  CLASSES.map((k) => ({ k, n: scans.value.filter((s) => s.klasse === k).length, ...CLASS_INFO[k] })),
)

const dateFmt = new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function info(klasse) {
  if (klasse === BONUS_CLASS) return { label: 'Dagdoel-bonus', emoji: '🏅' }
  return CLASS_INFO[klasse] ?? { label: klasse, emoji: '•' }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    scans.value = await getPlayerScans(playerState.player.id)
  } catch (e) {
    console.error(e)
    error.value = 'Historiek laden mislukt. Controleer je verbinding.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <main class="page">
    <header class="head">
      <div>
        <p class="eyebrow">Profiel</p>
        <h1>{{ playerState.player.nickname }}</h1>
      </div>
      <RouterLink to="/" class="edit">Bijnaam wijzigen</RouterLink>
    </header>

    <div class="stats">
      <div class="stat big">
        <span class="value">{{ total }}</span>
        <span class="label">punten</span>
      </div>
      <div class="stat big euro">
        <span class="value">{{ euro }}</span>
        <span class="label">verdiend statiegeld*</span>
      </div>
    </div>

    <div class="classes">
      <div v-for="c in perClass" :key="c.k" class="cls" :style="{ '--c': c.color }">
        <span class="emoji">{{ c.emoji }}</span>
        <span class="n">{{ c.n }}</span>
        <span class="l">{{ c.label }}</span>
      </div>
    </div>

    <p class="footnote">* Fictief: {{ Math.round(1 / EURO_PER_POINT) }} punten = € 1,00. <span v-if="!firebaseEnabled">· Lokale modus (Firebase niet ingesteld)</span></p>

    <h2>Historiek</h2>
    <div v-if="loading" class="empty">Laden…</div>
    <div v-else-if="error" class="empty">
      {{ error }}
      <button class="btn secondary" @click="load">Opnieuw</button>
    </div>
    <div v-else-if="!scans.length" class="empty">
      Nog geen scans. <RouterLink to="/scan">Scan je eerste item</RouterLink>
    </div>
    <ul v-else class="list">
      <li v-for="s in scans" :key="s.id" class="item">
        <span class="emoji">{{ info(s.klasse).emoji }}</span>
        <div class="meta">
          <span class="name">{{ info(s.klasse).label }}</span>
          <span class="sub">
            {{ dateFmt.format(s.tijdstip) }}
            <template v-if="s.klasse !== BONUS_CLASS"> · {{ Math.round(s.zekerheid * 100) }}% zeker</template>
          </span>
        </div>
        <span class="pts">+{{ s.punten }}</span>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
}
.edit {
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  padding: 10px 0;
}
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.stat {
  background: var(--surface);
  border-radius: 20px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat .value {
  font-size: 32px;
  font-weight: 900;
  letter-spacing: -0.02em;
}
.stat.euro .value {
  color: var(--accent);
}
.stat .label {
  color: var(--muted);
  font-size: 13px;
}
.classes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.cls {
  background: var(--surface);
  border-radius: 16px;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-bottom: 3px solid var(--c);
}
.cls .emoji {
  font-size: 22px;
}
.cls .n {
  font-size: 22px;
  font-weight: 800;
}
.cls .l {
  font-size: 12px;
  color: var(--muted);
}
.footnote {
  color: var(--muted);
  font-size: 12px;
  margin: 0;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface);
  padding: 12px 14px;
  border-radius: 16px;
}
.item .emoji {
  font-size: 24px;
}
.meta {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.name {
  font-weight: 700;
}
.sub {
  color: var(--muted);
  font-size: 13px;
}
.pts {
  font-weight: 800;
  color: var(--accent);
}
</style>
