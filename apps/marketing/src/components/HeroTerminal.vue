<script setup>
import { computed, ref } from "vue";

const copied = ref(false);
const cloud = ref("aws");
const command = "npx create-forgearc-app";
const finish = computed(() =>
  cloud.value === "gcp"
    ? "Terraform stack ready to validate"
    : "CDK stack ready to synthesize"
);

async function copyCommand() {
  await navigator.clipboard?.writeText(command);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1600);
}
</script>

<template>
  <div>
    <div class="terminal" aria-label="ForgeArc installation preview">
      <div class="terminal-bar"><i></i><i></i><i></i></div>
      <pre><span class="t-dim">$</span> npx create-forgearc-app

<span class="t-key">?</span> Choose a product  <span class="t-ok">ForgeArc AI</span>
<span class="t-key">?</span> Select modules   <span class="t-ok">Auth, Files, AI</span>
<span class="t-key">?</span> Cloud target     <span class="cloud-choices"><button type="button" :class="{ chosen: cloud === 'aws' }" @click="cloud = 'aws'">AWS</button><button type="button" :class="{ chosen: cloud === 'gcp' }" @click="cloud = 'gcp'">GCP</button></span>

<span class="t-ok">✓</span> Source workspace created
<span class="t-ok">✓</span> Manifest and OpenAPI generated
<span class="t-ok">✓</span> {{ finish }}</pre>
    </div>
    <button class="install-command" type="button" @click="copyCommand">
      <span>$ {{ command }}</span>
      <strong>{{ copied ? "Copied" : "Copy" }}</strong>
    </button>
  </div>
</template>
