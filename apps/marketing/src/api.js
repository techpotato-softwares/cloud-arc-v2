import catalogSnapshot from "./catalog.json";

export let DOCS_URL = import.meta.env.VITE_DOCS_URL || "http://127.0.0.1:4174";

export async function loadRuntimeConfig() {
  try {
    const response = await fetch("/runtime-config.json", { cache: "no-store" });
    if (!response.ok) return;
    const config = await response.json();
    if (config.docsUrl) DOCS_URL = config.docsUrl;
  } catch {
    // Local development has no deployed runtime config.
  }
}

export async function getCatalog() {
  try {
    const response = await fetch("/api/catalog");
    if (response.ok) {
      const payload = await response.json();
      if (payload.plans?.length) return payload;
    }
  } catch {
    // The published catalog remains visible when checkout is offline.
  }
  return catalogSnapshot;
}

export async function createLead(body) {
  const response = await fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error("Could not save your details");
  return response.json();
}

export async function startCheckout(body) {
  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail || "Checkout failed");
  return payload;
}

export async function simulateCheckout(body) {
  const response = await fetch("/api/checkout/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail || "Test payment failed");
  return payload;
}

export async function getOrder(orderId) {
  const response = await fetch(`/api/orders/${orderId}`);
  if (!response.ok) throw new Error("Order not found");
  return response.json();
}

export async function recentPurchases() {
  const response = await fetch("/api/purchases/recent");
  if (!response.ok) return { purchases: [] };
  return response.json();
}

export function money(plan, country) {
  if (country === "IN") return `₹${plan.priceInr.toLocaleString("en-IN")}`;
  return `$${plan.priceUsd.toLocaleString("en-US")}`;
}
