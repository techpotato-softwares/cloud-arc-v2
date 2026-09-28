<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

const props = defineProps<{ chart: string }>();
const host = ref<HTMLElement | null>(null);
let observer: MutationObserver | undefined;
let dark = false;

async function draw() {
  if (!host.value) return;
  const mermaid = (await import("mermaid")).default;
  const isDark = document.documentElement.classList.contains("dark");
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: isDark ? "base" : "neutral",
    themeVariables: isDark
      ? {
          darkMode: true,
          background: "transparent",
          primaryColor: "#2c2824",
          primaryTextColor: "#f2efe9",
          primaryBorderColor: "#6b5344",
          lineColor: "#f2c14e",
          secondaryColor: "#232329",
          tertiaryColor: "#1b1b1f",
          textColor: "#f2efe9",
          nodeTextColor: "#f2efe9",
          mainBkg: "#2c2824",
          clusterBkg: "#232329",
          titleColor: "#f2efe9",
          edgeLabelBackground: "#232329"
        }
      : {}
  });
  const id = `mmd-${Math.random().toString(36).slice(2)}`;
  const { svg } = await mermaid.render(id, props.chart);
  host.value.innerHTML = svg;
}

onMounted(() => {
  dark = document.documentElement.classList.contains("dark");
  draw();
  observer = new MutationObserver(() => {
    const next = document.documentElement.classList.contains("dark");
    if (next === dark) return;
    dark = next;
    draw();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
});

onUnmounted(() => observer?.disconnect());
</script>

<template>
  <div ref="host" class="mermaid-host"></div>
</template>
