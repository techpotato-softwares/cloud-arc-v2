<script setup>
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import Icon from "../components/Icon.vue";
import { DOCS_URL, getOrder } from "../api";

const route = useRoute();
const order = ref(null);
const error = ref("");

onMounted(async () => {
  try {
    order.value = await getOrder(route.query.order);
  } catch (err) {
    error.value = err.message;
  }
});
</script>

<template>
  <main class="container narrow">
    <p v-if="error" class="error">{{ error }}</p>
    <template v-else-if="order">
      <span class="success-ring"><Icon name="check" :size="30" /></span>
      <h1>{{ order.planName }} is yours</h1>
      <p v-if="order.status === 'paid'">
        Payment confirmed. Your setup mail with the private repository invite is on its way.
      </p>
      <p v-else>Waiting for the payment provider to confirm. This page updates on refresh.</p>
      <div v-if="order.downloadToken">
        <p style="margin-bottom: 0">License token</p>
        <code class="token">{{ order.downloadToken }}</code>
      </div>
      <div class="actions" style="justify-content: center; margin-top: 32px">
        <a class="btn btn-brand" :href="DOCS_URL"><Icon name="book" :size="18" /> Open the setup docs</a>
      </div>
    </template>
  </main>
</template>
