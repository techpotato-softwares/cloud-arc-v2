<script setup>
defineProps({ name: { type: String, required: true }, size: { type: Number, default: 20 } });
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-if="name === 'check'" d="M5 12.5 10 17 19 7" />
    <template v-else-if="name === 'arrow'"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></template>
    <path v-else-if="name === 'play'" d="m8 5 11 7-11 7z" />
    <template v-else-if="name === 'pause'"><path d="M9 5v14" /><path d="M15 5v14" /></template>
    <template v-else-if="name === 'quote'"><path d="M5 10h5v7H4v-5c0-4 2-6 5-7" /><path d="M15 10h5v7h-6v-5c0-4 2-6 5-7" /></template>
    <template v-else-if="name === 'shield'"><path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z" /><path d="m9 12 2 2 4-4" /></template>
    <template v-else-if="name === 'layers'"><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></template>
    <template v-else-if="name === 'bolt'"><path d="M13 3 5 14h6l-1 7 8-11h-6z" /></template>
    <template v-else-if="name === 'code'"><path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" /><path d="m14 5-4 14" /></template>
    <template v-else-if="name === 'python'"><path d="M12 3c-4 0-4 2-4 3v2h4v1H6c-2 0-3 1.5-3 4s1 4 3 4h2v-2.5C8 13 9 12 11 12h4c1.5 0 2-1 2-2V6c0-1.5-1.5-3-5-3z" /><path d="M12 21c4 0 4-2 4-3v-2h-4v-1h6c2 0 3-1.5 3-4" /></template>
    <template v-else-if="name === 'spark'"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></template>
    <template v-else-if="name === 'cloud'"><path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z" /></template>
    <template v-else-if="name === 'lock'"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></template>
    <template v-else-if="name === 'mail'"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></template>
    <template v-else-if="name === 'bag'"><path d="M6 8h12l-1 12H7z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></template>
    <template v-else-if="name === 'sun'"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></template>
    <path v-else-if="name === 'moon'" d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
    <template v-else-if="name === 'book'"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></template>
  </svg>
</template>
