<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import Icon from "./Icon.vue";
import { recentPurchases } from "../api";

const current = ref(null);
const visible = ref(false);
let refreshTimer;
let hideTimer;
let lastShown = "";

function label(iso) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

async function refresh() {
  const payload = await recentPurchases();
  const latest = payload.purchases[0];
  if (!latest) return;
  const key = `${latest.planName}-${latest.purchasedAt}`;
  if (key === lastShown) return;
  lastShown = key;
  current.value = latest;
  visible.value = true;
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => (visible.value = false), 7000);
}

onMounted(() => {
  setTimeout(refresh, 2500);
  refreshTimer = setInterval(refresh, 15000);
});
onUnmounted(() => {
  clearInterval(refreshTimer);
  clearTimeout(hideTimer);
});
</script>

<template>
  <Transition name="toast">
    <aside v-if="visible && current" class="toast" role="status">
      <span class="toast-icon"><Icon name="bag" :size="18" /></span>
      <div>
        <strong>{{ current.planName }}</strong> was just purchased
        <br />
        <small>{{ label(current.purchasedAt) }} · verified order</small>
      </div>
    </aside>
  </Transition>
</template>
