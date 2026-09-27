import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import "./styles.css";

const observer = typeof IntersectionObserver === "undefined"
  ? null
  : new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
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
