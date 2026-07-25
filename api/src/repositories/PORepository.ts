import { injectable, inject } from 'inversify';
import {
  PrismaClient,
  PurchaseOrder,
  POItem,
  Prisma,
  Category,
  OEM,
  Product,
  Client,
  User,
} from '@prisma/client';
import { TYPES } from '../types/types';
import {
  CreatePORequest,
  UpdatePORequest,
  ListPORequest,
  ListSummaryRequest,
  POItemRequest,
  ProductReportRequest,
} from '../schemas';
import { PENDING_THRESHOLD_DAYS } from '../constants/summaryConstants';
import { getFiscalYearString } from '../utils/fiscalYear';

// Allowed searchable fields for PO model
const ALLOWED_SEARCH_FIELDS = ['poId', 'clientPoNo', 'osgPiNo', 'poStatus'] as const;
type AllowedSearchField = (typeof ALLOWED_SEARCH_FIELDS)[number];

// Default search field when searchKey is not provided
const DEFAULT_SEARCH_FIELD: AllowedSearchField = 'poId';

// Type for a single row returned by getReports
export interface ProductReportRow {
  productId: number;
  productName: string;
  categoryName: string;
  oemName: string;
  totalQuantity: number;
  totalSpareQuantity: number;
  avgPricePerUnit: number;
  totalPrice: number;
  finalPrice: number;
}

// Type for POItem with included relations
export type POItemWithRelations = POItem & {
  category: Category;
  oem: OEM;
  product: Product;
};

// Type for PurchaseOrder with included relations
export type PurchaseOrderWithRelations = PurchaseOrder & {
  poItems: POItemWithRelations[];
  client: Client;
  assignedUser: User | null;
  assignedServiceUser: User | null;
  createdBy: User | null;
};

export interface IPORepository {
  create(data: CreatePORequest): Promise<PurchaseOrderWithRelations>;
  findById(poId: string): Promise<PurchaseOrderWithRelations | null>;
  findAll(params: ListPORequest): Promise<{ rows: PurchaseOrderWithRelations[]; count: number }>;
  findAllForSummary(
    params: ListSummaryRequest
  ): Promise<{ rows: PurchaseOrderWithRelations[]; count: number }>;
  countForSummary(
    params: ListSummaryRequest,
    poStatusOverride?: string | { in: string[] } | { pendingOverThreshold: true }
  ): Promise<number>;
  update(poId: string, data: UpdatePORequest): Promise<PurchaseOrderWithRelations | null>;
  delete(poId: string): Promise<boolean>;
  generatePoId(fiscalYear?: string): Promise<string>;
  getReports(params: ProductReportRequest): Promise<{ rows: ProductReportRow[] }>;
}

@injectable()
export class PORepository implements IPORepository {
  constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {}

  /**
   * Validate if the search field is allowed
   */
  private isValidSearchField(field: string): field is AllowedSearchField {
    return ALLOWED_SEARCH_FIELDS.includes(field as AllowedSearchField);
  }

