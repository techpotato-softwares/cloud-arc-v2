import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { CfnOutput, Duration } from "aws-cdk-lib";
import { EnvironmentConfig } from "../../config/environment";
import { AppManifest, RouteManifestEntry } from "../../utils/manifest-reader";

export interface ApiGatewayConstructProps {
  config: EnvironmentConfig;
  lambdaFunctions: Record<string, lambda.Function>;
  manifest: AppManifest;
}

// CORS headers for Gateway Responses (errors from API Gateway itself)
const CORS_RESPONSE_HEADERS: { [key: string]: string } = {
  "Access-Control-Allow-Origin": "'*'",
  "Access-Control-Allow-Headers":
    "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
  "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
};

export class ApiGatewayConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
    super(scope, id);

    const { config, lambdaFunctions, manifest } = props;

    // Create REST API
    this.api = new apigateway.RestApi(this, "ArcForgeApi", {
      restApiName: `arcforge-api-${config.environment}`,
      description: config.description,
      deployOptions: {
        stageName: config.apiStageName,
        tracingEnabled: config.enableXRay,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "Authorization",
          "X-Amz-Date",
          "X-Api-Key",
          "X-Amz-Security-Token",
        ],
        maxAge: Duration.days(1),
      },
    });

    // Add CORS headers to Gateway Responses (for errors from API Gateway itself)
    // These errors happen before reaching Lambda and need CORS headers
    this.addGatewayResponses();

    // Create routes from manifest
    this.createRoutesFromManifest(manifest, lambdaFunctions);

    // Output the API URL
    new CfnOutput(this, "ApiUrl", {
      value: this.api.url,
      description: `API Gateway URL for ${config.environment}`,
      exportName: `ArcForgeApiUrl-${config.environment}`,
    });
  }

  /**
   * Add CORS headers to all Gateway Response types
   * This ensures CORS headers are included even when API Gateway returns errors
   * (e.g., 4XX client errors, 5XX server errors, missing auth, etc.)
   */
  private addGatewayResponses(): void {
    // Default 4XX (client errors)
    this.api.addGatewayResponse("Default4XX", {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: CORS_RESPONSE_HEADERS,
    });

    // Default 5XX (server errors)
    this.api.addGatewayResponse("Default5XX", {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: CORS_RESPONSE_HEADERS,
    });

    // Access Denied (403)
    this.api.addGatewayResponse("AccessDenied", {
      type: apigateway.ResponseType.ACCESS_DENIED,
      responseHeaders: CORS_RESPONSE_HEADERS,
    });

    // Unauthorized (401)
    this.api.addGatewayResponse("Unauthorized", {
      type: apigateway.ResponseType.UNAUTHORIZED,
      responseHeaders: CORS_RESPONSE_HEADERS,
    });

    // Expired Token
    this.api.addGatewayResponse("ExpiredToken", {
      type: apigateway.ResponseType.EXPIRED_TOKEN,
      responseHeaders: CORS_RESPONSE_HEADERS,
    });

    // Missing Auth Token
    this.api.addGatewayResponse("MissingAuthToken", {
      type: apigateway.ResponseType.MISSING_AUTHENTICATION_TOKEN,
      responseHeaders: CORS_RESPONSE_HEADERS,
    });

    // Invalid API Key
    this.api.addGatewayResponse("InvalidApiKey", {
      type: apigateway.ResponseType.INVALID_API_KEY,
      responseHeaders: CORS_RESPONSE_HEADERS,
    });

    // Throttled (429)
    this.api.addGatewayResponse("Throttled", {
      type: apigateway.ResponseType.THROTTLED,
      responseHeaders: CORS_RESPONSE_HEADERS,
    });

    // Quota Exceeded
    this.api.addGatewayResponse("QuotaExceeded", {
      type: apigateway.ResponseType.QUOTA_EXCEEDED,
      responseHeaders: CORS_RESPONSE_HEADERS,
    });

    console.log("   ✅ Added CORS headers to Gateway Responses");
  }

  /**
   * Create API Gateway routes from the app manifest
   */
  private createRoutesFromManifest(
    manifest: AppManifest,
    lambdaFunctions: Record<string, lambda.Function>,
  ): void {
    // Track created resources to avoid duplicates
    const resourceCache: Map<string, apigateway.IResource> = new Map();
    resourceCache.set("", this.api.root);

    for (const [lambdaName, lambdaConfig] of Object.entries(manifest.lambdas)) {
      const lambdaFunction = lambdaFunctions[lambdaName];

      if (!lambdaFunction) {
        console.warn(
          `⚠️  Lambda function '${lambdaName}' not found, skipping routes`,
        );
        continue;
      }

      const integration = new apigateway.LambdaIntegration(lambdaFunction);

      for (const route of lambdaConfig.routes) {
        this.addRoute(route, integration, resourceCache);
      }
    }

    console.log(`   Created ${resourceCache.size - 1} API resources`);
  }

  /**
   * Add a single route to API Gateway
   */
  private addRoute(
    route: RouteManifestEntry,
    integration: apigateway.LambdaIntegration,
    resourceCache: Map<string, apigateway.IResource>,
  ): void {
    // Get or create the resource for this path
    const resource = this.getOrCreateResource(route.path, resourceCache);

    // Add the method
    resource.addMethod(route.method, integration);

    console.log(
      `   ${route.method.padEnd(7)} ${route.path} → ${route.controller}.${route.action}()`,
    );
  }

  /**
   * Get or create a resource for a path
   */
  private getOrCreateResource(
    path: string,
    resourceCache: Map<string, apigateway.IResource>,
  ): apigateway.IResource {
    // Normalize path
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    // Check cache
    if (resourceCache.has(normalizedPath)) {
      return resourceCache.get(normalizedPath)!;
    }

    // Split path into segments
    const segments = normalizedPath.split("/").filter(Boolean);

    let currentResource: apigateway.IResource = this.api.root;
    let currentPath = "";

    for (const segment of segments) {
      currentPath = `${currentPath}/${segment}`;

      if (resourceCache.has(currentPath)) {
        currentResource = resourceCache.get(currentPath)!;
      } else {
        // Create new resource
        currentResource = currentResource.addResource(segment);
        resourceCache.set(currentPath, currentResource);
      }
    }

    return currentResource;
  }
}
