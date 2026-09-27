<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { RouterLink, RouterView } from "vue-router";
import Icon from "./components/Icon.vue";
import PurchaseToast from "./components/PurchaseToast.vue";
import { DOCS_URL } from "./api";

const scrolled = ref(false);
const dark = ref(document.documentElement.classList.contains("dark"));

function onScroll() {
  scrolled.value = window.scrollY > 8;
}

function toggleTheme() {
  dark.value = !dark.value;
  document.documentElement.classList.toggle("dark", dark.value);
  localStorage.setItem("forgearc-theme", dark.value ? "dark" : "light");
}

onMounted(() => window.addEventListener("scroll", onScroll, { passive: true }));
onUnmounted(() => window.removeEventListener("scroll", onScroll));
</script>

<template>
  <header class="nav" :class="{ scrolled }">
    <div class="container nav-inner">
      <RouterLink class="brand" to="/">
        <img src="/logo.svg" alt="" />
        ForgeArc
      </RouterLink>
      <nav class="nav-links">
        <RouterLink class="nav-link hide-sm" to="/#products">Products</RouterLink>
        <RouterLink class="nav-link hide-sm" to="/#tour">Tour</RouterLink>
        <RouterLink class="nav-link hide-sm" to="/#code">Code</RouterLink>
        <RouterLink class="nav-link" to="/pricing">Pricing</RouterLink>
        <a class="nav-link hide-sm" :href="DOCS_URL">Docs</a>
        <button class="icon-btn" type="button" :aria-label="dark ? 'Switch to light theme' : 'Switch to dark theme'" @click="toggleTheme">
          <Icon :name="dark ? 'sun' : 'moon'" :size="18" />
        </button>
        <RouterLink class="btn btn-brand btn-sm" to="/pricing">Get the kit</RouterLink>
      </nav>
    </div>
  </header>

  <RouterView />

  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <RouterLink class="brand" to="/"><img src="/logo.svg" alt="" />ForgeArc</RouterLink>
        <p>Production-oriented source products for teams building on Node, Python, AWS, and AI.</p>
        <span>© 2026 TechPotato Softwares LLP</span>
      </div>
      <div class="footer-column">
        <strong>Products</strong>
        <RouterLink to="/#products">ForgeArc Node</RouterLink>
        <RouterLink to="/#products">ForgeArc Python</RouterLink>
        <RouterLink to="/#products">ForgeArc AI</RouterLink>
      </div>
      <div class="footer-column">
        <strong>Evaluate</strong>
        <RouterLink to="/#tour">Product tour</RouterLink>
        <RouterLink to="/pricing">Pricing</RouterLink>
        <a :href="DOCS_URL">Documentation</a>
      </div>
      <div class="footer-column">
        <strong>Contact</strong>
        <a href="mailto:hello@forgearc.dev">hello@forgearc.dev</a>
        <span>India · selling globally</span>
      </div>
    </div>
  </footer>

  <PurchaseToast />
</template>
