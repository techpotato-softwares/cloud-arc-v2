import { stringify } from 'yaml';
import { generateFromRouteRegistry, GenerateOpenApiOptions } from './registry';

export function generateOpenApiYaml(options: GenerateOpenApiOptions = {}): string {
  const document = generateFromRouteRegistry(options);
  return stringify(document);
}

export function generateOpenApiJson(options: GenerateOpenApiOptions = {}): string {
  const document = generateFromRouteRegistry(options);
  return JSON.stringify(document, null, 2);
}

export { generateFromRouteRegistry, GenerateOpenApiOptions };
