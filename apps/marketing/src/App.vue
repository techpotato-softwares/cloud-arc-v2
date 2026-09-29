<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import Icon from "./components/Icon.vue";
import AnalyticsConsent from "./components/AnalyticsConsent.vue";
import PurchaseToast from "./components/PurchaseToast.vue";
import { DOCS_URL } from "./api";

const scrolled = ref(false);
const dark = ref(document.documentElement.classList.contains("dark"));
const menuOpen = ref(false);
const menuButton = ref(null);
const route = useRoute();

function onScroll() {
  scrolled.value = window.scrollY > 8;
}

function toggleTheme() {
  dark.value = !dark.value;
  document.documentElement.classList.toggle("dark", dark.value);
  localStorage.setItem("forgearc-theme", dark.value ? "dark" : "light");
}

function closeMenu(restoreFocus = false) {
  menuOpen.value = false;
  if (restoreFocus) nextTick(() => menuButton.value?.focus());
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function onKeydown(event) {
  if (event.key === "Escape" && menuOpen.value) closeMenu(true);
  if (event.key !== "Tab" || !menuOpen.value) return;

  const focusable = [...document.querySelectorAll("#primary-navigation a, #primary-navigation button, .menu-toggle")]
    .filter((element) => element.offsetParent !== null);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

watch(() => route.fullPath, () => closeMenu());
watch(menuOpen, (open) => {
  document.body.classList.toggle("menu-open", open);
  if (open) nextTick(() => document.querySelector("#primary-navigation a")?.focus());
});
onMounted(() => {
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("keydown", onKeydown);
});
onUnmounted(() => {
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("keydown", onKeydown);
  document.body.classList.remove("menu-open");
});
</script>

<template>
  <header class="nav" :class="{ scrolled }">
    <div class="container nav-inner">
      <RouterLink class="brand" to="/">
        <img src="/logo.svg" alt="" />
        ForgeArc
      </RouterLink>
      <nav id="primary-navigation" class="nav-links" :class="{ open: menuOpen }" aria-label="Primary">
        <RouterLink class="nav-link" to="/#products">Products</RouterLink>
        <RouterLink class="nav-link" to="/#architecture">Architecture</RouterLink>
        <RouterLink class="nav-link" to="/pricing">Pricing</RouterLink>
        <RouterLink class="nav-link" to="/#faq">FAQ</RouterLink>
        <a class="nav-link" href="https://techpotato.in">Blog</a>
        <a class="nav-link" :href="DOCS_URL">Docs</a>
        <button class="icon-btn" type="button" :aria-label="dark ? 'Switch to light theme' : 'Switch to dark theme'" @click="toggleTheme">
          <Icon :name="dark ? 'sun' : 'moon'" :size="18" />
        </button>
        <RouterLink class="btn btn-brand btn-sm" to="/pricing">Get the kit</RouterLink>
      </nav>
      <button
        ref="menuButton"
        class="menu-toggle"
        type="button"
        :aria-expanded="menuOpen"
        aria-controls="primary-navigation"
        :aria-label="menuOpen ? 'Close navigation' : 'Open navigation'"
        @click="toggleMenu"
      >
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>

  <RouterView />

  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <RouterLink class="brand" to="/"><img src="/logo.svg" alt="" />ForgeArc</RouterLink>
        <p>Production-oriented source products for teams building on Node, Python, AWS, GCP, and AI.</p>
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
  <AnalyticsConsent />
</template>
