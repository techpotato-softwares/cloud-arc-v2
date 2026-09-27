import { createRouter, createWebHistory } from "vue-router";
import Home from "./views/Home.vue";
import Pricing from "./views/Pricing.vue";
import Checkout from "./views/Checkout.vue";
import TestCheckout from "./views/TestCheckout.vue";
import Thanks from "./views/Thanks.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/pricing", component: Pricing },
    { path: "/checkout", component: Checkout },
    { path: "/checkout/test", component: TestCheckout },
    { path: "/thanks", component: Thanks }
  ],
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, top: 72, behavior: "smooth" };
    return { top: 0 };
  }
});
