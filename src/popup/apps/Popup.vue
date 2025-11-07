<script setup lang="ts">
import { ref, onMounted } from "vue";

const score = ref<number | null>(null);
const currentDomain = ref<string | null>(null);

onMounted(async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const url: string | null = tabs[0]?.url ?? null;
  currentDomain.value = url ? new URL(url!).hostname : null;

  const response = (await browser.runtime.sendMessage({
    type: "GET_CLASSIFIER_SCORE",
  })) as { value: any };

  const value: number = Number(response.value);
  score.value = isNaN(value) ? null : value;
});
</script>

<template>
  <div class="popup">
    <header class="popup__header">
      <h1 class="header__domain-label">
        <span v-if="currentDomain">{{ currentDomain }}</span>
        <span v-else>No Domain</span>
      </h1>
    </header>
    <section class="popup__page-stats">
      <h2 class="page-stats__score-label">
        <span v-if="score">{{ (score * 100).toFixed(2) }}%</span>
        <span v-else>No score is available on this page.</span>
      </h2>
    </section>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.popup {
  @apply flex flex-col;
  @apply items-center;
  @apply w-full h-full;
  background-color: var(--color-popup-background-primary);
}

.popup__header {
  @apply flex;
  @apply justify-center items-center text-center;
  @apply p-2 w-full;
  background-color: var(--color-popup-panel-primary);
}

.header__domain-label {
  @apply whitespace-nowrap overflow-hidden text-ellipsis;
}

.popup__page-stats {
  @apply flex flex-col;
  @apply justify-center items-center text-center;
  @apply p-10 w-full;
}

.page-stats__score-label {
  @apply text-lg font-bold;
}

h1,
h2,
h3,
h4,
h5,
h6,
p,
span,
a {
  /* Default text styles */
  color: var(--color-popup-text-primary);
}
</style>
