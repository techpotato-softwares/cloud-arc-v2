/**
 * Accounting Entry Service
 *
 * Business logic layer for accounting entry operations.
 * balanceAmount is computed on the backend: running balance = Total PO Cost
 * minus paymentAmount (plus tds for part payments) per entry, in entry order.
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import {
  IAccountingEntryRepository,
  AccountingEntryWithRelations,
} from '../repositories/AccountingEntryRepository';
import { IPOService } from './POService';
import {
  CreateAccountingEntryRequest,
  UpdateAccountingEntryRequest,
  ListAccountingEntryRequest,
  AccountingEntryResponse,
  AccountingEntryListResponse,
} from '../schemas';

export interface IAccountingEntryService {
  createEntry(data: CreateAccountingEntryRequest): Promise<AccountingEntryResponse>;
  getEntryById(id: number): Promise<AccountingEntryResponse | null>;
  getAllEntries(params: ListAccountingEntryRequest): Promise<AccountingEntryListResponse>;
  getEntriesByPoId(poId: string, moduleType?: string): Promise<AccountingEntryResponse[]>;
  updateEntry(
    id: number,
    data: UpdateAccountingEntryRequest
  ): Promise<AccountingEntryResponse | null>;
  deleteEntry(id: number): Promise<boolean>;
}

/** Entry-like shape for balance computation (DB or request payload) */
type EntryLike = {
  id?: number;
  paymentType?: unknown;
  paymentAmount?: unknown;
  tds?: unknown;
};

@injectable()
export class AccountingEntryService implements IAccountingEntryService {
  constructor(
    @inject(TYPES.AccountingEntryRepository)
    private accountingEntryRepository: IAccountingEntryRepository,
    @inject(TYPES.POService)
    private poService: IPOService
  ) {}

