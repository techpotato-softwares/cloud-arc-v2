import 'reflect-metadata';
import { METADATA_KEYS, ControllerMetadata } from './metadata';
import { routeRegistry } from './registry';

export interface ControllerOptions {
  /** Base path for all routes in this controller */
  path?: string;
  /** Lambda function name (defaults to controller name without 'Controller' suffix) */
  lambdaName?: string;
}

/**
 * Controller decorator - marks a class as a route controller
 *
 * @example
 * @Controller('/api/po')
 * export class POController { }
 *
 * @example
 * @Controller({ path: '/api/po', lambdaName: 'po' })
 * export class POController { }
 */
export function Controller(pathOrOptions?: string | ControllerOptions): ClassDecorator {
  return function (target: Function) {
    const options: ControllerOptions =
      typeof pathOrOptions === 'string' ? { path: pathOrOptions } : pathOrOptions || {};

    const basePath = options.path || '/';
    const controllerName = target.name;

    const metadata: ControllerMetadata = {
      basePath,
      controllerName,
      lambdaName: options.lambdaName,
    };

    // Store metadata on the class
    Reflect.defineMetadata(METADATA_KEYS.CONTROLLER, metadata, target);
    Reflect.defineMetadata(METADATA_KEYS.CONTROLLER_NAME, controllerName, target);

    // Register controller in global registry
    routeRegistry.registerController(controllerName, target);
  };
}