  /**
   * Generate a unique PO ID in format OSG-<FY>-<UniqueId> (e.g. OSG-2025-26-00000001).
   * FY is Indian financial year (April–March), derived from current date; no developer intervention.
   * Uses a database sequence for guaranteed uniqueness.
   */
  async generatePoId(fiscalYear?: string): Promise<string> {
    // First, ensure the sequence exists (idempotent)
    await this.prisma.$executeRaw`
      CREATE SEQUENCE IF NOT EXISTS po_id_seq START WITH 1 INCREMENT BY 1
    `;

    // Get next value from sequence
    const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('po_id_seq')
    `;

    const seqNum = Number(result[0].nextval);
    const fy = fiscalYear || getFiscalYearString(new Date());
    return `OSG-${fy}-${seqNum.toString().padStart(8, '0')}`;
  }

  // Include clause for fetching all relations
  private readonly includeRelations = {
    client: true,
    assignedUser: true,
    assignedServiceUser: true,
    createdBy: true,
    poItems: {
      include: {
        category: true,
        oem: true,
        product: true,
      },
    },
  };

  async create(data: CreatePORequest): Promise<PurchaseOrderWithRelations> {
    // Generate unique PO ID (use fiscalYear from request if provided, else current FY)
    const poId = await this.generatePoId(data.fiscalYear);

    // Use clientPoDate as default for optional date fields when not provided
    const defaultDate = data.clientPoDate ? new Date(data.clientPoDate) : new Date();

    const po = await this.prisma.purchaseOrder.create({
      data: {
        poId,
        clientId: typeof data.clientId === 'string' ? parseInt(data.clientId, 10) : data.clientId,
        osgPiNo: data.osgPiNo,
        osgPiDate: new Date(data.osgPiDate),
        clientPoNo: data.clientPoNo,
        clientPoDate: new Date(data.clientPoDate),
        poStatus: data.poStatus,
        noOfDispatch: data.noOfDispatch,
        assignDispatchTo: data.assignDispatchTo
          ? typeof data.assignDispatchTo === 'string'
            ? parseInt(data.assignDispatchTo, 10)
            : data.assignDispatchTo
          : null,
        assignServiceTo: data.assignServiceTo
          ? typeof data.assignServiceTo === 'string'
            ? parseInt(data.assignServiceTo, 10)
            : data.assignServiceTo
          : null,
        clientAddress: data.clientAddress,
        clientContact: data.clientContact,
        dispatchPlanDate: new Date(data.dispatchPlanDate),
        siteLocation: data.siteLocation,
        oscSupport: data.oscSupport,
        confirmDateOfDispatch: data.confirmDateOfDispatch
          ? new Date(data.confirmDateOfDispatch)
          : defaultDate,
        paymentStatus: data.paymentStatus,
        remarks: data.remarks,
        createdById: data.createdById,
        updatedById: data.createdById,
        poItems: {
          create:
            data.poItems?.map((item: POItemRequest) => ({
              categoryId:
                typeof item.categoryId === 'string'
                  ? parseInt(item.categoryId, 10)
                  : item.categoryId,
              oemId: typeof item.oemId === 'string' ? parseInt(item.oemId, 10) : item.oemId,
              productId:
                typeof item.productId === 'string' ? parseInt(item.productId, 10) : item.productId,
              quantity: item.quantity,
              spareQuantity: item.spareQuantity,
              totalQuantity: item.totalQuantity,
              pricePerUnit: item.pricePerUnit,
              totalPrice: item.totalPrice,
              gstPercent: item.gstPercent,
              finalPrice: item.finalPrice,
              warranty: item.warranty,
            })) || [],
        },
      },
      include: this.includeRelations,
    });

    return po as PurchaseOrderWithRelations;
  }

  async findById(poId: string): Promise<PurchaseOrderWithRelations | null> {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { poId },
      include: this.includeRelations,
    });
    return po as PurchaseOrderWithRelations | null;
  }

  async findAll(
    params: ListPORequest
  ): Promise<{ rows: PurchaseOrderWithRelations[]; count: number }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      clientId,
      poStatus,
      assignedTo,
      searchKey,
      searchTerm,
    } = params;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (clientId) {
      where.clientId = typeof clientId === 'string' ? parseInt(clientId, 10) : clientId;
    }
    if (poStatus && !searchTerm) {
      // Only use poStatus filter if not using dynamic search
      where.poStatus = poStatus;
    }
    if (assignedTo) {
      const userId = typeof assignedTo === 'string' ? parseInt(assignedTo, 10) : assignedTo;
      where.OR = [
        { assignDispatchTo: userId },
        { assignServiceTo: userId },
        { createdById: userId },
      ];
    }

    // Dynamic search implementation with default field
    if (searchTerm) {
      // If searchKey is provided, use it; otherwise use default
      const fieldToSearch = searchKey || DEFAULT_SEARCH_FIELD;

      // Security: Validate searchKey is in allowed list
      if (!this.isValidSearchField(fieldToSearch)) {
        throw new Error(
          `Invalid search field: ${fieldToSearch}. Allowed fields: ${ALLOWED_SEARCH_FIELDS.join(', ')}`
        );
      }

      // Build dynamic search condition (case-insensitive)
      where[fieldToSearch] = {
        contains: searchTerm,
        mode: 'insensitive',
      };
    }

    // Build orderBy - map field names to Prisma format
    const orderByField = sortBy as keyof Prisma.PurchaseOrderOrderByWithRelationInput;
    const orderBy: Prisma.PurchaseOrderOrderByWithRelationInput = {
      [orderByField]: sortOrder.toLowerCase() as Prisma.SortOrder,
    };

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        include: this.includeRelations,
        orderBy,
        take: limit,
        skip,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { rows: rows as PurchaseOrderWithRelations[], count };
  }

  /**
   * Build where clause for summary list/stats (shared by findAllForSummary and countForSummary).
   * When poStatusOverride is { pendingOverThreshold: true }, counts POs that are not closed
   * and whose clientPoDate is older than PENDING_THRESHOLD_DAYS.
   */
  private buildWhereForSummary(
    params: ListSummaryRequest,
    poStatusOverride?: string | { in: string[] } | { pendingOverThreshold: true }
  ): Prisma.PurchaseOrderWhereInput {
    const {
      clientId,
      poStatus,
      paymentStatus,
      assignedTo,
      searchKey,
      searchTerm,
      dateFrom,
      dateTo,
      categoryId,
      oemId,
      productId,
      salesmanId,
      dispatchId,
      serviceId,
      taxInvoice,
      userId,
    } = params;

    const where: Prisma.PurchaseOrderWhereInput = {};
    if (clientId) {
      where.clientId = typeof clientId === 'string' ? parseInt(clientId, 10) : clientId;
    }

    const isPendingOverThreshold =
      typeof poStatusOverride === 'object' &&
      poStatusOverride !== null &&
      'pendingOverThreshold' in poStatusOverride;

    if (isPendingOverThreshold) {
      where.poStatus = { not: 'closed' };
    } else if (poStatusOverride !== undefined) {
      where.poStatus = poStatusOverride;
    } else if (poStatus && !searchTerm) {
      where.poStatus = poStatus;
    }
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }
    if (assignedTo) {
      const userId = typeof assignedTo === 'string' ? parseInt(assignedTo, 10) : assignedTo;
      where.OR = [
        { assignDispatchTo: userId },
        { assignServiceTo: userId },
        { createdById: userId },
      ];
    }
    if (dateFrom || dateTo || isPendingOverThreshold) {
      where.clientPoDate = where.clientPoDate ?? {};
      const dateCond = where.clientPoDate as Prisma.DateTimeFilter;
      if (dateFrom) {
        dateCond.gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateCond.lte = new Date(dateTo);
      }
      if (isPendingOverThreshold) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - PENDING_THRESHOLD_DAYS);
        dateCond.lt = cutoff;
      }
    }

    if (searchTerm) {
      const fieldToSearch = searchKey || DEFAULT_SEARCH_FIELD;
      if (!this.isValidSearchField(fieldToSearch)) {
        throw new Error(
          `Invalid search field: ${fieldToSearch}. Allowed fields: ${ALLOWED_SEARCH_FIELDS.join(', ')}`
        );
      }
      where[fieldToSearch] = {
        contains: searchTerm,
        mode: 'insensitive',
      };
    }

    // Product filters: Category → OEM → Product (cascading)
    // Build product filter conditions
    const productFilterConditions: Prisma.ProductWhereInput = {};
    if (categoryId) {
      const catId = typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId;
      productFilterConditions.categoryId = catId;
    }
    if (oemId) {
      const oemIdNum = typeof oemId === 'string' ? parseInt(oemId, 10) : oemId;
      productFilterConditions.oemId = oemIdNum;
    }
    if (productId) {
      const prodId = typeof productId === 'string' ? parseInt(productId, 10) : productId;
      productFilterConditions.productId = prodId;
    }

    // Apply product filters if any are set
    if (Object.keys(productFilterConditions).length > 0) {
      where.poItems = {
        some: {
          product: productFilterConditions,
        },
      };
    }

    // Salesman filter: Filter by createdById
    if (salesmanId) {
      const salesmanIdNum = typeof salesmanId === 'string' ? parseInt(salesmanId, 10) : salesmanId;
      where.createdById = salesmanIdNum;
    }

    // Dispatch filters: Build dispatch filter conditions
    const dispatchFilterConditions: Prisma.DispatchWhereInput = {};
    if (dispatchId) {
      const dispatchIdNum = typeof dispatchId === 'string' ? parseInt(dispatchId, 10) : dispatchId;
      dispatchFilterConditions.dispatchId = dispatchIdNum;
    }
    if (taxInvoice) {
      dispatchFilterConditions.taxInvoiceNumber = {
        contains: taxInvoice,
        mode: 'insensitive',
      };
    }
    if (serviceId) {
      const serviceIdNum = typeof serviceId === 'string' ? parseInt(serviceId, 10) : serviceId;
      dispatchFilterConditions.services = {
        some: {
          serviceId: serviceIdNum,
        },
      };
    }

    // Apply dispatch filters if any are set
    if (Object.keys(dispatchFilterConditions).length > 0) {
      where.dispatches = {
        some: dispatchFilterConditions,
      };
    }

    // User filter: When userId provided, filter by createdById OR assignDispatchTo OR assignServiceTo
    if (userId) {
      const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
      const userFilter: Prisma.PurchaseOrderWhereInput = {
        OR: [
          { createdById: userIdNum },
          { assignDispatchTo: userIdNum },
          { assignServiceTo: userIdNum },
        ],
      };
      // Merge with existing where conditions
      if (where.OR) {
        // If OR already exists (from assignedTo), combine conditions
        where.AND = [{ OR: where.OR }, { OR: userFilter.OR }];
        delete where.OR;
      } else {
        where.OR = userFilter.OR;
      }
    }

    return where;
  }

  /**
   * Count POs for summary stats with optional poStatus override.
   */
  async countForSummary(
    params: ListSummaryRequest,
    poStatusOverride?: string | { in: string[] }
  ): Promise<number> {
    const where = this.buildWhereForSummary(params, poStatusOverride);
    return this.prisma.purchaseOrder.count({ where });
  }

  /**
   * Find POs for summary list with date range and payment status filters.
   * Pipeline filter (pipelineStage/pipelineStatus) is applied in the service layer.
   */
  async findAllForSummary(
    params: ListSummaryRequest
  ): Promise<{ rows: PurchaseOrderWithRelations[]; count: number }> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC' } = params;

    const skip = (page - 1) * limit;
    const where = this.buildWhereForSummary(params);

    const orderByField = sortBy as keyof Prisma.PurchaseOrderOrderByWithRelationInput;
    const orderBy: Prisma.PurchaseOrderOrderByWithRelationInput = {
      [orderByField]: sortOrder.toLowerCase() as Prisma.SortOrder,
    };

    // Enhanced include with dispatches and services
    const includeWithDispatches = {
      ...this.includeRelations,
      dispatches: {
        include: {
          dispatchedItems: {
            include: {
              product: true,
            },
          },
          services: {
            include: {
              assignedServiceEngineer: true,
            },
          },
        },
      },
    };

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        include: includeWithDispatches,
        orderBy,
        take: limit,
        skip,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { rows: rows as PurchaseOrderWithRelations[], count };
  }

  async update(poId: string, data: UpdatePORequest): Promise<PurchaseOrderWithRelations | null> {
    // Check if PO exists
    const existing = await this.prisma.purchaseOrder.findUnique({ where: { poId } });
    if (!existing) {
      return null;
    }

    // Build update data using UncheckedUpdateInput to allow direct foreign key assignments
    const updateData: Prisma.PurchaseOrderUncheckedUpdateInput = {};
    if (data.updatedById !== undefined) updateData.updatedById = data.updatedById;
    if (data.clientId !== undefined) {
      const clientId =
        typeof data.clientId === 'string' ? parseInt(data.clientId, 10) : data.clientId;
      updateData.clientId = clientId;
    }
    if (data.osgPiNo !== undefined) updateData.osgPiNo = data.osgPiNo;
    if (data.osgPiDate !== undefined) updateData.osgPiDate = new Date(data.osgPiDate);
    if (data.clientPoNo !== undefined) updateData.clientPoNo = data.clientPoNo;
    if (data.clientPoDate !== undefined) updateData.clientPoDate = new Date(data.clientPoDate);
    if (data.poStatus !== undefined) updateData.poStatus = data.poStatus;
    if (data.noOfDispatch !== undefined) updateData.noOfDispatch = data.noOfDispatch;
    if (data.assignDispatchTo !== undefined) {
      const userId =
        typeof data.assignDispatchTo === 'string'
          ? parseInt(data.assignDispatchTo, 10)
          : data.assignDispatchTo;
      updateData.assignDispatchTo = userId || null;
    }
    if (data.assignServiceTo !== undefined) {
      const userId =
        typeof data.assignServiceTo === 'string'
          ? parseInt(data.assignServiceTo, 10)
          : data.assignServiceTo;
      updateData.assignServiceTo = userId || null;
    }
    if (data.clientAddress !== undefined) updateData.clientAddress = data.clientAddress;
    if (data.clientContact !== undefined) updateData.clientContact = data.clientContact;
    if (data.dispatchPlanDate !== undefined)
      updateData.dispatchPlanDate = new Date(data.dispatchPlanDate);
    if (data.siteLocation !== undefined) updateData.siteLocation = data.siteLocation;
    if (data.oscSupport !== undefined) updateData.oscSupport = data.oscSupport;
    if (data.confirmDateOfDispatch !== undefined)
      updateData.confirmDateOfDispatch = new Date(data.confirmDateOfDispatch);
    if (data.paymentStatus !== undefined) updateData.paymentStatus = data.paymentStatus;
    if (data.remarks !== undefined) updateData.remarks = data.remarks;

    // If poItems provided, delete existing and create new ones
    if (data.poItems) {
      await this.prisma.$transaction([
        this.prisma.pOItem.deleteMany({ where: { poId } }),
        this.prisma.purchaseOrder.update({
          where: { poId },
          data: {
            ...updateData,
            poItems: {
              create: data.poItems.map((item: POItemRequest) => ({
                categoryId:
                  typeof item.categoryId === 'string'
                    ? parseInt(item.categoryId, 10)
                    : item.categoryId,
                oemId: typeof item.oemId === 'string' ? parseInt(item.oemId, 10) : item.oemId,
                productId:
                  typeof item.productId === 'string'
                    ? parseInt(item.productId, 10)
                    : item.productId,
                quantity: item.quantity,
                spareQuantity: item.spareQuantity,
                totalQuantity: item.totalQuantity,
                pricePerUnit: item.pricePerUnit,
                totalPrice: item.totalPrice,
                gstPercent: item.gstPercent,
                finalPrice: item.finalPrice,
                warranty: item.warranty,
              })),
            },
          },
        }),
      ]);
    } else {
      await this.prisma.purchaseOrder.update({
        where: { poId },
        data: updateData,
      });
    }

    // Return updated PO with relations
    return this.findById(poId);
  }

  async delete(poId: string): Promise<boolean> {
    try {
      await this.prisma.purchaseOrder.delete({ where: { poId } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get aggregated product report from PO items
   * If oemId is provided, fetches all products for that OEM and aggregates PO items for all those products
   * If only productId is provided, aggregates PO items for that specific product
   * Returns summary statistics aggregated across all PO items
   */
  async getReports(params: ProductReportRequest): Promise<{ rows: ProductReportRow[] }> {
    const { productId, oemId, categoryId, clientId, salesPersonId, purchaseOrderId } = params;

    // Build where clause for PO items
    const whereClause: Prisma.POItemWhereInput = {};
    let poItemIdsForFilter: number[] | null = null;

    // If purchaseOrderId is provided, fetch all PO item IDs for that PO
    if (purchaseOrderId) {
      // Get all PO item IDs for this PO
      const poItems = await this.prisma.pOItem.findMany({
        where: {
          poId: purchaseOrderId,
        },
        select: {
          id: true,
          productId: true,
        },
      });

      if (poItems.length === 0) {
        return { rows: [] };
      }

      // Extract PO item IDs
      poItemIdsForFilter = poItems.map((item) => item.id);

      // If additional filters (productId, oemId, categoryId) are provided, filter PO items
      if (productId || oemId || categoryId) {
        // Get productIds from PO items
        const productIdsFromPOs = poItems.map((item) => item.productId);

        // Build product filter conditions
        const productWhere: Prisma.ProductWhereInput = {
          productId: { in: productIdsFromPOs },
          isActive: true,
        };

        if (categoryId) {
          productWhere.categoryId = categoryId;
        }

        if (oemId) {
          productWhere.oemId = oemId;
        }

        if (productId) {
          productWhere.productId = productId;
        }

        // Fetch filtered products
        const products = await this.prisma.product.findMany({
          where: productWhere,
          select: {
            productId: true,
          },
        });

        const filteredProductIds = products.map((p: { productId: number }) => p.productId);

        if (filteredProductIds.length === 0) {
          return { rows: [] };
        }

        // Filter PO items to only those with filtered productIds
        const filteredPoItems = poItems.filter((item) =>
          filteredProductIds.includes(item.productId)
        );

        poItemIdsForFilter = filteredPoItems.map((item) => item.id);

        if (poItemIdsForFilter.length === 0) {
          return { rows: [] };
        }
      }

      // Filter by PO item IDs directly
      whereClause.id = { in: poItemIdsForFilter };
    } else if (clientId) {
      // Fetch all POs for the client
      const purchaseOrders = await this.prisma.purchaseOrder.findMany({
        where: {
          clientId: clientId,
        },
        select: {
          poId: true,
        },
      });

      const poIds = purchaseOrders.map((po) => po.poId);

      if (poIds.length === 0) {
        return { rows: [] };
      }

      // Get all PO item IDs for these POs
      const poItems = await this.prisma.pOItem.findMany({
        where: {
          poId: { in: poIds },
        },
        select: {
          id: true,
          productId: true,
        },
      });

      if (poItems.length === 0) {
        return { rows: [] };
      }

      // Extract PO item IDs
      poItemIdsForFilter = poItems.map((item) => item.id);

      // If additional filters (productId, oemId, categoryId) are provided, filter PO items
      if (productId || oemId || categoryId) {
        // Get productIds from PO items
        const productIdsFromPOs = poItems.map((item) => item.productId);

        // Build product filter conditions
        const productWhere: Prisma.ProductWhereInput = {
          productId: { in: productIdsFromPOs },
          isActive: true,
        };

        if (categoryId) {
          productWhere.categoryId = categoryId;
        }

        if (oemId) {
          productWhere.oemId = oemId;
        }

        if (productId) {
          productWhere.productId = productId;
        }

        // Fetch filtered products
        const products = await this.prisma.product.findMany({
          where: productWhere,
          select: {
            productId: true,
          },
        });

        const filteredProductIds = products.map((p: { productId: number }) => p.productId);

        if (filteredProductIds.length === 0) {
          return { rows: [] };
        }

        // Filter PO items to only those with filtered productIds
        const filteredPoItems = poItems.filter((item) =>
          filteredProductIds.includes(item.productId)
        );

        poItemIdsForFilter = filteredPoItems.map((item) => item.id);

        if (poItemIdsForFilter.length === 0) {
          return { rows: [] };
        }
      }

      // Filter by PO item IDs directly
      whereClause.id = { in: poItemIdsForFilter };
    } else if (salesPersonId) {
      // If salesPersonId is provided, fetch all PO item IDs for POs created by that user
      // Fetch all POs created by the sales person
      const purchaseOrders = await this.prisma.purchaseOrder.findMany({
        where: {
          createdById: salesPersonId,
        },
        select: {
          poId: true,
        },
      });

      const poIds = purchaseOrders.map((po) => po.poId);

      if (poIds.length === 0) {
        return { rows: [] };
      }

      // Get all PO item IDs for these POs
      const poItems = await this.prisma.pOItem.findMany({
        where: {
          poId: { in: poIds },
        },
        select: {
          id: true,
          productId: true,
        },
      });

      if (poItems.length === 0) {
        return { rows: [] };
      }

      // Extract PO item IDs
      poItemIdsForFilter = poItems.map((item) => item.id);

      // Filter by PO item IDs directly
      whereClause.id = { in: poItemIdsForFilter };
    } else if (categoryId || oemId) {
      // If categoryId or oemId is provided, fetch products first
      // Build product filter conditions
      const productWhere: Prisma.ProductWhereInput = {
        isActive: true,
      };

      if (categoryId) {
        productWhere.categoryId = categoryId;
      }

      if (oemId) {
        productWhere.oemId = oemId;
      }

      // If productId is also provided, filter to that specific product
      if (productId) {
        productWhere.productId = productId;
      }

      // Fetch all products matching the criteria
      const products = await this.prisma.product.findMany({
        where: productWhere,
        select: {
          productId: true,
        },
      });

      const productIds = products.map((p: { productId: number }) => p.productId);

      if (productIds.length === 0) {
        return { rows: [] };
      }

      whereClause.productId = { in: productIds };
    } else if (productId) {
      // If only productId is provided, use it directly
      whereClause.productId = productId;
    } else {
      // Neither productId, oemId, categoryId, clientId, salesPersonId, nor purchaseOrderId provided - return empty
      return { rows: [] };
    }

    // Get all PO items matching the criteria with relations
    const poItems = await this.prisma.pOItem.findMany({
      where: whereClause,
      include: {
        product: true,
        category: true,
        oem: true,
      },
    });

    if (poItems.length === 0) {
      return { rows: [] };
    }

    // Group by productId, categoryId, and oemId to handle cases where same product
    // might appear with different category/oem combinations in PO items
    const grouped = new Map<
      string,
      {
        productId: number;
        productName: string;
        categoryId: number;
        categoryName: string;
        oemId: number;
        oemName: string;
        totalQuantity: number;
        totalSpareQuantity: number;
        sumPricePerUnitTimesQuantity: number; // For weighted average calculation
        totalPrice: number;
        finalPrice: number;
      }
    >();

    for (const item of poItems) {
      const key = `${item.productId}-${item.categoryId}-${item.oemId}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.totalSpareQuantity += item.spareQuantity;
        existing.sumPricePerUnitTimesQuantity += Number(item.pricePerUnit) * item.quantity;
        existing.totalPrice += Number(item.totalPrice);
        existing.finalPrice += Number(item.finalPrice);
      } else {
        grouped.set(key, {
          productId: item.productId,
          productName: item.product.productName,
          categoryId: item.categoryId,
          categoryName: item.category.categoryName,
          oemId: item.oemId,
          oemName: item.oem.oemName,
          totalQuantity: item.quantity,
          totalSpareQuantity: item.spareQuantity,
          sumPricePerUnitTimesQuantity: Number(item.pricePerUnit) * item.quantity,
          totalPrice: Number(item.totalPrice),
          finalPrice: Number(item.finalPrice),
        });
      }
    }

    // Convert to array and calculate average price per unit (weighted average)
    const rows = Array.from(grouped.values()).map((group) => ({
      productId: group.productId,
      productName: group.productName,
      categoryName: group.categoryName,
      oemName: group.oemName,
      totalQuantity: group.totalQuantity,
      totalSpareQuantity: group.totalSpareQuantity,
      avgPricePerUnit:
        group.totalQuantity > 0
          ? Number((group.sumPricePerUnitTimesQuantity / group.totalQuantity).toFixed(2))
          : 0,
      totalPrice: Number(group.totalPrice.toFixed(2)),
      finalPrice: Number(group.finalPrice.toFixed(2)),
    }));

    return { rows };
  }
}
