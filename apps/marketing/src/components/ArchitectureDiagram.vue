<script setup>
import { computed } from "vue";

const props = defineProps({
  cloud: { type: String, default: "aws" }
});
const emit = defineEmits(["update:cloud"]);

const diagrams = {
  aws: {
    title: "AWS production path",
    caption: "Choose scale-to-zero Lambda or always-on Fargate; both use the same durable repository.",
    stages: [
      { icon: "/icons/aws/api-gateway.svg", name: "API Gateway", note: "HTTPS + Cognito JWT" },
      { icon: "/icons/aws/lambda.svg", name: "Lambda or Fargate", note: "Serverless or always-on" },
      { icon: "/icons/aws/rds.svg", name: "Aurora pgvector", note: "Durable runs and retrieval" }
    ],
    services: [
      { mark: "ID", name: "Cognito" },
      { icon: "/icons/aws/s3.svg", name: "S3" },
      { icon: "/icons/aws/secrets-manager.svg", name: "Secrets Manager" },
      { icon: "/icons/aws/sqs.svg", name: "SQS" },
      { icon: "/icons/aws/bedrock.svg", name: "Bedrock" }
    ]
  },
  gcp: {
    title: "GCP production path",
    caption: "Cloud Run can scale to zero or stay warm; AlloyDB keeps approvals safe across restarts.",
    stages: [
      { icon: "/icons/gcp/cloud-run.svg", name: "Cloud Run", note: "Serverless or always-on" },
      { icon: "/icons/gcp/vertex-ai.svg", name: "Vertex AI", note: "Chat and embeddings" },
      { icon: "/icons/gcp/alloydb.svg", name: "AlloyDB pgvector", note: "Durable runs and retrieval" }
    ],
    services: [
      { mark: "ID", name: "Identity Platform" },
      { icon: "/icons/gcp/cloud-storage.svg", name: "Cloud Storage" },
      { mark: "PS", name: "Pub/Sub" },
      { mark: "FS", name: "Firestore" },
      { mark: "SM", name: "Secret Manager" }
    ]
  }
};

const diagram = computed(() => diagrams[props.cloud] || diagrams.aws);

function select(cloud) {
  emit("update:cloud", cloud);
}
</script>

<template>
  <figure class="diagram-card">
    <div class="diagram-head">
      <div class="diagram-caption">
        <strong>{{ diagram.title }}</strong>
        <span>{{ diagram.caption }}</span>
      </div>
      <div class="cloud-switch" role="tablist" aria-label="Cloud architecture">
        <button type="button" role="tab" :aria-selected="cloud === 'aws'" :class="{ active: cloud === 'aws' }" @click="select('aws')">AWS</button>
        <button type="button" role="tab" :aria-selected="cloud === 'gcp'" :class="{ active: cloud === 'gcp' }" @click="select('gcp')">GCP</button>
      </div>
    </div>
    <Transition name="scene" mode="out-in">
      <div :key="cloud">
        <div class="diagram-flow">
          <div class="diagram-node diagram-node-app">
            <span>App</span>
            <strong>Your product</strong>
          </div>
          <template v-for="stage in diagram.stages" :key="stage.name">
            <span class="diagram-arrow" aria-hidden="true">→</span>
            <div class="diagram-node">
              <img :src="stage.icon" :alt="stage.name" />
              <strong>{{ stage.name }}</strong>
              <span>{{ stage.note }}</span>
            </div>
          </template>
        </div>
        <div class="diagram-services">
          <div v-for="service in diagram.services" :key="service.name" class="diagram-service">
            <img v-if="service.icon" :src="service.icon" :alt="service.name" />
            <span v-else class="diagram-mark" aria-hidden="true">{{ service.mark }}</span>
            <span>{{ service.name }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </figure>
</template>
