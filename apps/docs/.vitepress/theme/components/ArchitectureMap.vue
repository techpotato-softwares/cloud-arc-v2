<script setup lang="ts">
type NodeSpec = { id: string; label: string; group: string; mark: string; note: string; icon?: string };
type Lane = { label: string; nodes: string[] };

const catalog: Record<string, NodeSpec> = {
  client: { id: "client", label: "Client", group: "App", mark: "client", note: "SPA or curl" },
  express: { id: "express", label: "Express", group: "Local", mark: "api", note: "Port 4000" },
  fastapi: { id: "fastapi", label: "FastAPI", group: "Local", mark: "api", note: "Port 4001" },
  apigw: { id: "apigw", label: "API Gateway", group: "AWS", mark: "gateway", note: "One route per manifest entry", icon: "/icons/aws/api-gateway.svg" },
  lambda: { id: "lambda", label: "Module Lambda", group: "AWS", mark: "lambda", note: "Shared layer attached", icon: "/icons/aws/lambda.svg" },
  router: { id: "router", label: "Router", group: "Shared layer", mark: "gateway", note: "Method + path match" },
  auth: { id: "auth", label: "JWT gate", group: "Shared layer", mark: "lock", note: "Then permission and module" },
  csr: { id: "csr", label: "Controller", group: "Module", mark: "api", note: "Service, then repository" },
  rds: { id: "rds", label: "PostgreSQL", group: "Data", mark: "db", note: "RDS in AWS, Docker locally", icon: "/icons/aws/rds.svg" },
  s3: { id: "s3", label: "S3", group: "AWS", mark: "bucket", note: "Presigned upload and download", icon: "/icons/aws/s3.svg" },
  secrets: { id: "secrets", label: "Secrets Manager", group: "AWS", mark: "lock", note: "JWT and database", icon: "/icons/aws/secrets-manager.svg" },
  sqs: { id: "sqs", label: "SQS", group: "AWS", mark: "queue", note: "Ingestion jobs", icon: "/icons/aws/sqs.svg" },
  bedrock: { id: "bedrock", label: "Bedrock", group: "AWS", mark: "model", note: "Chat and embeddings", icon: "/icons/aws/bedrock.svg" },
  worker: { id: "worker", label: "Worker Lambda", group: "AWS", mark: "lambda", note: "Chunk and embed", icon: "/icons/aws/lambda.svg" },
  run: { id: "run", label: "Cloud Run", group: "GCP", mark: "run", note: "API and workers", icon: "/icons/gcp/cloud-run.svg" },
  gcs: { id: "gcs", label: "Cloud Storage", group: "GCP", mark: "bucket", note: "Source documents", icon: "/icons/gcp/cloud-storage.svg" },
  pubsub: { id: "pubsub", label: "Pub/Sub", group: "GCP", mark: "queue", note: "Ingestion jobs" },
  firestore: { id: "firestore", label: "Firestore", group: "GCP", mark: "db", note: "Job status" },
  secretmgr: { id: "secretmgr", label: "Secret Manager", group: "GCP", mark: "lock", note: "Provider credentials" },
  alloydb: { id: "alloydb", label: "AlloyDB", group: "GCP", mark: "db", note: "pgvector retrieval", icon: "/icons/gcp/alloydb.svg" },
  vertex: { id: "vertex", label: "Vertex AI", group: "GCP", mark: "model", note: "Gemini and embeddings", icon: "/icons/gcp/vertex-ai.svg" }
};

const layouts: Record<string, { caption: string; lanes: Lane[] }> = {
  "node-aws": {
    caption: "Local Express and AWS API Gateway both call the same Node handlers.",
    lanes: [
      { label: "Caller", nodes: ["client"] },
      { label: "Edge", nodes: ["express", "apigw"] },
      { label: "Compute", nodes: ["lambda"] },
      { label: "Inside the handler", nodes: ["router", "auth", "csr"] },
      { label: "State", nodes: ["rds", "s3", "secrets"] }
    ]
  },
  "python-aws": {
    caption: "Local FastAPI and AWS API Gateway both call the same Python handlers.",
    lanes: [
      { label: "Caller", nodes: ["client"] },
      { label: "Edge", nodes: ["fastapi", "apigw"] },
      { label: "Compute", nodes: ["lambda"] },
      { label: "Inside the handler", nodes: ["router", "auth", "csr"] },
      { label: "State", nodes: ["rds", "s3", "secrets"] }
    ]
  },
  "ai-aws": {
    caption: "Short chat stays on the API Lambda. Document work is queued.",
    lanes: [
      { label: "Caller", nodes: ["client"] },
      { label: "Edge", nodes: ["apigw"] },
      { label: "API", nodes: ["lambda", "bedrock"] },
      { label: "Async", nodes: ["sqs", "worker"] },
      { label: "State", nodes: ["s3", "rds"] }
    ]
  },
  "ai-gcp": {
    caption: "The same application interfaces, with GCP products behind the adapter.",
    lanes: [
      { label: "Caller", nodes: ["client"] },
      { label: "API", nodes: ["run", "vertex"] },
      { label: "Async", nodes: ["pubsub"] },
      { label: "State", nodes: ["gcs", "firestore", "alloydb", "secretmgr"] }
    ]
  }
};

