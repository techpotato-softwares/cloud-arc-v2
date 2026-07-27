import 'reflect-metadata';
import {
  METADATA_KEYS,
  ControllerMetadata,
  RouteMetadata,
  ParamMetadata,
  RouteManifestEntry,
  LambdaManifestEntry,
  AppManifest,
} from './metadata';

// Global registry to track all registered controllers
class RouteRegistry {
  private controllers: Map<string, Function> = new Map();

  /**
   * Register a controller class
   */
  registerController(name: string, controller: Function): void {
    this.controllers.set(name, controller);
  }

  /**
   * Get all registered controllers
   */
  getControllers(): Map<string, Function> {
    return this.controllers;
  }

  /**
   * Get controller by name
   */
  getController(name: string): Function | undefined {
    return this.controllers.get(name);
  }

  /**
   * Get controller metadata
   */
  getControllerMetadata(controller: Function): ControllerMetadata | undefined {
    return Reflect.getMetadata(METADATA_KEYS.CONTROLLER, controller);
  }

  /**
   * Get all routes for a controller
   */
  getRoutes(controller: Function): RouteMetadata[] {
    return Reflect.getMetadata(METADATA_KEYS.ROUTES, controller.prototype) || [];
  }

  /**
   * Get parameter metadata for a specific method
   */
  getParams(controller: Function, methodName: string | symbol): ParamMetadata[] {
    const allParams: ParamMetadata[] =
      Reflect.getMetadata(METADATA_KEYS.PARAMS, controller.prototype) || [];
    return allParams.filter((p) => p.propertyKey === methodName);
  }

  /**
   * Generate app manifest from all registered controllers
   * Groups multiple controllers under the same lambda when they share the same lambdaName
   */
  generateManifest(): AppManifest {
    const manifest: AppManifest = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      lambdas: {},
    };

    // Group controllers by lambdaName
    const lambdaGroups: Map<string, { controllers: string[]; routes: RouteManifestEntry[] }> =
      new Map();

    for (const [name, controller] of this.controllers) {
      const controllerMeta = this.getControllerMetadata(controller);
      if (!controllerMeta) continue;

      const routes = this.getRoutes(controller);
      const lambdaName = controllerMeta.lambdaName || name.toLowerCase().replace('controller', '');

      const routeEntries: RouteManifestEntry[] = routes.map((route) => ({
        method: route.method,
        path: this.joinPaths(controllerMeta.basePath, route.path),
        controller: controllerMeta.controllerName,
        action: String(route.propertyKey),
      }));

      // Get or create lambda group
      if (!lambdaGroups.has(lambdaName)) {
        lambdaGroups.set(lambdaName, { controllers: [], routes: [] });
      }

      const group = lambdaGroups.get(lambdaName)!;
      group.controllers.push(controllerMeta.controllerName);
      group.routes.push(...routeEntries);
    }

    // Build manifest from groups
    for (const [lambdaName, group] of lambdaGroups) {
      manifest.lambdas[lambdaName] = {
        handler: `dist/handlers/${lambdaName}.handler`,
        controller: group.controllers.join(', '), // List all controllers
        routes: group.routes,
      };
    }

    return manifest;
  }

  /**
   * Get routes for a specific lambda
   */
  getRoutesForLambda(
    lambdaName: string
  ): { controller: Function; routes: RouteMetadata[]; basePath: string }[] {
    const result: { controller: Function; routes: RouteMetadata[]; basePath: string }[] = [];

    for (const [name, controller] of this.controllers) {
      const controllerMeta = this.getControllerMetadata(controller);
      if (!controllerMeta) continue;

      const controllerLambdaName =
        controllerMeta.lambdaName || name.toLowerCase().replace('controller', '');

      if (controllerLambdaName === lambdaName) {
        result.push({
          controller,
          routes: this.getRoutes(controller),
          basePath: controllerMeta.basePath,
        });
      }
    }

    return result;
  }

  /**
   * Join path segments, handling slashes correctly
   */
  private joinPaths(basePath: string, routePath: string): string {
    const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    const route = routePath.startsWith('/') ? routePath : `/${routePath}`;
    const fullPath = route === '/' ? base : `${base}${route}`;
    return fullPath || '/';
  }

  /**
   * Clear registry (useful for testing)
   */
  clear(): void {
    this.controllers.clear();
  }
}

// Export singleton instance
export const routeRegistry = new RouteRegistry();
