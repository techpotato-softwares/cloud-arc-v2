<script setup>
import { ref } from "vue";

const copied = ref(false);
const command = "npx create-forgearc-app";

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

<span class="t-key">?</span> Choose a product  <span class="t-ok">ForgeArc Python</span>
<span class="t-key">?</span> Select modules   <span class="t-ok">Auth, Files, AI</span>
<span class="t-key">?</span> Cloud target     <span class="t-ok">AWS</span>

<span class="t-ok">✓</span> Source workspace created
<span class="t-ok">✓</span> Manifest and OpenAPI generated
<span class="t-ok">✓</span> CDK stack ready to synthesize</pre>
    </div>
    <button class="install-command" type="button" @click="copyCommand">
      <span>$ {{ command }}</span>
      <strong>{{ copied ? "Copied" : "Copy" }}</strong>
    </button>
  </div>
</template>
