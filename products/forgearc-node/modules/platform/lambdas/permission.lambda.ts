import "reflect-metadata";
import { defineLambda, createLambdaHandler } from "@forgearc/shared";
import { TYPES } from "../src/types/svc.types";
import { PermissionController } from "../src/controllers/PermissionController";
import { PermissionService } from "../src/services/PermissionService";
import { PermissionRepository } from "../src/repositories/PermissionRepository";

defineLambda({
  name: "permission",
  controllers: [PermissionController],
  bindings: [
    { symbol: TYPES.PermissionService, implementation: PermissionService },
    {
      symbol: TYPES.PermissionRepository,
      implementation: PermissionRepository,
    },
  ],
  prismaSymbol: TYPES.PrismaClient,
});

export const handler = createLambdaHandler("permission");
