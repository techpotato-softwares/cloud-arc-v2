<script setup>
import { computed, ref } from "vue";
import { capture } from "../analytics";

const active = ref("node");
const products = {
  node: {
    name: "ForgeArc Node",
    badge: "Available",
    description: "TypeScript, Express locally, Prisma persistence, generated API contracts, and AWS CDK.",
    features: ["JWT, RBAC, modules, files", "Manifest-driven Lambda routes", "Tests and frozen pnpm lock"],
    code: `@Controller({ path: "/api/invoices" })
export class InvoiceController {
  @Post("/")
  @RequirePermission("invoice:write")
  create(@Body() input: CreateInvoiceInput) {
    return this.service.create(input);
  }
}`
  },
  python: {
    name: "ForgeArc Python",
    badge: "Available",
    description: "FastAPI, SQLAlchemy, SQLModel, Alembic, generated contracts, uv, and AWS CDK.",
    features: ["Python-native dependency injection", "Alembic-owned schema changes", "Reproducible uv workspace"],
    code: `@Controller(path="/api/invoices")
class InvoiceController:
    @Post("/")
    @RequirePermission("invoice:write")
    def create(self, body: InvoiceInput):
        return self.service.create(body)`
  },
  ai: {
    name: "ForgeArc AI",
    badge: "AWS and GCP starters available",
    description: "OpenAI locally, Bedrock on AWS, Vertex AI on GCP, tenant-scoped RAG, streaming, and Jev decisions.",
    features: ["AWS CDK or GCP Terraform", "Citations and token-cost ledger", "Typed Choice, Score, Boolean decisions"],
    code: `POST /api/ai/chat/stream
{
  "message": "Summarize this policy",
  "conversationId": "buyer-42"
}

data: {"delta":"The policy..."}
data: {"citations":[...],"usage":{"costUsd":0.002}}`
  }
};
const product = computed(() => products[active.value]);

function selectProduct(key) {
  active.value = key;
  capture("product_selected", { product: key });
}
</script>

<template>
  <div>
    <div class="product-tabs" role="tablist" aria-label="ForgeArc products">
      <button v-for="(_, key) in products" :key="key" role="tab" :aria-selected="active === key" :class="{ active: active === key }" @click="selectProduct(key)">
        {{ key === "ai" ? "AI" : key[0].toUpperCase() + key.slice(1) }}
      </button>
    </div>
    <article class="product-panel">
      <div>
        <span class="pill">{{ product.badge }}</span>
        <h3 style="font-size: 34px; margin: 18px 0 12px">{{ product.name }}</h3>
        <p class="section-copy">{{ product.description }}</p>
        <ul class="feature-list">
          <li v-for="feature in product.features" :key="feature">✓ {{ feature }}</li>
        </ul>
      </div>
      <div class="code-window"><pre><code>{{ product.code }}</code></pre></div>
    </article>
  </div>
</template>
