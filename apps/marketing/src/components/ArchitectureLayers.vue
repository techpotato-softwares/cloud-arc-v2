<script setup>
import { computed } from "vue";

const props = defineProps({
  cloud: { type: String, default: "aws" }
});

const layers = computed(() => [
  ["Presentation", ["REST", "SSE", "OpenAPI"]],
  ["Routing & identity", props.cloud === "gcp" ? ["Decorator routes", "Identity Platform", "OIDC", "RBAC"] : ["Decorator routes", "Cognito", "OIDC", "RBAC"]],
  ["Application", ["Controllers", "Services", "Repositories"]],
  ["Intelligence", props.cloud === "gcp" ? ["OpenAI", "Vertex AI", "Jev decisions"] : ["OpenAI", "Bedrock", "Jev decisions"]],
  ["Retrieval", ["Loaders", "Chunking", "Embeddings", "Citations"]],
  ["Durable data", props.cloud === "gcp" ? ["AlloyDB", "SQLAlchemy", "Alembic", "pgvector"] : ["Aurora Serverless v2", "SQLAlchemy", "Alembic", "pgvector"]],
  [
    "Infrastructure",
    props.cloud === "gcp"
      ? ["Cloud Run scale-to-zero", "Cloud Run always-on", "Cloud Storage", "Pub/Sub", "Terraform"]
      : ["API Gateway", "Lambda", "ECS Fargate", "S3", "SQS", "CDK"]
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
