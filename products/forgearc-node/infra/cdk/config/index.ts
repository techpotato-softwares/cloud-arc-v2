/**
 * CDK Infrastructure Configuration
 *
 * This file exports all service-specific configurations.
 * Add new config exports here as you add new services.
 */

// Storage configs
export * from "./s3.config";
// export * from './dynamodb.config';  // Uncomment when adding DynamoDB

// Database configs
export * from "./rds.config";

// Messaging configs
// export * from './sqs.config';       // Uncomment when adding SQS
// export * from './ses.config';       // Uncomment when adding SES

// Security configs
// export * from './cognito.config';   // Uncomment when adding Cognito
// export * from './kms.config';       // Uncomment when adding KMS
// export * from './vpc.config';       // Uncomment when adding VPC
