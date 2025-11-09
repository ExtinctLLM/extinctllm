<script setup lang="ts">
import { ref, onMounted } from "vue";
import { setData, getData } from "@/utils/storage";

import {
  AiFillSecurityScan as ScanOn,
  AiOutlineSecurityScan as ScanOff,
} from "vue-icons-plus/ai";
import { BiRefresh as Refresh } from "vue-icons-plus/bi";

const articleTooShort = ref<boolean | null>(null);
const score = ref<number | null>(null);
const currentDomain = ref<string | null>(null);
const exceptionsList = ref<string[]>([]);

onMounted(async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const url: string | null = tabs[0]?.url ?? null;
  currentDomain.value = url ? new URL(url!).hostname : null;

  exceptionsList.value = (await getData("exceptionsList")) ?? [];

  await loadScore();
});

async function loadScore() {
  if (
    !currentDomain.value ||
    exceptionsList.value.includes(currentDomain.value)
  )
    score.value = null;
  else {
    const response = (await browser.runtime.sendMessage({
      type: `GET_CLASSIFIER_SCORE_${currentDomain.value}`,
    })) as { value: any };

    if (response.value === "ARTICLE_TOO_SHORT") {
      articleTooShort.value = true;
    } else articleTooShort.value = false;

    const value: number = Math.min(1, Math.max(0, Number(response.value)));
    score.value = isNaN(value) ? null : value;
  }
}

async function toggleDomainException() {
  if (!currentDomain.value) return;
  const domain: string = currentDomain.value;

  if (exceptionsList.value.includes(domain)) {
    // Remove from exceptions
    exceptionsList.value = exceptionsList.value.filter((d) => d !== domain);
    await loadScore();
  } else {
    // Add to exceptions
    exceptionsList.value = [...exceptionsList.value, domain];
  }

  await setData("exceptionsList", [...exceptionsList.value]);
}
</script>

<template>
  <div class="popup">
    <header class="popup__header" v-if="currentDomain">
      <div class="header__labels">
        <p class="header__domain-label">
          <span>{{ currentDomain }}</span>
        </p>
      </div>
      <div class="header__action-row">
        <button
          class="action-row__button text-(--color-actionrow-button-text-primary)"
          @click="loadScore"
          title="Fetch score for this domain"
        >
          <Refresh />
        </button>
        <button
          class="action-row__button"
          @click="toggleDomainException"
          title="Toggle scans for this domain"
        >
          <ScanOff
            class="text-(--color-actionrow-button-text-red)"
            v-if="exceptionsList.includes(currentDomain)"
          />
          <ScanOn class="text-(--color-actionrow-button-text-green)" v-else />
        </button>
      </div>
    </header>
    <section class="popup__page-stats">
      <div
        class="flex flex-col justify-center items-center text-center gap-2"
        v-if="
          currentDomain &&
          !exceptionsList.includes(currentDomain) &&
          score !== null
        "
      >
        <p>We are</p>
        <p class="text-3xl font-mono font-bold">
          {{ (score * 100).toFixed(2) }}%
        </p>
        <p>confident that this page contains AI-generated content.</p>
      </div>
      <p v-else>
        <span v-if="currentDomain && exceptionsList.includes(currentDomain)"
          >Scans are not enabled for this domain.</span
        >
        <span v-else-if="articleTooShort === true"
          >This page is too short to be scanned.</span
        >
        <span v-else>No score is currently available for this page.</span>
      </p>
    </section>
    <footer class="popup__footer">
      <p class="footer__disclaimer-label">Information is subject to errors.</p>
    </footer>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

/* Defaults */
h1,
h2,
h3,
h4,
h5,
h6,
p,
span,
a,
button {
  @apply text-(--color-text-primary);
}

/* Application */
.popup {
  @apply flex flex-col;
  @apply items-center;
  @apply w-full h-full;
  @apply bg-(--color-bg-primary);
}

/* Popup header and footer */
.popup__header,
.popup__footer {
  @apply flex;
  @apply text-center;
  @apply p-3 w-full;
  @apply bg-(--color-panel-primary);
}

.popup__header {
  @apply justify-between items-stretch;
}

.popup__footer {
  @apply justify-center items-center;
}

/* Header labels */
.header__labels {
  @apply flex;
  @apply justify-start items-center;
}

/* Header action row */
.header__action-row {
  @apply flex;
  @apply justify-end items-center;
  @apply gap-3;
}

.action-row__button {
  @apply cursor-pointer;
  @apply flex;
  @apply justify-center items-center text-center;
  @apply text-(--color-actionrow-button-text-primary);

  @apply transition-transform;

  @apply active:scale-75;
}

/* Header and footer labels */
.header__domain-label,
.footer__disclaimer-label {
  @apply whitespace-nowrap overflow-hidden text-ellipsis;
}

.header__domain-label {
  @apply font-bold;
}

/* Scan information */
.popup__page-stats {
  @apply flex flex-col;
  @apply justify-center items-center text-center;
  @apply p-10 w-full;
}
</style>
