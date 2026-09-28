<script setup>
import { computed, ref } from "vue";

const engineers = ref(2);
const weeks = ref(3);
const hourly = ref(1800);
const kit = ref(49999);
const hours = computed(() => engineers.value * weeks.value * 40);
const buildCost = computed(() => hours.value * hourly.value);
const savings = computed(() => Math.max(0, buildCost.value - kit.value));
const format = (value) => `₹${Math.round(value).toLocaleString("en-IN")}`;
</script>

<template>
  <div class="roi-grid">
    <div>
      <span class="kicker">Cost calculator</span>
      <h3 style="font-size: 34px; margin: 12px 0">Calculate what rebuilding the baseline costs</h3>
      <p class="section-copy">Use the calculator on the right. Change the team size, the weeks, or the hourly cost and the estimate updates immediately. It compares that build cost with the ₹49,999 ForgeArc bundle.</p>
    </div>
    <form class="roi-card calculator" aria-label="Baseline cost calculator" @submit.prevent>
      <div class="calculator-title">
        <strong>Calculator</strong>
        <span>Type your numbers</span>
      </div>
      <div class="roi-fields">
        <label class="roi-field">Engineers on the rebuild <input v-model.number="engineers" type="number" min="1" max="30" inputmode="numeric" /></label>
        <label class="roi-field">Weeks to rebuild the baseline <input v-model.number="weeks" type="number" min="1" max="20" inputmode="numeric" /></label>
        <label class="roi-field">Hourly cost per engineer (₹) <input v-model.number="hourly" type="number" min="100" step="100" inputmode="numeric" /></label>
      </div>
      <div class="roi-results" aria-live="polite">
        <div class="roi-result"><strong>{{ hours }}h</strong><span>calculated rebuild time</span></div>
        <div class="roi-result"><strong>{{ format(buildCost) }}</strong><span>calculated build cost</span></div>
        <div class="roi-result"><strong>{{ format(savings) }}</strong><span>calculated difference vs bundle</span></div>
      </div>
    </form>
  </div>
</template>
