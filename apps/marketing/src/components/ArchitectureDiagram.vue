<script setup>
const stages = [
  { icon: "/icons/aws/api-gateway.svg", name: "API Gateway", note: "One route per manifest entry" },
  { icon: "/icons/aws/lambda.svg", name: "Module Lambda", note: "Shared runtime layer" },
  { icon: "/icons/aws/rds.svg", name: "PostgreSQL", note: "RDS on AWS, Docker locally" }
];

const services = [
  { icon: "/icons/aws/s3.svg", name: "S3" },
  { icon: "/icons/aws/secrets-manager.svg", name: "Secrets Manager" },
  { icon: "/icons/aws/sqs.svg", name: "SQS" },
  { icon: "/icons/aws/bedrock.svg", name: "Bedrock" }
];
</script>

<template>
  <figure class="diagram-card">
    <figcaption>
      <strong>AWS request path</strong>
      <span>The same handlers run locally and behind API Gateway.</span>
    </figcaption>
    <div class="diagram-flow">
      <div class="diagram-node diagram-node-app">
        <span>App</span>
        <strong>Your product</strong>
      </div>
      <template v-for="stage in stages" :key="stage.name">
        <span class="diagram-arrow" aria-hidden="true">→</span>
        <div class="diagram-node">
          <img :src="stage.icon" alt="" />
          <strong>{{ stage.name }}</strong>
          <span>{{ stage.note }}</span>
        </div>
      </template>
    </div>
    <div class="diagram-services">
      <div v-for="service in services" :key="service.name" class="diagram-service">
        <img :src="service.icon" alt="" />
        <span>{{ service.name }}</span>
      </div>
    </div>
  </figure>
</template>
