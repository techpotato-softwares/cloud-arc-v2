<script setup lang="ts">
import { onMounted, ref } from "vue";

const props = defineProps<{ chart: string }>();
const host = ref<HTMLElement | null>(null);

onMounted(async () => {
  if (!host.value) return;
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
  const id = `mmd-${Math.random().toString(36).slice(2)}`;
  const { svg } = await mermaid.render(id, props.chart);
  host.value.innerHTML = svg;
});
</script>

<template>
  <div ref="host" class="mermaid-host"></div>
</template>
