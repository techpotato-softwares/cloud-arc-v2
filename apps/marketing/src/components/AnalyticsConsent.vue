<script setup>
import { ref } from "vue";
import { analyticsConsent, setAnalyticsConsent, trackPageView } from "../analytics";

const visible = ref(analyticsConsent() === null);

function choose(accepted) {
  setAnalyticsConsent(accepted);
  visible.value = false;
  if (accepted) trackPageView();
}
</script>

<template>
  <aside v-if="visible" class="consent-banner" aria-label="Analytics preference">
    <div>
      <strong>Your privacy, your choice</strong>
      <p>Allow anonymous visit analytics to help us improve ForgeArc. We do not enable analytics before you agree.</p>
    </div>
    <div class="consent-actions">
      <button class="btn btn-ghost btn-sm" type="button" @click="choose(false)">Decline</button>
      <button class="btn btn-brand btn-sm" type="button" @click="choose(true)">Allow analytics</button>
    </div>
  </aside>
</template>
