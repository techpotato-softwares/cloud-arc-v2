<script setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const error = ref("");

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Razorpay checkout could not be loaded"));
    document.head.appendChild(script);
  });
}

onMounted(async () => {
  try {
    if (!route.query.order || !route.query.providerOrder || !route.query.key) {
      throw new Error("This checkout link is incomplete");
    }
    await loadRazorpay();
    const checkout = new window.Razorpay({
      key: route.query.key,
      order_id: route.query.providerOrder,
      amount: Number(route.query.amount),
      currency: "INR",
      name: "ForgeArc",
      description: route.query.name || "ForgeArc source product",
      handler: () => router.push({ path: "/thanks", query: { order: route.query.order } }),
      modal: {
        ondismiss: () => router.push("/pricing")
      },
      theme: { color: "#c2410c" }
    });
    checkout.on("payment.failed", (event) => {
      error.value = event.error?.description || "Payment was not completed";
    });
    checkout.open();
  } catch (err) {
    error.value = err.message;
  }
});
</script>

<template>
  <main class="container narrow">
    <span class="kicker">Secure checkout</span>
    <h1>Opening Razorpay…</h1>
    <p>Complete the payment in Razorpay. Your license is issued only after the signed webhook confirms the charge.</p>
    <p v-if="error" class="error">{{ error }}</p>
  </main>
</template>
