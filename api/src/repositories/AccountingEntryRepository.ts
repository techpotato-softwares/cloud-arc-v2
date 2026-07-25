/**
 * Accounting Entry Repository
 *
 * Data access layer for accounting entry operations using Prisma ORM.
 * Covers: Sales & Invoice, Payment & Collection, Dispatch Costs,
 * Commissioning Costs, Credit Notes.
 */

import { injectable, inject } from 'inversify';
import { PrismaClient, AccountingEntry, Prisma, User } from '@prisma/client';
import { TYPES } from '../types/types';
import {
  CreateAccountingEntryRequest,
  UpdateAccountingEntryRequest,
  ListAccountingEntryRequest,
} from '../schemas';

export type AccountingEntryWithRelations = AccountingEntry & {
  createdBy: User | null;
  updatedBy: User | null;
};

type AccountingEntryCreateData = Prisma.AccountingEntryUncheckedCreateInput & {
  paymentType?: string | null;
};

type AccountingEntryUpdateData = Prisma.AccountingEntryUncheckedUpdateInput & {
  paymentType?: string | null;
};

export interface IAccountingEntryRepository {
  create(data: CreateAccountingEntryRequest): Promise<AccountingEntryWithRelations>;
  findById(id: number): Promise<AccountingEntryWithRelations | null>;
  findAll(
    params: ListAccountingEntryRequest
  ): Promise<{ rows: AccountingEntryWithRelations[]; count: number }>;
  findByPoId(poId: string, moduleType?: string): Promise<AccountingEntryWithRelations[]>;
  update(
    id: number,
    data: UpdateAccountingEntryRequest
  ): Promise<AccountingEntryWithRelations | null>;
  delete(id: number): Promise<boolean>;
}

@injectable()
export class AccountingEntryRepository implements IAccountingEntryRepository {
  constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {}

  private readonly includeRelations = {
    createdBy: true,
    updatedBy: true,
  };

