<script setup>
import { RouterView, useRoute } from 'vue-router'
import AppNav from './components/AppNav.vue'

const route = useRoute()
</script>

<template>
  <RouterView />
  <AppNav v-if="route.meta.nav" />
</template>
