<script setup>
import { ref } from "vue";
import { createLead } from "../api";

const email = ref("");
const whatsapp = ref("");
const consent = ref(false);
const status = ref("");
const error = ref("");
const busy = ref(false);

async function submit() {
  status.value = "";
  error.value = "";
  busy.value = true;
  try {
    const result = await createLead({
      email: email.value,
      whatsapp: whatsapp.value,
      consent: consent.value,
      page: window.location.pathname
    });
    status.value = result.followUpStatus === "queued"
      ? "Saved. We will reach out only on the channel you allowed."
      : "Saved. We will not contact you unless you tick the box.";
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="form-card">
    <h3>Not ready to buy today?</h3>
    <p>Get the launch notes and the AI kit release date. One short mail, no drip campaign.</p>
    <form @submit.prevent="submit">
      <label class="field">Work email <input v-model="email" type="email" placeholder="you@studio.dev" /></label>
      <label class="field">WhatsApp <span style="color: var(--text-3); font-weight: 400">(optional)</span>
        <input v-model="whatsapp" inputmode="tel" placeholder="+91 98xxxxxxx" />
      </label>
      <label class="consent">
        <input v-model="consent" type="checkbox" />
        <span>You may contact me by email or WhatsApp about ForgeArc. I can opt out anytime.</span>
      </label>
      <button class="btn btn-alt btn-block" type="submit" :disabled="busy">Keep me posted</button>
      <p v-if="status" class="status">{{ status }}</p>
      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </div>
</template>
