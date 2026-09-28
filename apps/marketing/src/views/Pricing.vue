<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import Icon from "../components/Icon.vue";
import { getCatalog, money } from "../api";
import catalogSnapshot from "../catalog.json";
import { capture } from "../analytics";

const plans = ref(catalogSnapshot.plans);
const country = ref(Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Kolkata" ? "IN" : "US");
const error = ref("");
const loading = ref(false);
const activeFamily = ref("node");

const families = computed(() => [...new Set(plans.value.map((plan) => plan.family))]);
const familyPlans = computed(() => plans.value.filter((plan) => plan.family === activeFamily.value));
const bundleSavings = computed(() => {
  const node = plans.value.find((plan) => plan.id === "forgearc-node");
  const python = plans.value.find((plan) => plan.id === "forgearc-python");
  const bundle = plans.value.find((plan) => plan.id === "forgearc-bundle");
  if (!node || !python || !bundle) return null;
  return {
    IN: node.priceInr + python.priceInr - bundle.priceInr,
    US: node.priceUsd + python.priceUsd - bundle.priceUsd
  };
});

function selectCountry(value) {
  country.value = value;
  capture("pricing_region_selected", { region: value });
}

function selectFamily(value) {
  activeFamily.value = value;
  capture("pricing_family_selected", { family: value });
}

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
        <button type="button" :class="{ active: country === 'IN' }" @click="selectCountry('IN')">India · ₹ Razorpay</button>
        <button type="button" :class="{ active: country === 'US' }" @click="selectCountry('US')">International · $ Stripe</button>
      </div>
    </section>

    <p v-if="error" class="error" style="text-align: center">{{ error }}</p>
    <p v-if="loading" class="status" style="text-align: center">Loading plans…</p>

    <div v-if="plans.length" class="product-tabs" role="tablist" aria-label="Pricing product">
      <button v-for="family in families" :key="family" role="tab" :aria-selected="activeFamily === family" :class="{ active: activeFamily === family }" @click="selectFamily(family)">
        {{ family === "ai" ? "ForgeArc AI" : family === "bundle" ? "Bundles" : `ForgeArc ${family[0].toUpperCase() + family.slice(1)}` }}
      </button>
    </div>

    <template v-if="familyPlans.length">
      <div class="group-title">
        <h2>{{ activeFamily === "ai" ? "AI modules and licenses" : "Source licenses" }}</h2>
        <p>Prices come directly from the checkout catalog</p>
      </div>
      <section class="plans">
        <article
          v-for="plan in familyPlans"
          :key="plan.id"
          class="card plan"
          :class="{ featured: plan.recommended, closed: !plan.checkoutEnabled }"
        >
          <span class="pill" :class="{ 'pill-muted': !plan.checkoutEnabled }">{{ plan.badge }}</span>
          <span class="card-meta">{{ plan.tier }}</span>
          <h3>{{ plan.name }}</h3>
          <p>{{ plan.summary }}</p>
          <div class="price">
            <strong>{{ money(plan, country) }}</strong>
            <span>one time</span>
          </div>
          <ul>
            <li v-for="item in plan.includes" :key="item"><Icon name="check" :size="16" />{{ item }}</li>
            <li><Icon name="shield" :size="16" />{{ plan.licenseScope }}</li>
            <li><Icon name="bolt" :size="16" />{{ plan.updates }}</li>
          </ul>
          <RouterLink
            v-if="plan.checkoutEnabled"
            class="btn btn-block"
            :class="plan.recommended ? 'btn-brand' : 'btn-alt'"
            :to="`/checkout?plan=${plan.id}&country=${country}`"
            @click="capture('plan_selected', { plan: plan.id, region: country })"
          >
            Buy {{ plan.name }}
          </RouterLink>
          <p v-else class="plan-note">Checkout stays closed until this plan ships</p>
          <p v-if="plan.id === 'forgearc-bundle' && bundleSavings" class="plan-note">Save {{ country === "IN" ? `₹${bundleSavings.IN.toLocaleString("en-IN")}` : `$${bundleSavings.US}` }} versus buying both kits separately.</p>
        </article>
      </section>
      <aside class="purchase-assurance">
        <div><Icon name="shield" :size="20" /><span><strong>Verified checkout</strong>Razorpay in India, Stripe internationally</span></div>
        <div><Icon name="code" :size="20" /><span><strong>Source product</strong>Deploy into infrastructure you control</span></div>
        <div><Icon name="book" :size="20" /><span><strong>Guided delivery</strong>Setup instructions and frozen dependency locks</span></div>
        <div><Icon name="bolt" :size="20" /><span><strong>12 months included</strong>Product updates without a recurring runtime fee</span></div>
      </aside>
    </template>

    <div style="height: 72px"></div>
  </main>
</template>