  /** Parse number from DB Decimal or request number */
  private toNum(v: unknown): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'object' && v !== null && 'toString' in v) return parseFloat(String(v)) || 0;
    return parseFloat(String(v)) || 0;
  }

  /**
   * Amount that reduces PO balance for this entry:
   * For payment entries: Advance / Part Payment / Credit Note all use paymentAmount.
   * For Part Payment, TDS is also considered as part of amount applied.
   */
  private getAmountApplied(entry: EntryLike): number {
    const type = String(entry.paymentType || '').toLowerCase();
    const amount = this.toNum(entry.paymentAmount);
    if (amount <= 0) return 0;
    if (type === 'part_payment') {
      return amount + this.toNum(entry.tds);
    }
    // advance or credit_note (or unknown but with amount) – just paymentAmount
    return amount;
  }

  private async getTotalPoCost(poId: string): Promise<number> {
    const po = await this.poService.getPOById(poId);
    return po?.totalPoCost ?? 0;
  }

  /**
   * Compute balanceAmount for each payment entry in order.
   * Returns a map: entry id -> balance after that entry.
   * For create, newEntry has no id; for update, use updatedPayload for the given updatedEntryId.
   */
  private async computeBalanceAmounts(
    poId: string,
    existingEntries: AccountingEntryWithRelations[],
    options: {
      newEntry?: CreateAccountingEntryRequest;
      updatedEntryId?: number;
      updatedEntryPayload?: UpdateAccountingEntryRequest;
    } = {}
  ): Promise<Map<number | 'new', number>> {
    const totalPoCost = await this.getTotalPoCost(poId);
    const { newEntry, updatedEntryId, updatedEntryPayload } = options;

    const ordered: { id: number | 'new'; entry: EntryLike }[] = existingEntries
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((e) => ({
        id: e.id,
        entry:
          updatedEntryId !== undefined && e.id === updatedEntryId && updatedEntryPayload
            ? updatedEntryPayload
            : e,
      }));

    if (newEntry) {
      ordered.push({ id: 'new', entry: newEntry });
    }

    const result = new Map<number | 'new', number>();
    let running = totalPoCost;
    for (const { id, entry } of ordered) {
      running = Math.max(0, running - this.getAmountApplied(entry));
      result.set(id, running);
    }
    return result;
  }

  private formatDate(date: Date | null | undefined): string | undefined {
    if (!date) return undefined;
    return date.toISOString().split('T')[0];
  }

  private formatDecimal(value: object | null | undefined): string | undefined {
    if (value === null || value === undefined) return undefined;
    return value.toString();
  }

  private mapToResponse(entry: AccountingEntryWithRelations): AccountingEntryResponse {
    return {
      id: entry.id,
      poId: entry.poId,
      moduleType: entry.moduleType,

      dispatchId: entry.dispatchId ?? undefined,
      serviceId: entry.serviceId ?? undefined,

      taxInvoiceNo: entry.taxInvoiceNo ?? undefined,
      taxInvoiceDate: this.formatDate(entry.taxInvoiceDate),
      invoiceAmount: this.formatDecimal(entry.invoiceAmount),
      paymentMode: entry.paymentMode ?? undefined,
      multiplePaymentRefNo: entry.multiplePaymentRefNo ?? undefined,

      paymentDate: this.formatDate(entry.paymentDate),
      paymentDueDate: this.formatDate(entry.paymentDueDate),
      paymentType: entry.paymentType ?? undefined,
      paymentAmount: this.formatDecimal(entry.paymentAmount),
      tds: this.formatDecimal(entry.tds),
      balanceAmount: this.formatDecimal(entry.balanceAmount),
      noDuesClearanceStatus: entry.noDuesClearanceStatus ?? undefined,

      dispatchExpenses: this.formatDecimal(entry.dispatchExpenses),
      dispatchExpensesRemark: entry.dispatchExpensesRemark ?? undefined,

      commissioningExpenses: this.formatDecimal(entry.commissioningExpenses),
      commissioningExpensesRemark: entry.commissioningExpensesRemark ?? undefined,

      creditNoteRef: entry.creditNoteRef ?? undefined,
      creditNoteRemark: entry.creditNoteRemark ?? undefined,

      createdById: entry.createdById ?? undefined,
      createdBy: entry.createdBy?.username,
      updatedById: entry.updatedById ?? undefined,
      updatedBy: entry.updatedBy?.username,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  async createEntry(data: CreateAccountingEntryRequest): Promise<AccountingEntryResponse> {
    const existing = await this.accountingEntryRepository.findByPoId(data.poId, data.moduleType);
    const balances = await this.computeBalanceAmounts(data.poId, existing, { newEntry: data });
    const balanceAmount = balances.get('new');
    const payload = balanceAmount !== undefined ? { ...data, balanceAmount } : data;
    const entry = await this.accountingEntryRepository.create(payload);
    return this.mapToResponse(entry);
  }

  async getEntryById(id: number): Promise<AccountingEntryResponse | null> {
    const entry = await this.accountingEntryRepository.findById(id);
    return entry ? this.mapToResponse(entry) : null;
  }

  async getAllEntries(params: ListAccountingEntryRequest): Promise<AccountingEntryListResponse> {
    const { page = 1, limit = 20 } = params;
    const { rows, count } = await this.accountingEntryRepository.findAll(params);
    return {
      data: rows.map((e) => this.mapToResponse(e)),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getEntriesByPoId(poId: string, moduleType?: string): Promise<AccountingEntryResponse[]> {
    const entries = await this.accountingEntryRepository.findByPoId(poId, moduleType);
    return entries.map((e) => this.mapToResponse(e));
  }

  async updateEntry(
    id: number,
    data: UpdateAccountingEntryRequest
  ): Promise<AccountingEntryResponse | null> {
    const existing = await this.accountingEntryRepository.findById(id);
    if (!existing) return null;
    const allEntries = await this.accountingEntryRepository.findByPoId(
      existing.poId,
      existing.moduleType
    );
    const balances = await this.computeBalanceAmounts(existing.poId, allEntries, {
      updatedEntryId: id,
      updatedEntryPayload: data,
    });
    const balanceAmount = balances.get(id);
    const payload = balanceAmount !== undefined ? { ...data, balanceAmount } : data;
    const updated = await this.accountingEntryRepository.update(id, payload);
    if (!updated) return null;
    const sorted = allEntries.slice().sort((a, b) => a.id - b.id);
    const thisIndex = sorted.findIndex((e) => e.id === id);
    for (let i = thisIndex + 1; i < sorted.length; i++) {
      const nextId = sorted[i].id;
      const nextBalance = balances.get(nextId);
      if (nextBalance !== undefined) {
        await this.accountingEntryRepository.update(nextId, { balanceAmount: nextBalance });
      }
    }
    return this.mapToResponse(updated);
  }

  async deleteEntry(id: number): Promise<boolean> {
    return this.accountingEntryRepository.delete(id);
  }
}
