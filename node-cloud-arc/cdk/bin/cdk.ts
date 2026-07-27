#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ApiStack } from "../lib/stacks/api-stack";
import { getEnvironmentConfig, Environment } from "../lib/config/environment";

const app = new cdk.App();

// Get AWS account and region from environment or CDK context
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region:
    process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || "ap-south-1",
};

// Determine which environments to synthesize
// If deploying a specific stack (e.g., ApiStack-prod), only synthesize that environment
// to avoid noisy logs from other environments
const allEnvironments: Environment[] = ["dev", "qa", "prod"];

// Check if a specific stack is being targeted via command line
// CDK sets this when running commands like: cdk deploy ApiStack-prod
const targetStack = process.argv.find((arg) =>
  allEnvironments.some((e) => arg.includes(`ApiStack-${e}`)),
);

// Extract environment from target stack name, or synthesize all
let environmentsToSynthesize: Environment[];

if (targetStack) {
  const targetEnv = allEnvironments.find((e) => targetStack.includes(`-${e}`));
  environmentsToSynthesize = targetEnv ? [targetEnv] : allEnvironments;
} else {
  // No specific target - synthesize all (useful for cdk synth, cdk list, etc.)
  environmentsToSynthesize = allEnvironments;
}

// Create stacks for target environment(s)
environmentsToSynthesize.forEach((environment) => {
  const config = getEnvironmentConfig(environment);

  new ApiStack(app, config.stackName, {
    config,
    env,
  });
});

app.synth();
