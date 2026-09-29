<script setup>
import { computed } from "vue";

const props = defineProps({
  cloud: { type: String, default: "aws" }
});

const layers = computed(() => [
  ["Presentation", ["REST", "SSE", "OpenAPI"]],
  ["Routing & identity", ["Decorator routes", "JWT", "RBAC", "Module gates"]],
  ["Application", ["Controllers", "Services", "Repositories"]],
  ["Intelligence", props.cloud === "gcp" ? ["OpenAI", "Vertex AI", "Jev decisions"] : ["OpenAI", "Bedrock", "Jev decisions"]],
  ["Retrieval", ["Loaders", "Chunking", "Embeddings", "Citations"]],
  ["Data & memory", ["Prisma", "SQLAlchemy", "Alembic", "pgvector"]],
  [
    "Infrastructure",
    props.cloud === "gcp"
      ? ["Cloud Run", "Cloud Storage", "Pub/Sub", "Firestore", "AlloyDB", "Terraform"]
      : ["API Gateway", "Lambda", "S3", "SQS", "RDS", "CDK"]
  ],
  ["Operations", ["Tests", "Budgets", "Audit", "Dead-letter jobs"]]
]);
</script>

<template>
  <div class="architecture-stack" aria-label="ForgeArc architecture layers">
    <div v-for="[label, items] in layers" :key="label" class="architecture-layer">
      <strong>{{ label }}</strong>
      <div class="architecture-chips">
        <span v-for="item in items" :key="item" class="architecture-chip">{{ item }}</span>
      </div>
    </div>
  </div>
</template>
