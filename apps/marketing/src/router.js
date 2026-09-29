import { createRouter, createWebHistory } from "vue-router";
import Home from "./views/Home.vue";
import Pricing from "./views/Pricing.vue";
import Checkout from "./views/Checkout.vue";
import TestCheckout from "./views/TestCheckout.vue";
import RazorpayCheckout from "./views/RazorpayCheckout.vue";
import Thanks from "./views/Thanks.vue";
import { trackPageView } from "./analytics";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: Home,
      meta: {
        title: "ForgeArc — Production Backend Source Kits for Node and Python",
        description: "Own production-oriented Node, Python, and AI source kits with auth, modular architecture, OpenAPI, tests, AWS CDK, and GCP Terraform."
      }
    },
    {
      path: "/pricing",
      component: Pricing,
      meta: {
        title: "Pricing — ForgeArc",
        description: "Compare ForgeArc Node, Python, and AI source-kit licenses in INR or USD, with clear modules, updates, and entitlements."
      }
    },
    { path: "/checkout", component: Checkout, meta: { title: "Secure checkout — ForgeArc", noindex: true } },
    { path: "/checkout/test", component: TestCheckout, meta: { title: "Checkout test — ForgeArc", noindex: true } },
    { path: "/checkout/razorpay", component: RazorpayCheckout, meta: { title: "Razorpay checkout — ForgeArc", noindex: true } },
    { path: "/thanks", component: Thanks, meta: { title: "Purchase received — ForgeArc", noindex: true } }
  ],
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, top: 72, behavior: "smooth" };
    return { top: 0 };
  }
});

router.afterEach((to) => {
  document.title = to.meta.title || "ForgeArc";

  const setMeta = (selector, content) => {
    const element = document.querySelector(selector);
    if (element && content) element.setAttribute("content", content);
  };
  setMeta('meta[name="description"]', to.meta.description);
  setMeta('meta[property="og:title"]', to.meta.title);
  setMeta('meta[property="og:description"]', to.meta.description);
  setMeta('meta[property="og:url"]', new URL(to.path, "https://forgearc.dev").href);
  setMeta('meta[name="twitter:title"]', to.meta.title);
  setMeta('meta[name="twitter:description"]', to.meta.description);

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", new URL(to.path, "https://forgearc.dev").href);

  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement("meta");
    robots.setAttribute("name", "robots");
    document.head.appendChild(robots);
  }
  robots.setAttribute("content", to.meta.noindex ? "noindex, nofollow" : "index, follow");
  trackPageView();
});
