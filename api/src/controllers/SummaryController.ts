import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Controller, Get, Query, createSuccessResponse } from '@arcforge/shared';
import { TYPES } from '../types/types';
import { ISummaryService } from '../services/SummaryService';
import { ListSummaryRequest, ProductReportRequest } from '../schemas';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
};

@Controller({ path: '/api/po/summary', lambdaName: 'CreatePO' })
@injectable()
export class SummaryController {
  constructor(@inject(TYPES.SummaryService) private summaryService: ISummaryService) {}

  @Get('/')
  async getList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('clientId') clientId?: string,
    @Query('poStatus') poStatus?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('searchKey') searchKey?: string,
    @Query('searchTerm') searchTerm?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('pipelineStage') pipelineStage?: string,
    @Query('pipelineStatus') pipelineStatus?: string,
    @Query('categoryId') categoryId?: string,
    @Query('oemId') oemId?: string,
    @Query('productId') productId?: string,
    @Query('salesmanId') salesmanId?: string,
    @Query('dispatchId') dispatchId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('taxInvoice') taxInvoice?: string
  ): Promise<APIGatewayProxyResult> {
    const params: ListSummaryRequest = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      sortBy: sortBy || 'createdAt',
      sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
      clientId,
      poStatus,
      paymentStatus,
      assignedTo: assignedTo ? parseInt(assignedTo, 10) : undefined,
      searchKey: searchKey || undefined,
      searchTerm: searchTerm || undefined,
      dateFrom,
      dateTo,
      pipelineStage,
      pipelineStatus,
      categoryId: categoryId
        ? isNaN(Number(categoryId))
          ? categoryId
          : parseInt(categoryId, 10)
        : undefined,
      oemId: oemId ? (isNaN(Number(oemId)) ? oemId : parseInt(oemId, 10)) : undefined,
      productId: productId
        ? isNaN(Number(productId))
          ? productId
          : parseInt(productId, 10)
        : undefined,
      salesmanId: salesmanId
        ? isNaN(Number(salesmanId))
          ? salesmanId
          : parseInt(salesmanId, 10)
        : undefined,
      dispatchId: dispatchId
        ? isNaN(Number(dispatchId))
          ? dispatchId
          : parseInt(dispatchId, 10)
        : undefined,
      serviceId: serviceId
        ? isNaN(Number(serviceId))
          ? serviceId
          : parseInt(serviceId, 10)
        : undefined,
      taxInvoice,
    };

    const result = await this.summaryService.getSummaryList(params);
    return createSuccessResponse({ data: result.data, pagination: result.pagination }, 200);
  }

  @Get('/stats')
  async getStats(
    @Query('clientId') clientId?: string,
    @Query('poStatus') poStatus?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('searchKey') searchKey?: string,
    @Query('searchTerm') searchTerm?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('categoryId') categoryId?: string,
    @Query('oemId') oemId?: string,
    @Query('productId') productId?: string,
    @Query('salesmanId') salesmanId?: string,
    @Query('dispatchId') dispatchId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('taxInvoice') taxInvoice?: string
  ): Promise<APIGatewayProxyResult> {
    const params: Omit<ListSummaryRequest, 'page' | 'limit'> = {
      clientId,
      poStatus,
      paymentStatus,
      assignedTo: assignedTo ? parseInt(assignedTo, 10) : undefined,
      searchKey: searchKey || undefined,
      searchTerm: searchTerm || undefined,
      dateFrom,
      dateTo,
      categoryId: categoryId
        ? isNaN(Number(categoryId))
          ? categoryId
          : parseInt(categoryId, 10)
        : undefined,
      oemId: oemId ? (isNaN(Number(oemId)) ? oemId : parseInt(oemId, 10)) : undefined,
      productId: productId
        ? isNaN(Number(productId))
          ? productId
          : parseInt(productId, 10)
        : undefined,
      salesmanId: salesmanId
        ? isNaN(Number(salesmanId))
          ? salesmanId
          : parseInt(salesmanId, 10)
        : undefined,
      dispatchId: dispatchId
        ? isNaN(Number(dispatchId))
          ? dispatchId
          : parseInt(dispatchId, 10)
        : undefined,
      serviceId: serviceId
        ? isNaN(Number(serviceId))
          ? serviceId
          : parseInt(serviceId, 10)
        : undefined,
      taxInvoice,
    };

    const result = await this.summaryService.getSummaryStats(params);
    return createSuccessResponse(result);
  }

  @Get('/export')
  async getExport(
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('clientId') clientId?: string,
    @Query('poStatus') poStatus?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('searchKey') searchKey?: string,
    @Query('searchTerm') searchTerm?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('pipelineStage') pipelineStage?: string,
    @Query('pipelineStatus') pipelineStatus?: string,
    @Query('categoryId') categoryId?: string,
    @Query('oemId') oemId?: string,
    @Query('productId') productId?: string,
    @Query('salesmanId') salesmanId?: string,
    @Query('dispatchId') dispatchId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('taxInvoice') taxInvoice?: string,
    @Query('columns') columns?: string
  ): Promise<APIGatewayProxyResult> {
    const params: Omit<ListSummaryRequest, 'page'> & { columns?: string } = {
      limit: limit ? parseInt(limit, 10) : 50,
      sortBy: sortBy || 'createdAt',
      sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
      clientId,
      poStatus,
      paymentStatus,
      assignedTo: assignedTo ? parseInt(assignedTo, 10) : undefined,
      searchKey: searchKey || undefined,
      searchTerm: searchTerm || undefined,
      dateFrom,
      dateTo,
      pipelineStage,
      pipelineStatus,
      categoryId: categoryId
        ? isNaN(Number(categoryId))
          ? categoryId
          : parseInt(categoryId, 10)
        : undefined,
      oemId: oemId ? (isNaN(Number(oemId)) ? oemId : parseInt(oemId, 10)) : undefined,
      productId: productId
        ? isNaN(Number(productId))
          ? productId
          : parseInt(productId, 10)
        : undefined,
      salesmanId: salesmanId
        ? isNaN(Number(salesmanId))
          ? salesmanId
          : parseInt(salesmanId, 10)
        : undefined,
      dispatchId: dispatchId
        ? isNaN(Number(dispatchId))
          ? dispatchId
          : parseInt(dispatchId, 10)
        : undefined,
      serviceId: serviceId
        ? isNaN(Number(serviceId))
          ? serviceId
          : parseInt(serviceId, 10)
        : undefined,
      taxInvoice,
      columns,
    };

    const csv = await this.summaryService.getSummaryExport(params);
    const filename = `order-summary-${new Date().toISOString().slice(0, 10)}.csv`;

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: csv,
    };
  }

  @Get('/report')
  async getReports(
    @Query('productId') productId?: string,
    @Query('oemId') oemId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('clientId') clientId?: string,
    @Query('salesPersonId') salesPersonId?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string
  ): Promise<APIGatewayProxyResult> {
    // At least one of productId, oemId, categoryId, clientId, salesPersonId, or purchaseOrderId must be provided
    if (!productId && !oemId && !categoryId && !clientId && !salesPersonId && !purchaseOrderId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error:
            'At least one of productId, oemId, categoryId, clientId, salesPersonId, or purchaseOrderId is required',
        }),
      };
    }

    const params: ProductReportRequest = {};

    // Parse and validate productId if provided
    if (productId) {
      const parsedProductId = parseInt(productId, 10);
      if (isNaN(parsedProductId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Invalid productId' }),
        };
      }
      params.productId = parsedProductId;
    }

    // Parse and validate oemId if provided
    if (oemId) {
      const parsedOemId = parseInt(oemId, 10);
      if (isNaN(parsedOemId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Invalid oemId' }),
        };
      }
      params.oemId = parsedOemId;
    }

    // Parse and validate categoryId if provided
    if (categoryId) {
      const parsedCategoryId = parseInt(categoryId, 10);
      if (isNaN(parsedCategoryId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Invalid categoryId' }),
        };
      }
      params.categoryId = parsedCategoryId;
    }

    // Parse and validate clientId if provided
    if (clientId) {
      const parsedClientId = parseInt(clientId, 10);
      if (isNaN(parsedClientId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Invalid clientId' }),
        };
      }
      params.clientId = parsedClientId;
    }

    // Parse and validate salesPersonId if provided
    if (salesPersonId) {
      const parsedSalesPersonId = parseInt(salesPersonId, 10);
      if (isNaN(parsedSalesPersonId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Invalid salesPersonId' }),
        };
      }
      params.salesPersonId = parsedSalesPersonId;
    }

    // Validate purchaseOrderId if provided (it's a string, no parsing needed)
    if (purchaseOrderId) {
      if (!purchaseOrderId.trim()) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Invalid purchaseOrderId' }),
        };
      }
      params.purchaseOrderId = purchaseOrderId.trim();
    }

    const result = await this.summaryService.getReports(params);
    return createSuccessResponse({ data: result.data }, 200);
  }
}
