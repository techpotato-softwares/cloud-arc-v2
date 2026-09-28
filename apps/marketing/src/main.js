import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { capture } from "./analytics";
import "./styles.css";

const observer = typeof IntersectionObserver === "undefined"
  ? null
  : new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            if (entry.target.id) capture("funnel_section_viewed", { section: entry.target.id });
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 }
    );

createApp(App)
  .use(router)
  .directive("reveal", {
    mounted(el) {
      el.classList.add("reveal");
      if (observer) observer.observe(el);
      else el.classList.add("visible");
    },
    unmounted(el) {
      observer?.unobserve(el);
    }
  })
  .mount("#app");

document.addEventListener("click", (event) => {
  const cta = event.target.closest("a.btn, button.btn");
  if (!cta) return;
  capture("cta_clicked", {
    label: cta.textContent.trim().replace(/\s+/g, " ").slice(0, 80),
    destination: cta.getAttribute("href") || undefined
  });
});
