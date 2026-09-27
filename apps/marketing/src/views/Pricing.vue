<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import Icon from "../components/Icon.vue";
import { getCatalog, money } from "../api";

const plans = ref([]);
const country = ref(Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Kolkata" ? "IN" : "US");
const error = ref("");
const loading = ref(true);

const available = computed(() => plans.value.filter((p) => p.checkoutEnabled));
const upcoming = computed(() => plans.value.filter((p) => !p.checkoutEnabled));

onMounted(async () => {
  try {
    plans.value = (await getCatalog()).plans;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <main class="container">
    <section class="pricing-head">
      <span class="kicker">Pricing</span>
      <h1>One payment. <span class="gradient-text">Yours to ship.</span></h1>
      <p>Buy once, keep the code, and get 12 months of updates on every ForgeArc kit.</p>
      <div class="segmented" role="group" aria-label="Billing region">
        <button type="button" :class="{ active: country === 'IN' }" @click="country = 'IN'">India · ₹ Razorpay</button>
        <button type="button" :class="{ active: country === 'US' }" @click="country = 'US'">International · $ Stripe</button>
      </div>
    </section>

    <p v-if="error" class="error" style="text-align: center">{{ error }}</p>
    <p v-if="loading" class="status" style="text-align: center">Loading plans…</p>

    <template v-if="available.length">
      <div class="group-title">
        <h2>ForgeArc kits</h2>
        <p>Available now</p>
      </div>
      <section class="plans">
        <article
          v-for="plan in available"
          :key="plan.id"
          class="card plan"
          :class="{ featured: plan.id === 'forgearc-bundle' }"
        >
          <h3>{{ plan.name }}</h3>
          <p>{{ plan.summary }}</p>
          <div class="price">
            <strong>{{ money(plan, country) }}</strong>
            <span>one time</span>
          </div>
          <ul>
            <li v-for="item in plan.includes" :key="item"><Icon name="check" :size="16" />{{ item }}</li>
          </ul>
          <RouterLink
            class="btn btn-block"
            :class="plan.id === 'forgearc-bundle' ? 'btn-brand' : 'btn-alt'"
            :to="`/checkout?plan=${plan.id}&country=${country}`"
          >
            Buy {{ plan.name }}
          </RouterLink>
        </article>
      </section>
      <aside class="purchase-assurance">
        <div><Icon name="shield" :size="20" /><span><strong>Verified checkout</strong>Razorpay in India, Stripe internationally</span></div>
        <div><Icon name="code" :size="20" /><span><strong>Source product</strong>Deploy into infrastructure you control</span></div>
        <div><Icon name="book" :size="20" /><span><strong>Guided delivery</strong>Setup instructions and frozen dependency locks</span></div>
        <div><Icon name="bolt" :size="20" /><span><strong>12 months included</strong>Product updates without a recurring runtime fee</span></div>
      </aside>
    </template>

    <template v-if="upcoming.length">
      <div class="group-title">
        <h2>ForgeArc AI</h2>
        <p>Launch pricing · checkout opens at release</p>
      </div>
      <section class="plans" style="margin-bottom: 96px">
        <article v-for="plan in upcoming" :key="plan.id" class="card plan closed">
          <span class="pill pill-muted">{{ plan.badge }}</span>
          <h3>{{ plan.name }}</h3>
          <p>{{ plan.summary }}</p>
          <div class="price">
            <strong>{{ money(plan, country) }}</strong>
            <span>{{ plan.priceUsd === 0 ? "free" : "one time" }}</span>
          </div>
          <ul>
            <li v-for="item in plan.includes" :key="item"><Icon name="check" :size="16" />{{ item }}</li>
          </ul>
          <p class="plan-note">Opens with the ForgeArc AI release</p>
        </article>
      </section>
    </template>
  </main>
</template>
