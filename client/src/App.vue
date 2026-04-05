<template>
  <div>
    <h1>Минимальный js client server, postgreSQL</h1>
    <div v-for="user in users" :key="user.id" class="user">
      [ id ] : {{ user.id }} [ Name ] : {{ user.name }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const users = ref([])

onMounted(async () => {
  const res = await fetch('/users')
  users.value = await res.json()
})
</script>