import { injectable, inject } from "inversify";
import { PrismaClient, DemoItem } from "@forgearc/shared";
import { TYPES } from "../types/svc.types";
import { CreateDemoItemRequest, UpdateDemoItemRequest } from "../schemas/demo";
import { NotFoundError } from "@forgearc/shared";

export interface IDemoItemRepository {
  create(
    data: CreateDemoItemRequest & { tenantId?: number; createdById?: number },
  ): Promise<DemoItem>;
  findAll(
    tenantId?: number,
    page?: number,
    limit?: number,
  ): Promise<{ rows: DemoItem[]; count: number }>;
  findById(id: number): Promise<DemoItem | null>;
  update(
    id: number,
    data: UpdateDemoItemRequest & { updatedById?: number },
  ): Promise<DemoItem>;
  delete(id: number): Promise<void>;
}

@injectable()
export class DemoItemRepository implements IDemoItemRepository {
  constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {}

  create(
    data: CreateDemoItemRequest & { tenantId?: number; createdById?: number },
  ) {
    return this.prisma.demoItem.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status || "active",
        tenantId: data.tenantId,
        createdById: data.createdById,
        updatedById: data.createdById,
      },
    });
  }

  async findAll(tenantId?: number, page = 1, limit = 20) {
    const where = tenantId != null ? { tenantId } : undefined;
    const [rows, count] = await this.prisma.$transaction([
      this.prisma.demoItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.demoItem.count({ where }),
    ]);
    return { rows, count };
  }

  findById(id: number) {
    return this.prisma.demoItem.findUnique({ where: { itemId: id } });
  }

  async update(
    id: number,
    data: UpdateDemoItemRequest & { updatedById?: number },
  ) {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundError("Demo item not found");
    return this.prisma.demoItem.update({
      where: { itemId: id },
      data: {
        ...data,
        updatedById: data.updatedById,
      },
    });
  }

  async delete(id: number) {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundError("Demo item not found");
    await this.prisma.demoItem.delete({ where: { itemId: id } });
  }
}
