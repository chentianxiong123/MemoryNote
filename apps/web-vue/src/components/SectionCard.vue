<script setup lang="ts">
defineProps<{
  title: string;
  eyebrow?: string;
}>();
</script>

<template>
  <article class="section-card">
    <div class="section-card__head">
      <p v-if="eyebrow" class="section-card__eyebrow">{{ eyebrow }}</p>
      <h3 class="section-card__title">{{ title }}</h3>
    </div>
    <div class="section-card__body">
      <slot />
    </div>
  </article>
</template>
