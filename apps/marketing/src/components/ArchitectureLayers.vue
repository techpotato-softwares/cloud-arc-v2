<script setup>
const layers = [
  ["Presentation", ["REST", "SSE", "OpenAPI"]],
  ["Routing & identity", ["Decorator routes", "JWT", "RBAC", "Module gates"]],
  ["Application", ["Controllers", "Services", "Repositories"]],
  ["Intelligence", ["OpenAI", "Bedrock", "Jev decisions"]],
  ["Retrieval", ["Loaders", "Chunking", "Embeddings", "Citations"]],
  ["Data & memory", ["Prisma", "SQLAlchemy", "Alembic", "pgvector"]],
  ["Infrastructure", ["API Gateway", "Lambda", "S3", "SQS", "RDS"]],
  ["Operations", ["Tests", "Budgets", "Audit", "DLQ alarms"]]
];
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
