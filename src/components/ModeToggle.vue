<script setup>
// Schakelaar tussen de twee (volledig gescheiden) scanpagina's.
defineProps({ modelValue: { type: String, required: true } })
const emit = defineEmits(['update:modelValue'])

const modes = [
  { id: 'roboflow', label: 'Roboflow', sub: 'op toestel' },
  { id: 'gemini', label: 'Gemini', sub: 'cloud' },
]
</script>

<template>
  <div class="toggle" role="tablist" aria-label="Kies het model">
    <button
      v-for="m in modes"
      :key="m.id"
      role="tab"
      :aria-selected="modelValue === m.id"
      :class="{ active: modelValue === m.id }"
      @click="emit('update:modelValue', m.id)"
    >
      {{ m.label }}<small>{{ m.sub }}</small>
    </button>
  </div>
</template>

<style scoped>
.toggle {
  display: inline-flex;
  background: rgba(34, 34, 34, 0.06);
  border-radius: 999px;
  padding: 3px;
  gap: 2px;
}
button {
  border: 0;
  background: transparent;
  color: var(--muted);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}
button small {
  font-size: 11px;
  opacity: 0.7;
}
button.active {
  background: #fff;
  color: var(--ink);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
@media (max-width: 520px) {
  button small {
    display: none;
  }
}
</style>
