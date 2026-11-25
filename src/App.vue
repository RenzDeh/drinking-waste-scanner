<script setup>
// Twee volledig gescheiden scanpagina's, gekozen met een schakelaar:
//  - Roboflow: eigen getraind model, draait op het toestel (ScanView, ongewijzigd)
//  - Gemini:   foto naar Google Gemini via onze server (GeminiView)
// Met v-if wordt telkens maar één pagina gemount: de andere stopt camera en lus volledig.
import { ref, watch } from 'vue'
import ScanView from './views/ScanView.vue'
import GeminiView from './views/GeminiView.vue'
import ModeToggle from './components/ModeToggle.vue'
import { getItem, setItem } from './lib/storage'

const KEY = 'statiegeld.mode'
const mode = ref(getItem(KEY) === 'gemini' ? 'gemini' : 'roboflow')
watch(mode, (m) => setItem(KEY, m))
</script>

<template>
  <ScanView v-if="mode === 'roboflow'" key="roboflow">
    <template #toggle><ModeToggle v-model="mode" /></template>
  </ScanView>
  <GeminiView v-else key="gemini">
    <template #toggle><ModeToggle v-model="mode" /></template>
  </GeminiView>
</template>
