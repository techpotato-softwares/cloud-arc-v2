<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import Icon from "../components/Icon.vue";
import { getCatalog, money, startCheckout } from "../api";
import { capture } from "../analytics";

const route = useRoute();
const plan = ref(null);
const loaded = ref(false);
const name = ref("");
const email = ref("");
const country = ref(route.query.country === "IN" ? "IN" : "US");
const error = ref("");
const busy = ref(false);

const provider = computed(() => (country.value === "IN" ? "Razorpay" : "Stripe"));

onMounted(async () => {
  const payload = await getCatalog();
  plan.value = payload.plans.find((item) => item.id === route.query.plan && item.checkoutEnabled) || null;
  loaded.value = true;
});

async function submit() {
  error.value = "";
  busy.value = true;
  capture("checkout_started", {
    plan: plan.value.id,
    provider: provider.value.toLowerCase(),
    region: country.value
  });
  try {
    const result = await startCheckout({
      planId: plan.value.id,
      provider: provider.value.toLowerCase(),
      email: email.value,
      name: name.value,
      country: country.value
    });
    window.location.assign(result.url);
  } catch (err) {
    error.value = err.message;
    busy.value = false;
  }
}
</script>

<template>
  <main class="container">
    <div v-if="loaded && !plan" class="narrow">
      <h1>Pick a plan first</h1>
      <p>This plan is not open for checkout.</p>
      <RouterLink class="btn btn-brand" to="/pricing">See plans</RouterLink>
    </div>

    <div v-else-if="plan" class="checkout">
      <aside class="summary">
        <span class="kicker">Order summary</span>
        <h1>{{ plan.name }}</h1>
        <p>{{ plan.summary }}</p>
        <div class="price">
          <strong>{{ money(plan, country) }}</strong>
          <span>one time</span>
        </div>
        <ul class="plan" style="list-style: none; padding: 0; display: grid; gap: 10px">
          <li v-for="item in plan.includes" :key="item" style="display: flex; gap: 10px; color: var(--text-2)">
            <Icon name="check" :size="16" style="color: var(--brand-2); margin-top: 4px" />{{ item }}
          </li>
        </ul>
      </aside>

      <div class="form-card">
        <h3>Your details</h3>
        <p>The license and setup steps go to this email.</p>
        <form @submit.prevent="submit">
          <label class="field">Full name <input v-model="name" required autocomplete="name" /></label>
          <label class="field">Email <input v-model="email" type="email" required autocomplete="email" /></label>
          <label class="field">
            Billing country
            <select v-model="country">
              <option value="IN">India</option>
              <option value="US">Outside India</option>
            </select>
          </label>
          <button class="btn btn-brand btn-block" type="submit" :disabled="busy">
            <Icon name="lock" :size="16" /> Pay {{ money(plan, country) }} with {{ provider }}
          </button>
          <p class="status" style="text-align: center">Secure payment through {{ provider }}. The license is issued after the charge clears.</p>
          <p v-if="error" class="error">{{ error }}</p>
        </form>
      </div>
    </div>
  </main>
</template>
