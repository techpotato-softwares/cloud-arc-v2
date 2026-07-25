import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import { IPORepository } from '../repositories/PORepository';
import {
  IAccountingEntryRepository,
  AccountingEntryWithRelations,
} from '../repositories/AccountingEntryRepository';
import { IPOService } from './POService';
import {
  ListSummaryRequest,
  SummaryRowResponse,
  SummaryListResponse,
  SummaryStatsResponse,
  POAccordionStatus,
  AccordionStatusType,
  DispatchSummary,
  ServiceSummary,
  ProductReportRequest,
  ProductReportResponse,
  ProductReportItemResponse,
} from '../schemas';
import { PurchaseOrderWithRelations } from '../repositories/PORepository';

const MAX_PAGE_SIZE = 50;
const MAX_EXPORT_ROWS = 1000;

export interface ISummaryService {
  getSummaryList(params: ListSummaryRequest): Promise<SummaryListResponse>;
  getSummaryStats(
    params: Omit<ListSummaryRequest, 'page' | 'limit'>
  ): Promise<SummaryStatsResponse>;
  getSummaryExport(
    params: Omit<ListSummaryRequest, 'page'> & { columns?: string }
  ): Promise<string>;
  getReports(params: ProductReportRequest): Promise<ProductReportResponse>;
}

@injectable()
export class SummaryService implements ISummaryService {
  constructor(
    @inject(TYPES.PORepository) private poRepository: IPORepository,
    @inject(TYPES.POService) private poService: IPOService,
    @inject(TYPES.AccountingEntryRepository)
    private accountingEntryRepository: IAccountingEntryRepository
  ) {}

