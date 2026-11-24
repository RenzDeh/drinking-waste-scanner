<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { cleanNickname, createPlayer, isValidNickname, playerState } from '../services/player'
import { NICKNAME } from '../config'

const router = useRouter()
const nickname = ref(playerState.player?.nickname ?? '')
const error = ref('')
const valid = computed(() => isValidNickname(nickname.value))
const editing = computed(() => playerState.player != null)

function submit() {
  error.value = ''
  try {
    createPlayer(cleanNickname(nickname.value))
    router.replace('/scan')
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <main class="start">
    <div class="hero">
      <div class="logo">
        <img src="/icon.svg" alt="" width="84" height="84" />
      </div>
      <h1>Statiegeld-scanner</h1>
      <p class="lead">Scan blikjes, PET- en glazen flessen. Verdien punten en (fictief) statiegeld.</p>
    </div>

    <form class="card" @submit.prevent="submit">
      <label for="nick">{{ editing ? 'Bijnaam wijzigen' : 'Kies een bijnaam' }}</label>
      <input
        id="nick"
        v-model="nickname"
        type="text"
        inputmode="text"
        autocomplete="nickname"
        autocapitalize="words"
        enterkeyhint="go"
        :maxlength="NICKNAME.max"
        placeholder="bv. BlikjesBaas"
      />
      <p class="hint">{{ NICKNAME.min }}–{{ NICKNAME.max }} tekens. Zichtbaar in de ranking.</p>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="btn" type="submit" :disabled="!valid">{{ editing ? 'Opslaan' : 'Start met scannen' }}</button>
    </form>

    <ul class="privacy">
      <li>🔒 Geen account of wachtwoord nodig</li>
      <li>📱 Het AI-model draait op je toestel — camerabeelden verlaten je telefoon nooit</li>
      <li>🗂️ We bewaren enkel je bijnaam, punten en type item</li>
    </ul>
  </main>
</template>

<style scoped>
.start {
  min-height: 100dvh;
  padding: calc(env(safe-area-inset-top) + 32px) 20px calc(env(safe-area-inset-bottom) + 24px);
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 480px;
  margin: 0 auto;
}
.hero {
  text-align: center;
  margin-top: 4vh;
}
.logo {
  display: inline-flex;
  padding: 10px;
  border-radius: 28px;
  background: radial-gradient(circle, rgba(61, 220, 132, 0.25), transparent 70%);
}
h1 {
  font-size: 30px;
  margin: 12px 0 8px;
  letter-spacing: -0.02em;
}
.lead {
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
}
.card {
  background: var(--surface);
  border-radius: 24px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
label {
  font-weight: 700;
}
input {
  font-size: 18px; /* ≥16px voorkomt automatisch inzoomen op iOS */
  padding: 16px;
  border-radius: 14px;
  border: 2px solid transparent;
  background: var(--surface-2);
  color: var(--text);
  outline: none;
}
input:focus {
  border-color: var(--accent);
}
.hint {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
.error {
  margin: 0;
  color: #ff8a80;
}
.privacy {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.4;
}
</style>