const props = defineProps<{ title: string; preset: string }>();
const layout = layouts[props.preset] || { caption: "", lanes: [] };

function node(id: string): NodeSpec {
  return catalog[id];
}
</script>

<template>
  <figure class="arch-figure">
    <figcaption>
      <strong>{{ title }}</strong>
      <span>{{ layout.caption }}</span>
    </figcaption>
    <div class="arch-flow">
      <template v-for="(lane, index) in layout.lanes" :key="lane.label">
        <div class="arch-lane">
          <p class="arch-lane-label">{{ lane.label }}</p>
          <article v-for="id in lane.nodes" :key="id" class="arch-node">
            <img v-if="node(id).icon" class="arch-official-icon" :src="node(id).icon" alt="" />
            <svg v-else viewBox="0 0 64 64" aria-hidden="true">
              <rect width="64" height="64" rx="14" class="arch-tile" />
              <g v-if="node(id).mark === 'gateway'" fill="none" stroke="currentColor" stroke-width="3">
                <rect x="14" y="18" width="36" height="28" rx="6" />
                <path d="M22 32h20M32 22v20" />
              </g>
              <g v-else-if="node(id).mark === 'lambda'" fill="currentColor">
                <path d="M18 46 30 16h8L26 46z" />
              </g>
              <g v-else-if="node(id).mark === 'bucket'" fill="currentColor">
                <path d="M16 24c0-6 32-6 32 0v22c0 6-32 6-32 0z" opacity="0.9" />
                <ellipse cx="32" cy="24" rx="16" ry="5" opacity="0.45" />
              </g>
              <g v-else-if="node(id).mark === 'queue'" fill="none" stroke="currentColor" stroke-width="3">
                <rect x="12" y="18" width="40" height="10" rx="3" />
                <rect x="12" y="32" width="40" height="10" rx="3" />
              </g>
              <g v-else-if="node(id).mark === 'db'" fill="none" stroke="currentColor" stroke-width="3">
                <ellipse cx="32" cy="20" rx="14" ry="6" />
                <path d="M18 20v24c0 4 14 6 14 6s14-2 14-6V20" />
              </g>
              <g v-else-if="node(id).mark === 'model'" fill="none" stroke="currentColor" stroke-width="3">
                <circle cx="24" cy="24" r="5" />
                <circle cx="42" cy="22" r="5" />
                <circle cx="33" cy="42" r="5" />
                <path d="M28 27 31 37M38 26l-3 11" />
              </g>
              <g v-else-if="node(id).mark === 'lock'" fill="none" stroke="currentColor" stroke-width="3">
                <rect x="20" y="28" width="24" height="18" rx="3" />
                <path d="M26 28v-6a6 6 0 0 1 12 0v6" />
              </g>
              <g v-else-if="node(id).mark === 'run'" fill="none" stroke="currentColor" stroke-width="3">
                <circle cx="32" cy="32" r="14" />
                <path d="M28 24v16l12-8z" fill="currentColor" stroke="none" />
              </g>
              <g v-else fill="none" stroke="currentColor" stroke-width="3">
                <rect x="16" y="16" width="32" height="32" rx="6" />
              </g>
            </svg>
            <div>
              <strong>{{ node(id).label }}</strong>
              <span>{{ node(id).note }}</span>
            </div>
          </article>
        </div>
        <div v-if="index < layout.lanes.length - 1" class="arch-join" aria-hidden="true">→</div>
      </template>
    </div>
  </figure>
</template>
