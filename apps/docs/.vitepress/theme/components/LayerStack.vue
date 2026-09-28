<script setup lang="ts">
const layers = [
  ["Presentation", ["REST", "SSE", "OpenAPI"]],
  ["Routing and identity", ["Decorator registry", "JWT", "RBAC", "Module gates"]],
  ["Application", ["Controllers", "Services", "Repositories"]],
  ["Intelligence", ["OpenAI", "Amazon Bedrock", "TypeSafe AI Jev"]],
  ["Retrieval", ["Loaders", "Chunking", "Embeddings", "Citations"]],
  ["Data and memory", ["Prisma", "SQLAlchemy", "Alembic", "pgvector"]],
  ["Infrastructure", ["API Gateway", "Lambda", "S3", "SQS", "RDS"]],
  ["Operations", ["Tests", "Budgets", "Audit", "DLQ alarms"]]
];
</script>

<template>
  <figure class="layer-stack">
    <div v-for="[label, items] in layers" :key="label" class="layer-row">
      <strong>{{ label }}</strong>
      <span v-for="item in items" :key="item">{{ item }}</span>
    </div>
  </figure>
</template>
