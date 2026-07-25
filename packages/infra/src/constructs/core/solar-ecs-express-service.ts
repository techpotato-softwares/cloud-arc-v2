/**
 * L3 construct stub — Amazon ECS Express Mode for always-on Fastify services.
 * Replaces App Runner (closed to new AWS customers).
 *
 * Targets: auth, invoicing, mobile-api, ai-service (see api/containers/).
 */
export interface SolarEcsExpressServiceProps {
  serviceName: string;
  imageRepository: string;
  cpu?: number;
  memoryMiB?: number;
  healthCheckPath?: string;
  port?: number;
}

export class SolarEcsExpressService {
  constructor(_scope: unknown, _id: string, _props: SolarEcsExpressServiceProps) {
    // Phase 2: wire aws-cdk-lib ecs patterns + ALB from cdk/lib/constructs
  }
}
