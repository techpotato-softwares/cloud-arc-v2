<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import Icon from "./Icon.vue";

const scenes = [
  {
    label: "01 · Add a capability",
    title: "A module owns the feature",
    body: "Controller, service, repository, schemas, and Lambda entrypoint stay together.",
    code: "modules/invoices/\n├── controllers\n├── services\n├── repositories\n└── lambdas"
  },
  {
    label: "02 · Generate contracts",
    title: "Routes become metadata",
    body: "The build imports registrations and writes the deployment manifest and OpenAPI document.",
    code: "✓ 5 modules discovered\n✓ 9 Lambda handlers\n✓ 31 routes\n✓ openapi.yaml written"
  },
  {
    label: "03 · Verify the product",
    title: "One command checks the workspace",
    body: "Types, tests, product builds, documentation, and marketing run through governed tasks.",
    code: "$ pnpm check\n✓ lint\n✓ typecheck\n✓ tests\n✓ build"
  },
  {
    label: "04 · Deploy to your account",
    title: "CDK consumes the same manifest",
    body: "API Gateway, Lambda, permissions, secrets, storage, and database resources stay reproducible.",
    code: "$ pnpm synth\n✓ ApiStack-dev\n✓ assets staged\n✓ template generated"
  }
];

const active = ref(0);
const playing = ref(true);
let timer;

const scene = computed(() => scenes[active.value]);

function next() {
  active.value = (active.value + 1) % scenes.length;
}

function start() {
  clearInterval(timer);
  if (playing.value) timer = setInterval(next, 3600);
}

function toggle() {
  playing.value = !playing.value;
  start();
}

function select(index) {
  active.value = index;
  start();
}

onMounted(start);
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="tour-player">
    <div class="tour-player-bar">
      <span class="window-dots"><i></i><i></i><i></i></span>
      <span>ForgeArc product tour</span>
      <button type="button" :aria-label="playing ? 'Pause product tour' : 'Play product tour'" @click="toggle">
        <Icon :name="playing ? 'pause' : 'play'" :size="15" />
      </button>
    </div>
    <div class="tour-screen">
      <Transition name="scene" mode="out-in">
        <div :key="active" class="tour-scene">
          <span>{{ scene.label }}</span>
          <h3>{{ scene.title }}</h3>
          <p>{{ scene.body }}</p>
          <pre>{{ scene.code }}</pre>
        </div>
      </Transition>
    </div>
    <div class="tour-controls">
      <button
        v-for="(_, index) in scenes"
        :key="index"
        type="button"
        :class="{ active: active === index }"
        :aria-label="`Show tour step ${index + 1}`"
        @click="select(index)"
      >
        <span :class="{ running: active === index && playing }"></span>
      </button>
    </div>
  </div>
</template>
