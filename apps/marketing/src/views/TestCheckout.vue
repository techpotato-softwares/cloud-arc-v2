<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Icon from "../components/Icon.vue";
import { simulateCheckout } from "../api";

const route = useRoute();
const router = useRouter();
const error = ref("");
const busy = ref(false);

async function confirm() {
  error.value = "";
  busy.value = true;
  try {
    await simulateCheckout({ orderId: route.query.order, provider: route.query.provider });
    router.push({ path: "/thanks", query: { order: route.query.order } });
  } catch (err) {
    error.value = err.message;
    busy.value = false;
  }
}
</script>

<template>
  <main class="container narrow">
    <span class="success-ring"><Icon name="lock" :size="28" /></span>
    <h1>Test payment</h1>
    <p>Commerce is in test mode, so no card is charged. Confirming records a paid order in the local ledger.</p>
    <button class="btn btn-brand" type="button" :disabled="busy" @click="confirm">Confirm test payment</button>
    <p v-if="error" class="error" style="margin-top: 16px">{{ error }}</p>
  </main>
</template>
