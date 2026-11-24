<script setup>
// `c` is het object uit useChallenge() (bevat refs, daarom .value).
defineProps({ c: { type: Object, required: true }, disabled: Boolean })
</script>

<template>
  <div class="challenge" :class="c.status.value">
    <div class="row">
      <span class="badge">Dagdoel</span>
      <span class="label">{{ c.challenge.label }}</span>
      <span class="bonus">+{{ c.challenge.bonus }}</span>
    </div>

    <template v-if="c.status.value === 'running'">
      <div class="row live">
        <span class="count">{{ c.count.value }}/{{ c.challenge.target }}</span>
        <div class="bar"><div class="fill" :style="{ width: c.progress.value * 100 + '%' }"></div></div>
        <span class="timer" :class="{ low: c.remainingMs.value < 15000 }">{{ c.remainingLabel.value }}</span>
        <button class="x" aria-label="Dagdoel stoppen" @click="c.cancel()">✕</button>
      </div>
    </template>

    <div v-else-if="c.status.value === 'won'" class="msg">🎉 Gehaald! +{{ c.challenge.bonus }} bonuspunten</div>
    <div v-else-if="c.doneToday.value" class="msg muted">✅ Vandaag al gehaald — morgen een nieuw doel.</div>
    <div v-else class="row">
      <span v-if="c.status.value === 'lost'" class="msg lost">⏱️ Tijd om! Probeer opnieuw.</span>
      <button class="start" :disabled="disabled" @click="c.start()">
        {{ c.status.value === 'lost' ? 'Opnieuw' : 'Start' }} ({{ c.challenge.durationSec }} s)
      </button>
    </div>
  </div>
</template>

<style scoped>
.challenge {
  background: rgba(11, 31, 23, 0.78);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.challenge.running {
  border-color: var(--accent);
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.badge {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #0b1f17;
  background: #ffd54f;
  padding: 3px 8px;
  border-radius: 999px;
}
.label {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
}
.bonus {
  color: #ffd54f;
  font-weight: 800;
}
.count {
  font-weight: 800;
  min-width: 36px;
}
.bar {
  flex: 1;
  height: 8px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s;
}
.timer {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  min-width: 44px;
  text-align: right;
}
.timer.low {
  color: #ff6b6b;
}
.x {
  border: 0;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 14px;
}
.start {
  margin-left: auto;
  border: 0;
  background: var(--accent);
  color: #0b1f17;
  font-weight: 800;
  font-size: 15px;
  padding: 10px 16px;
  border-radius: 12px;
  min-height: 44px;
}
.start:disabled {
  opacity: 0.4;
}
.msg {
  font-size: 14px;
  font-weight: 600;
}
.msg.muted {
  color: var(--muted);
}
.msg.lost {
  color: #ff9e9e;
}
</style>
