import "reflect-metadata";
import { defineLambda, createLambdaHandler } from "@forgearc/shared";
import { TYPES } from "../src/types/svc.types";
import { DemoItemController } from "../src/controllers/DemoItemController";
import { DemoItemService } from "../src/services/DemoItemService";
import { DemoItemRepository } from "../src/repositories/DemoItemRepository";

defineLambda({
  name: "demo",
  controllers: [DemoItemController],
  bindings: [
    { symbol: TYPES.DemoItemService, implementation: DemoItemService },
    { symbol: TYPES.DemoItemRepository, implementation: DemoItemRepository },
  ],
});

export const handler = createLambdaHandler("demo");
