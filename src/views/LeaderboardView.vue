<script setup>
import { onMounted, ref } from 'vue'
import { getLeaderboard, firebaseEnabled } from '../services/scans'
import { playerState } from '../services/player'
import { LEADERBOARD_SIZE } from '../config'

const rows = ref([])
const loading = ref(true)
const error = ref('')
const medals = ['🥇', '🥈', '🥉']

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await getLeaderboard(LEADERBOARD_SIZE)
  } catch (e) {
    console.error(e)
    error.value = 'Ranking laden mislukt. Controleer je verbinding.'
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
        <p class="eyebrow">Top {{ LEADERBOARD_SIZE }}</p>
        <h1>Ranking</h1>
      </div>
      <button class="refresh" aria-label="Vernieuwen" :disabled="loading" @click="load">↻</button>
    </header>

    <p v-if="!firebaseEnabled" class="note">Lokale modus: enkel scans op dit toestel. Stel Firebase in voor een gedeelde ranking.</p>

    <div v-if="loading" class="empty">Laden…</div>
    <div v-else-if="error" class="empty">
      {{ error }}
      <button class="btn secondary" @click="load">Opnieuw</button>
    </div>
    <div v-else-if="!rows.length" class="empty">Nog niemand gescand. Wees de eerste!</div>
    <ol v-else class="list">
      <li v-for="(r, i) in rows" :key="r.spelerId" class="row" :class="{ me: r.spelerId === playerState.player?.id, top: i < 3 }">
        <span class="rank">{{ medals[i] ?? i + 1 }}</span>
        <div class="who">
          <span class="name">{{ r.bijnaam }}<span v-if="r.spelerId === playerState.player?.id" class="you">jij</span></span>
          <span class="sub">{{ r.items }} items</span>
        </div>
        <span class="pts">{{ r.totaal }}<small> pt</small></span>
      </li>
    </ol>
  </main>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.refresh {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 0;
  background: var(--surface);
  color: var(--text);
  font-size: 22px;
}
.note {
  color: #ffd54f;
  font-size: 13px;
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
.row {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--surface);
  border-radius: 18px;
  padding: 14px 16px;
  border: 2px solid transparent;
}
.row.me {
  border-color: var(--accent);
}
.rank {
  width: 32px;
  text-align: center;
  font-weight: 800;
  font-size: 18px;
  color: var(--muted);
}
.row.top .rank {
  font-size: 26px;
}
.who {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.name {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.you {
  margin-left: 8px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  background: var(--accent);
  color: #0b1f17;
  padding: 2px 6px;
  border-radius: 6px;
  vertical-align: middle;
}
.sub {
  color: var(--muted);
  font-size: 13px;
}
.pts {
  font-weight: 900;
  font-size: 20px;
}
.pts small {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}
</style>
