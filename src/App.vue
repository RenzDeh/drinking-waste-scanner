<script setup>
import { onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppNav from './components/AppNav.vue'
import { preloadModel } from './services/inference'

const route = useRoute()

// Model meteen op de achtergrond laden (download + opwarmen duurt even, zeker op een
// iPhone). Tegen dat je op het scanscherm komt, is het dan (bijna) klaar.
onMounted(() => setTimeout(preloadModel, 300))
</script>

<template>
  <RouterView />
  <AppNav v-if="route.meta.nav" />
</template>