  /** Pass through number/string for Prisma Decimal fields; avoids Prisma.Decimal constructor issues in some runtimes */
  private toDecimal(value?: number | string | null): number | string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') return value.trim() === '' ? undefined : value;
    if (typeof value === 'number') return Number.isNaN(value) ? undefined : value;
    return undefined;
  }

  async create(data: CreateAccountingEntryRequest): Promise<AccountingEntryWithRelations> {
    const entry = await this.prisma.accountingEntry.create({
      data: {
        poId: data.poId,
        moduleType: data.moduleType || 'order',
        dispatchId: data.dispatchId,
        serviceId: data.serviceId,

        taxInvoiceNo: data.taxInvoiceNo,
        taxInvoiceDate: data.taxInvoiceDate ? new Date(data.taxInvoiceDate) : undefined,
        invoiceAmount: this.toDecimal(data.invoiceAmount),
        paymentMode: data.paymentMode,
        multiplePaymentRefNo: data.multiplePaymentRefNo,

        paymentType: data.paymentType,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : undefined,
        paymentDueDate: data.paymentDueDate ? new Date(data.paymentDueDate) : undefined,
        paymentAmount: this.toDecimal(data.paymentAmount),
        tds: this.toDecimal(data.tds) ?? 0, // 0 when not applicable (e.g. Advance, Credit Note)
        balanceAmount: this.toDecimal(data.balanceAmount),
        noDuesClearanceStatus: data.noDuesClearanceStatus,

        dispatchExpenses: this.toDecimal(data.dispatchExpenses),
        dispatchExpensesRemark: data.dispatchExpensesRemark,

        commissioningExpenses: this.toDecimal(data.commissioningExpenses),
        commissioningExpensesRemark: data.commissioningExpensesRemark,

        creditNoteRef: data.creditNoteRef,
        creditNoteRemark: data.creditNoteRemark,

        createdById: data.createdById,
        updatedById: data.updatedById,
      } as AccountingEntryCreateData,
      include: this.includeRelations,
    });

    return entry as AccountingEntryWithRelations;
  }

  async findById(id: number): Promise<AccountingEntryWithRelations | null> {
    const entry = await this.prisma.accountingEntry.findUnique({
      where: { id },
      include: this.includeRelations,
    });
    return entry as AccountingEntryWithRelations | null;
  }

  async findAll(
    params: ListAccountingEntryRequest
  ): Promise<{ rows: AccountingEntryWithRelations[]; count: number }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      poId,
      moduleType,
      dispatchId,
      serviceId,
    } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.AccountingEntryWhereInput = {};
    if (poId) where.poId = poId;
    if (moduleType) where.moduleType = moduleType;
    if (dispatchId) where.dispatchId = dispatchId;
    if (serviceId) where.serviceId = serviceId;

    const orderByField = sortBy as keyof Prisma.AccountingEntryOrderByWithRelationInput;
    const orderBy: Prisma.AccountingEntryOrderByWithRelationInput = {
      [orderByField]: sortOrder.toLowerCase() as Prisma.SortOrder,
    };

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.accountingEntry.findMany({
        where,
        include: this.includeRelations,
        orderBy,
        take: limit,
        skip,
      }),
      this.prisma.accountingEntry.count({ where }),
    ]);

    return { rows: rows as AccountingEntryWithRelations[], count };
  }

  async findByPoId(poId: string, moduleType?: string): Promise<AccountingEntryWithRelations[]> {
    const where: Prisma.AccountingEntryWhereInput = { poId };
    if (moduleType) where.moduleType = moduleType;

    const entries = await this.prisma.accountingEntry.findMany({
      where,
      include: this.includeRelations,
      orderBy: { createdAt: 'desc' },
    });
    return entries as AccountingEntryWithRelations[];
  }

  async update(
    id: number,
    data: UpdateAccountingEntryRequest
  ): Promise<AccountingEntryWithRelations | null> {
    const existing = await this.prisma.accountingEntry.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: AccountingEntryUpdateData = {};

    if (data.updatedById !== undefined) updateData.updatedById = data.updatedById;

    if (data.taxInvoiceNo !== undefined) updateData.taxInvoiceNo = data.taxInvoiceNo;
    if (data.taxInvoiceDate !== undefined)
      updateData.taxInvoiceDate = data.taxInvoiceDate ? new Date(data.taxInvoiceDate) : null;
    if (data.invoiceAmount !== undefined)
      updateData.invoiceAmount = this.toDecimal(data.invoiceAmount) ?? null;
    if (data.paymentMode !== undefined) updateData.paymentMode = data.paymentMode;
    if (data.multiplePaymentRefNo !== undefined)
      updateData.multiplePaymentRefNo = data.multiplePaymentRefNo;

    if (data.paymentType !== undefined) updateData.paymentType = data.paymentType;
    if (data.paymentDate !== undefined)
      updateData.paymentDate = data.paymentDate ? new Date(data.paymentDate) : null;
    if (data.paymentDueDate !== undefined)
      updateData.paymentDueDate = data.paymentDueDate ? new Date(data.paymentDueDate) : null;
    if (data.paymentAmount !== undefined)
      updateData.paymentAmount = this.toDecimal(data.paymentAmount) ?? null;
    if (data.tds !== undefined) updateData.tds = this.toDecimal(data.tds) ?? 0; // 0 when not applicable
    if (data.balanceAmount !== undefined)
      updateData.balanceAmount = this.toDecimal(data.balanceAmount) ?? null;
    if (data.noDuesClearanceStatus !== undefined)
      updateData.noDuesClearanceStatus = data.noDuesClearanceStatus;

    if (data.dispatchExpenses !== undefined)
      updateData.dispatchExpenses = this.toDecimal(data.dispatchExpenses) ?? null;
    if (data.dispatchExpensesRemark !== undefined)
      updateData.dispatchExpensesRemark = data.dispatchExpensesRemark;

    if (data.commissioningExpenses !== undefined)
      updateData.commissioningExpenses = this.toDecimal(data.commissioningExpenses) ?? null;
    if (data.commissioningExpensesRemark !== undefined)
      updateData.commissioningExpensesRemark = data.commissioningExpensesRemark;

    if (data.creditNoteRef !== undefined) updateData.creditNoteRef = data.creditNoteRef;
    if (data.creditNoteRemark !== undefined) updateData.creditNoteRemark = data.creditNoteRemark;

    await this.prisma.accountingEntry.update({ where: { id }, data: updateData });
    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.accountingEntry.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }
}