  async getSummaryList(params: ListSummaryRequest): Promise<SummaryListResponse> {
    const { pipelineStage, pipelineStatus, ...baseParams } = params;
    const limit = Math.min(params.limit ?? 10, MAX_PAGE_SIZE);
    const page = params.page ?? 1;

    const { rows, count } = await this.poRepository.findAllForSummary({
      ...baseParams,
      page,
      limit,
    });

    const rowsWithAccordion: SummaryRowResponse[] = [];
    for (const po of rows) {
      const totalPOQty = po.poItems.reduce((sum, item) => sum + item.quantity, 0);
      const accordionStatus = await this.poService.getAccordionStatus(po.poId, totalPOQty);
      const response = this.poService.buildResponseFromPO(
        po,
        accordionStatus
      ) as SummaryRowResponse;
      response.accordionStatus = accordionStatus;

      // Aggregate dispatch and service data
      this.aggregateDataForSummary(response, po);

      // Aggregate accounting data: amount received & remaining amount
      const accountingEntries = await this.accountingEntryRepository.findByPoId(po.poId, 'order');
      const { amountReceived, remainingAmount } = this.computeAccountingSummary(
        response,
        accountingEntries
      );
      response.amountReceived = amountReceived;
      response.remainingAmount = remainingAmount;

      if (pipelineStage && pipelineStatus) {
        const stageStatus = this.getStageStatus(accordionStatus, pipelineStage);
        if (stageStatus === pipelineStatus) {
          rowsWithAccordion.push(response);
        }
        if (rowsWithAccordion.length >= limit) break;
      } else {
        rowsWithAccordion.push(response);
      }
    }

    return {
      data: rowsWithAccordion,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getSummaryStats(
    params: Omit<ListSummaryRequest, 'page' | 'limit'>
  ): Promise<SummaryStatsResponse> {
    const baseParams = { ...params, page: 1, limit: 1 };

    const [total, completed, pending] = await Promise.all([
      this.poRepository.countForSummary(baseParams),
      this.poRepository.countForSummary(baseParams, 'closed'),
      this.poRepository.countForSummary(baseParams, { pendingOverThreshold: true }),
    ]);

    const inProgress = Math.max(0, total - completed - pending);

    // Calculate aggregated totals if OEM/Category/Product filters are active
    let totalPrice: number | undefined;
    let finalPrice: number | undefined;
    let totalQuantity: number | undefined;

    if (params.categoryId || params.oemId || params.productId) {
      const { rows } = await this.poRepository.findAllForSummary({
        ...baseParams,
        page: 1,
        limit: MAX_EXPORT_ROWS, // Get all rows for aggregation
      });

      totalPrice = 0;
      finalPrice = 0;
      totalQuantity = 0;

      for (const po of rows) {
        for (const item of po.poItems) {
          // Apply filters to items
          let includeItem = true;
          if (params.categoryId) {
            const catId =
              typeof params.categoryId === 'string'
                ? parseInt(params.categoryId, 10)
                : params.categoryId;
            if (item.product.categoryId !== catId) includeItem = false;
          }
          if (params.oemId && includeItem) {
            const oemIdNum =
              typeof params.oemId === 'string' ? parseInt(params.oemId, 10) : params.oemId;
            if (item.product.oemId !== oemIdNum) includeItem = false;
          }
          if (params.productId && includeItem) {
            const prodId =
              typeof params.productId === 'string'
                ? parseInt(params.productId, 10)
                : params.productId;
            if (item.productId !== prodId) includeItem = false;
          }

          if (includeItem) {
            totalPrice += Number(item.totalPrice);
            finalPrice += Number(item.finalPrice);
            totalQuantity += Number(item.totalQuantity);
          }
        }
      }
    }

    return {
      total,
      inProgress,
      pending,
      completed,
      totalPrice,
      finalPrice,
      totalQuantity,
    };
  }

  async getSummaryExport(
    params: Omit<ListSummaryRequest, 'page'> & { columns?: string }
  ): Promise<string> {
    const { columns: columnsParam, ...listParams } = params;
    const columnKeys = columnsParam
      ? columnsParam.split(',').map((c) => c.trim())
      : this.getDefaultExportColumns();

    const allRows: SummaryRowResponse[] = [];
    let page = 1;
    const limit = MAX_PAGE_SIZE;
    let hasMore = true;

    while (hasMore) {
      const result = await this.getSummaryList({ ...listParams, page, limit });
      allRows.push(...result.data);
      hasMore = result.data.length >= limit && allRows.length < MAX_EXPORT_ROWS;
      page++;
    }

    const headers = this.getColumnHeaders(columnKeys);
    const lines: string[] = [headers.map((h) => this.escapeCsv(h)).join(',')];

    for (const row of allRows) {
      const values = columnKeys.map((key) => this.getCellValue(row, key));
      lines.push(values.map((v) => this.escapeCsv(v)).join(','));
    }

    return lines.join('\n');
  }

  private getStageStatus(
    accordion: POAccordionStatus,
    stage: string
  ): AccordionStatusType | undefined {
    const key = stage as keyof POAccordionStatus;
    if (key in accordion && accordion[key] && typeof accordion[key] === 'object') {
      return (accordion[key] as { status: AccordionStatusType }).status;
    }
    return undefined;
  }

  /**
   * Compute accounting summary for a PO: amount received and remaining amount.
   * amountReceived = sum of paymentAmount (+ tds for part payments) across all accounting entries.
   * remainingAmount = totalPoCost - amountReceived.
   */
  private computeAccountingSummary(
    row: SummaryRowResponse,
    entries: AccountingEntryWithRelations[]
  ): { amountReceived: number; remainingAmount: number } {
    const amountReceived = entries.reduce((sum, e) => {
      // paymentType is a string column on AccountingEntry in Prisma schema
      const type = ((e as unknown as { paymentType?: string }).paymentType ?? '').toLowerCase();
      const amount = Number(e.paymentAmount ?? 0);
      const tds = Number(e.tds ?? 0);
      if (!type || amount <= 0) return sum;
      if (type === 'part_payment') {
        return sum + amount + tds;
      }
      // advance / credit_note
      return sum + amount;
    }, 0);

    const totalPoCost = row.totalPoCost ?? 0;
    const remainingAmount = Math.max(0, totalPoCost - amountReceived);
    return { amountReceived, remainingAmount };
  }

  private getCellValue(row: SummaryRowResponse, key: string): string {
    if (key.startsWith('accordion.')) {
      const stage = key.replace('accordion.', '');
      const status = row.accordionStatus && this.getStageStatus(row.accordionStatus, stage);
      return status ?? '';
    }
    const v = (row as unknown as Record<string, unknown>)[key];
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  private getColumnHeaders(keys: string[]): string[] {
    const labelMap: Record<string, string> = {
      poId: 'PO ID',
      clientName: 'Client Name',
      osgPiNo: 'OSG PI No',
      osgPiDate: 'OSG PI Date',
      clientPoNo: 'Client PO No',
      clientPoDate: 'Client PO Date',
      poStatus: 'PO Status',
      paymentStatus: 'Payment Status',
      noOfDispatch: 'No of Dispatch',
      assignedUserName: 'Assigned Dispatch To',
      assignedServiceUserName: 'Assigned Service To',
      dispatchPlanDate: 'Dispatch Plan Date',
      confirmDateOfDispatch: 'Confirm Date of Dispatch',
      siteLocation: 'Site Location',
      oscSupport: 'OSC Support',
      remarks: 'Remarks',
      'accordion.dispatch': 'Dispatch Status',
      'accordion.document': 'Document Status',
      'accordion.delivery': 'Delivery Status',
      'accordion.preCommissioning': 'Pre-Commissioning Status',
      'accordion.commissioning': 'Commissioning Status',
      'accordion.warranty': 'Warranty Status',
    };
    return keys.map((k) => labelMap[k] ?? k);
  }

  private getDefaultExportColumns(): string[] {
    return [
      'poId',
      'clientPoDate',
      'clientName',
      'osgPiNo',
      'clientPoNo',
      'poStatus',
      'paymentStatus',
      'assignedUserName',
      'accordion.dispatch',
      'accordion.document',
      'accordion.delivery',
      'accordion.preCommissioning',
      'accordion.commissioning',
      'accordion.warranty',
    ];
  }

  private escapeCsv(value: string): string {
    const s = String(value ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  /**
   * Aggregate dispatch and service data for summary row
   */
  private aggregateDataForSummary(
    response: SummaryRowResponse,
    po: PurchaseOrderWithRelations & {
      dispatches?: Array<{
        dispatchId: number;
        dispatchedItems?: Array<{ quantity?: number | null }>;
        dispatchStatus?: string | null;
        deliveryStatus?: string | null;
        taxInvoiceNumber?: string | null;
        invoiceDate?: Date | null;
        dispatchDate?: Date | null;
        deliveryLocation?: string | null;
        deliveryPincode?: string | null;
        services?: Array<{
          serviceId: number;
          dispatchId: number;
          serialNumber?: string | null;
          productName?: string | null;
          ppmConfirmationStatus?: string | null;
          preCommissioningStatus?: string | null;
          commissioningDate?: Date | null;
          commissioningEcdFromClient?: string | null;
          commissioningStatus?: string | null;
          assignedServiceEngineer?: { username: string } | null;
          warrantyStatus?: string | null;
          warrantyCertificateNo?: string | null;
        }>;
      }>;
    }
  ): void {
    // Calculate totals from PO items (coerce Prisma Decimal to number)
    response.totalPrice = po.poItems.reduce((sum, item) => sum + Number(item.totalPrice ?? 0), 0);
    response.finalPrice = po.poItems.reduce((sum, item) => sum + Number(item.finalPrice ?? 0), 0);
    response.totalQuantity = po.poItems.reduce(
      (sum, item) => sum + Number(item.totalQuantity ?? 0),
      0
    );

    // Extract unique names
    const oemSet = new Set<string>();
    const categorySet = new Set<string>();
    const productSet = new Set<string>();
    po.poItems.forEach((item) => {
      if (item.oem?.oemName) oemSet.add(item.oem.oemName);
      if (item.category?.categoryName) categorySet.add(item.category.categoryName);
      if (item.product?.productName) productSet.add(item.product.productName);
    });
    response.oemNames = Array.from(oemSet);
    response.categoryNames = Array.from(categorySet);
    response.productNames = Array.from(productSet);

    // Aggregate dispatch data
    if (po.dispatches && po.dispatches.length > 0) {
      const dispatchSummaries: DispatchSummary[] = [];
      let totalDispatchedQty = 0;
      let totalDeliveredQty = 0;

      for (const dispatch of po.dispatches) {
        const dispatchedQty =
          dispatch.dispatchedItems?.reduce(
            (sum: number, item: { quantity?: number | null }) => sum + Number(item.quantity ?? 0),
            0
          ) ?? 0;
        totalDispatchedQty += dispatchedQty;

        // Check if delivered (deliveryStatus exists and is not empty)
        if (dispatch.deliveryStatus && dispatch.deliveryStatus.trim() !== '') {
          totalDeliveredQty += dispatchedQty;
        }

        dispatchSummaries.push({
          dispatchId: dispatch.dispatchId,
          taxInvoiceNumber: dispatch.taxInvoiceNumber || undefined,
          invoiceDate: dispatch.invoiceDate
            ? dispatch.invoiceDate.toISOString().split('T')[0]
            : undefined,
          dispatchDate: dispatch.dispatchDate
            ? dispatch.dispatchDate.toISOString().split('T')[0]
            : undefined,
          dispatchStatus: dispatch.dispatchStatus || undefined,
          deliveryStatus: dispatch.deliveryStatus || undefined,
          deliveryLocation: dispatch.deliveryLocation || undefined,
          deliveryPincode: dispatch.deliveryPincode || undefined,
          dispatchedQuantity: dispatchedQty,
        });
      }

      response.dispatches = dispatchSummaries;
      response.dispatchedQuantity = totalDispatchedQty;
      response.balanceQuantity = Math.max(0, (response.totalQuantity || 0) - totalDispatchedQty);
      response.dispatchPercentage =
        response.totalQuantity && response.totalQuantity > 0
          ? (totalDispatchedQty / response.totalQuantity) * 100
          : 0;
      response.deliveredQuantity = totalDeliveredQty;
      response.deliveryPercentage =
        totalDispatchedQty > 0 ? (totalDeliveredQty / totalDispatchedQty) * 100 : 0;

      // Aggregate service data
      const serviceSummaries: ServiceSummary[] = [];
      let commissioningCount = 0;
      let warrantyCount = 0;

      for (const dispatch of po.dispatches) {
        if (dispatch.services && dispatch.services.length > 0) {
          for (const service of dispatch.services) {
            serviceSummaries.push({
              serviceId: service.serviceId,
              dispatchId: service.dispatchId,
              serialNumber: service.serialNumber || '',
              productName: service.productName || '',
              ppmConfirmationStatus: service.ppmConfirmationStatus || undefined,
              preCommissioningStatus: service.preCommissioningStatus || undefined,
              commissioningDate: service.commissioningDate
                ? service.commissioningDate.toISOString().split('T')[0]
                : undefined,
              commissioningEcdFromClient: service.commissioningEcdFromClient || undefined,
              commissioningStatus: service.commissioningStatus || undefined,
              assignedServiceEngineer: service.assignedServiceEngineer?.username || undefined,
              warrantyStatus: service.warrantyStatus || undefined,
              warrantyCertificateNo: service.warrantyCertificateNo || undefined,
            });

            // Count commissioned services
            if (service.commissioningStatus && service.commissioningStatus.trim() !== '') {
              commissioningCount++;
            }

            // Count warranty certificates
            if (service.warrantyStatus && service.warrantyStatus.trim() !== '') {
              warrantyCount++;
            }
          }
        }
      }

      response.services = serviceSummaries;
      response.commissioningQuantity = commissioningCount;
      response.commissioningPercentage =
        totalDispatchedQty > 0 ? (commissioningCount / totalDispatchedQty) * 100 : 0;
      response.warrantyQuantity = warrantyCount;
      response.warrantyPercentage =
        commissioningCount > 0 ? (warrantyCount / commissioningCount) * 100 : 0;
    } else {
      // No dispatches
      response.dispatchedQuantity = 0;
      response.balanceQuantity = response.totalQuantity || 0;
      response.dispatchPercentage = 0;
      response.deliveredQuantity = 0;
      response.deliveryPercentage = 0;
      response.commissioningQuantity = 0;
      response.commissioningPercentage = 0;
      response.warrantyQuantity = 0;
      response.warrantyPercentage = 0;
    }
  }

  async getReports(params: ProductReportRequest): Promise<ProductReportResponse> {
    const { rows } = await this.poRepository.getReports(params);

    const data: ProductReportItemResponse[] = rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      categoryName: row.categoryName,
      oemName: row.oemName,
      totalQuantity: row.totalQuantity,
      totalSpareQuantity: row.totalSpareQuantity,
      avgPricePerUnit: row.avgPricePerUnit,
      totalPrice: row.totalPrice,
      finalPrice: row.finalPrice,
    }));

    return {
      data,
    };
  }
}
