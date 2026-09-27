import { z } from "zod";

export const CreateDemoItemSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.string().max(50).optional(),
});

export const UpdateDemoItemSchema = CreateDemoItemSchema.partial();

export type CreateDemoItemRequest = z.infer<typeof CreateDemoItemSchema>;
export type UpdateDemoItemRequest = z.infer<typeof UpdateDemoItemSchema>;

export const DemoItemResponseSchema = z.object({
  itemId: z.number(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: z.string(),
  tenantId: z.number().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});
