import { injectable, inject } from 'inversify';
import { PrismaClient } from '@prisma/client';
import { TYPES } from '../types/types';
import { IPOService } from './POService';
import { CreatePORequest, POItemRequest } from '../schemas';
import { ValidationError } from '@arcforge/shared';
import { logger } from '@arcforge/shared';

type CsvRecord = Record<string, string>;

interface FieldError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface ImportCsvResult {
  totalGroups: number;
  created: Array<{
    poId: string;
    clientPoNo: string;
    clientPoDate: string;
    itemCount: number;
  }>;
  failed: Array<{
    clientPoNo: string;
    clientPoDate: string;
    rows: number[];
    errors: FieldError[];
  }>;
}

export interface IPOCsvImportService {
  importCsv(csvText: string, userId: number): Promise<ImportCsvResult>;
}

const REQUIRED_COLUMNS = [
  'salesPersonUsername',
  'clientName',
  'clientAddress',
  'clientContact',
  'clientGST',
  'osgPiNo',
  'osgPiDate',
  'clientPoNo',
  'clientPoDate',
  'poStatus',
  'noOfDispatch',
  'dispatchPlanDate',
  'siteLocation',
  'oscSupport',
  'paymentStatus',
  'assignDispatchToUsername',
  'assignServiceToUsername',
  'remarks',
  'categoryName',
  'oemName',
  'productName',
  'quantity',
  'spareQuantity',
  'pricePerUnit',
  'gstPercent',
  'warranty',
] as const;

const VALID_PO_STATUS = ['po_received', 'po_confirmed_phone', 'on_whatsapp', 'on_mail'];
const VALID_DISPATCH = ['single', 'multiple'];
const VALID_OSC_SUPPORT = ['yes', 'no', 'maybe'];
const VALID_PAYMENT_STATUS = [
  'advanced',
  'received',
  'pending',
  'cancelled',
  '15_dc',
  '30_dc',
  '45_dc',
  '60_dc',
  '15_lc',
  '30_lc',
  '45_lc',
  '60_lc',
  'pdc_15',
  'pdc_30',
  'pdc_45',
  'pdc_60',
];
const VALID_WARRANTY = Array.from({ length: 12 }, (_, i) =>
  i === 0 ? '1_year' : `${i + 1}_years`
);
const VALID_GST = [5, 9, 12, 15, 18];

// ---- CSV parsing helpers ----

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function parseCsv(csvText: string): CsvRecord[] {
  const text = csvText.replace(/^\uFEFF/, '').trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const records: CsvRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const rec: CsvRecord = {};
    headers.forEach((h, idx) => {
      rec[h] = values[idx] ?? '';
    });
    rec.__rowNumber = String(i + 1);
    records.push(rec);
  }

  return records;
}

// ---- Validation helpers (collect errors instead of throwing) ----

function rowNum(rec: CsvRecord): number {
  return parseInt(rec.__rowNumber || '0', 10);
}

function addError(errors: FieldError[], rec: CsvRecord, field: string, message: string): void {
  errors.push({
    row: rowNum(rec),
    field,
    value: (rec[field] ?? '').trim(),
    message,
  });
}

function getRequired(rec: CsvRecord, field: string, errors: FieldError[]): string {
  const v = (rec[field] ?? '').trim();
  if (!v) {
    addError(errors, rec, field, `Missing required field '${field}'`);
  }
  return v;
}

/**
 * Parse a date string. Accepts YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY.
 * Returns ISO date string (YYYY-MM-DD) or empty string on failure.
 */
function parseDate(rec: CsvRecord, field: string, errors: FieldError[]): string {
  const raw = (rec[field] ?? '').trim();
  if (!raw) {
    addError(errors, rec, field, `Missing required date field '${field}'`);
    return '';
  }

  // Try YYYY-MM-DD first
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(raw + 'T00:00:00Z');
    if (!isNaN(d.getTime())) return raw;
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const match = raw.match(/^(\d{1,2})[/\u002D](\d{1,2})[/\u002D](\d{4})$/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    const d = new Date(iso + 'T00:00:00Z');
    if (!isNaN(d.getTime())) return iso;
  }

  addError(errors, rec, field, `Invalid date '${raw}'. Use YYYY-MM-DD or DD/MM/YYYY format.`);
  return '';
}

function parseIntVal(rec: CsvRecord, field: string, min: number, errors: FieldError[]): number {
  const raw = (rec[field] ?? '').trim();
  if (!raw) {
    addError(errors, rec, field, `Missing required field '${field}'`);
    return 0;
  }
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < min) {
    addError(errors, rec, field, `Invalid integer '${raw}' (must be >= ${min})`);
    return 0;
  }
  return n;
}

function parseDecimalVal(rec: CsvRecord, field: string, min: number, errors: FieldError[]): number {
  const raw = (rec[field] ?? '').trim();
  if (!raw) {
    addError(errors, rec, field, `Missing required field '${field}'`);
    return 0;
  }
  const n = Number(raw);
  if (!isFinite(n) || n < min) {
    addError(errors, rec, field, `Invalid number '${raw}' (must be >= ${min})`);
    return 0;
  }
  return n;
}

function validateEnum(
  rec: CsvRecord,
  field: string,
  allowed: (string | number)[],
  errors: FieldError[]
): string {
  const raw = (rec[field] ?? '').trim();
  if (!raw) {
    addError(errors, rec, field, `Missing required field '${field}'`);
    return '';
  }
  const match = allowed.some((a) => String(a).toLowerCase() === raw.toLowerCase());
  if (!match) {
    addError(errors, rec, field, `Invalid value '${raw}'. Allowed: ${allowed.join(', ')}`);
    return '';
  }
  return raw;
}

// ---- Service ----

@injectable()
export class POCsvImportService implements IPOCsvImportService {
  constructor(
    @inject(TYPES.PrismaClient) private prisma: PrismaClient,
    @inject(TYPES.POService) private poService: IPOService
  ) {}

  async importCsv(csvText: string, userId: number): Promise<ImportCsvResult> {
    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      throw new ValidationError('CSV is empty or missing data rows');
    }

    const headers = Object.keys(rows[0]).filter((h) => !h.startsWith('__'));
    const missingColumns = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
    if (missingColumns.length > 0) {
      throw new ValidationError(`CSV missing required columns: ${missingColumns.join(', ')}`);
    }

    // Group by PO key
    const groups = new Map<string, CsvRecord[]>();
    for (const r of rows) {
      const clientPoNo = (r['clientPoNo'] ?? '').trim();
      const clientPoDate = (r['clientPoDate'] ?? '').trim();
      if (!clientPoNo || !clientPoDate) continue;
      const key = `${clientPoNo}__${clientPoDate}`;
      const arr = groups.get(key) || [];
      arr.push(r);
      groups.set(key, arr);
    }

    const created: ImportCsvResult['created'] = [];
    const failed: ImportCsvResult['failed'] = [];

    for (const [key, recs] of groups.entries()) {
      const [clientPoNo, clientPoDate] = key.split('__');
      const groupRows = recs.map((r) => rowNum(r));
      const groupErrors: FieldError[] = [];

      try {
        await this.processPoGroup(recs, clientPoNo, clientPoDate, userId, groupErrors, created);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error during import';
        groupErrors.push({
          row: groupRows[0],
          field: '_general',
          value: '',
          message: msg,
        });
        logger.error('CSV import: PO group failed', {
          clientPoNo,
          clientPoDate,
          error: msg,
        });
      }

      if (groupErrors.length > 0) {
        failed.push({
          clientPoNo,
          clientPoDate,
          rows: groupRows,
          errors: groupErrors,
        });
      }
    }

    logger.info('CSV import completed', {
      totalGroups: groups.size,
      created: created.length,
      failed: failed.length,
    });

    return {
      totalGroups: groups.size,
      created,
      failed,
    };
  }

  private async processPoGroup(
    recs: CsvRecord[],
    clientPoNo: string,
    clientPoDate: string,
    userId: number,
    errors: FieldError[],
    created: ImportCsvResult['created']
  ): Promise<void> {
    const base = recs[0];

    // ---- Validate PO header fields on first row ----
    const salesPersonUsername = getRequired(base, 'salesPersonUsername', errors);
    const clientName = getRequired(base, 'clientName', errors);
    const clientAddress = getRequired(base, 'clientAddress', errors);
    const clientContact = getRequired(base, 'clientContact', errors);
    const clientGST = (base['clientGST'] ?? '').trim() || null;

    const osgPiNo = getRequired(base, 'osgPiNo', errors);
    const osgPiDate = parseDate(base, 'osgPiDate', errors);
    const parsedClientPoDate = parseDate(base, 'clientPoDate', errors);
    const poStatus = validateEnum(base, 'poStatus', VALID_PO_STATUS, errors);
    const noOfDispatch = validateEnum(base, 'noOfDispatch', VALID_DISPATCH, errors);
    const dispatchPlanDate = parseDate(base, 'dispatchPlanDate', errors);
    const siteLocation = getRequired(base, 'siteLocation', errors);
    const oscSupport = validateEnum(base, 'oscSupport', VALID_OSC_SUPPORT, errors);
    const paymentStatus = validateEnum(base, 'paymentStatus', VALID_PAYMENT_STATUS, errors);

    // Optional fiscal year override (e.g. "2023-24"); defaults to current FY when empty
    const fiscalYearRaw = (base['fiscalYear'] ?? '').trim() || undefined;
    let fiscalYear: string | undefined;
    if (fiscalYearRaw) {
      if (/^\d{4}-\d{2}$/.test(fiscalYearRaw)) {
        fiscalYear = fiscalYearRaw;
      } else {
        addError(
          errors,
          base,
          'fiscalYear',
          `Invalid fiscal year '${fiscalYearRaw}'. Use YYYY-YY format (e.g. 2023-24).`
        );
      }
    }

    // Validate header consistency across group
    const headerFields = [
      'salesPersonUsername',
      'fiscalYear',
      'clientName',
      'clientAddress',
      'clientContact',
      'clientGST',
      'osgPiNo',
      'osgPiDate',
      'poStatus',
      'noOfDispatch',
      'dispatchPlanDate',
      'siteLocation',
      'oscSupport',
      'paymentStatus',
      'assignDispatchToUsername',
      'assignServiceToUsername',
      'remarks',
    ];
    for (const f of headerFields) {
      const baseVal = (base[f] ?? '').trim();
      for (const r of recs.slice(1)) {
        const v = (r[f] ?? '').trim();
        if (v !== baseVal) {
          addError(
            errors,
            r,
            f,
            `PO header mismatch: row ${rowNum(r)} has '${v}' but row ${rowNum(base)} has '${baseVal}'`
          );
        }
      }
    }

    // If we already have errors from header validation, bail early (don't hit DB)
    if (errors.length > 0) return;

    // Resolve sales person
    let salesPersonId: number | null = null;
    if (salesPersonUsername) {
      salesPersonId = await this.resolveUsername(
        salesPersonUsername,
        'salesPersonUsername',
        base,
        errors
      );
    }

    // Resolve optional assignment usernames
    let assignDispatchTo: number | null = null;
    let assignServiceTo: number | null = null;
    const assignDispatchToUsername = (base['assignDispatchToUsername'] ?? '').trim();
    const assignServiceToUsername = (base['assignServiceToUsername'] ?? '').trim();

    if (assignDispatchToUsername) {
      assignDispatchTo = await this.resolveUsername(
        assignDispatchToUsername,
        'assignDispatchToUsername',
        base,
        errors
      );
    }
    if (assignServiceToUsername) {
      assignServiceTo = await this.resolveUsername(
        assignServiceToUsername,
        'assignServiceToUsername',
        base,
        errors
      );
    }

    if (errors.length > 0) return;

    // Resolve client
    const client = await this.findOrCreateClient({
      clientName,
      clientAddress,
      clientContact,
      clientGST,
      userId,
    });

    // ---- Validate and build PO items ----
    const poItems: POItemRequest[] = [];
    for (const r of recs) {
      const categoryName = getRequired(r, 'categoryName', errors);
      const oemName = getRequired(r, 'oemName', errors);
      const productName = getRequired(r, 'productName', errors);
      const quantity = parseIntVal(r, 'quantity', 1, errors);
      const spareQuantityRaw = (r['spareQuantity'] ?? '').trim();
      const spareQuantity = spareQuantityRaw ? parseIntVal(r, 'spareQuantity', 0, errors) : 0;
      const pricePerUnit = parseDecimalVal(r, 'pricePerUnit', 0, errors);
      const gstPercent = parseDecimalVal(r, 'gstPercent', 0, errors);
      const warranty = validateEnum(r, 'warranty', VALID_WARRANTY, errors);

      if (gstPercent && !VALID_GST.includes(gstPercent)) {
        addError(
          errors,
          r,
          'gstPercent',
          `Invalid GST '${gstPercent}'. Allowed: ${VALID_GST.join(', ')}`
        );
      }

      // Don't proceed to DB lookups if basic validation failed
      if (errors.length > 0) continue;

      const category = await this.findOrCreateCategory(categoryName, userId);
      const oem = await this.findOrCreateOEM(oemName, userId);
      const product = await this.findOrCreateProduct(
        productName,
        category.categoryId,
        oem.oemId,
        userId
      );

      const totalQuantity = quantity + spareQuantity;
      const totalPrice = quantity * pricePerUnit;
      const finalPrice = Math.round((totalPrice + (totalPrice * gstPercent) / 100) * 100) / 100;

      poItems.push({
        categoryId: category.categoryId,
        oemId: oem.oemId,
        productId: product.productId,
        quantity,
        spareQuantity,
        totalQuantity,
        pricePerUnit,
        totalPrice,
        gstPercent,
        finalPrice,
        warranty,
      });
    }

    // If item-level errors, bail
    if (errors.length > 0) return;

    const req: CreatePORequest = {
      clientId: client.clientId,
      osgPiNo,
      osgPiDate,
      clientPoNo,
      clientPoDate: parsedClientPoDate,
      poStatus,
      noOfDispatch,
      assignDispatchTo: assignDispatchTo ?? undefined,
      assignServiceTo: assignServiceTo ?? undefined,
      clientAddress,
      clientContact,
      dispatchPlanDate,
      siteLocation,
      oscSupport,
      paymentStatus,
      remarks: (base['remarks'] ?? '').trim() || undefined,
      poItems,
      createdById: salesPersonId!,
      updatedById: salesPersonId!,
      fiscalYear,
    };

    logger.info('CSV import: creating PO', {
      clientPoNo,
      clientPoDate: parsedClientPoDate,
      itemCount: poItems.length,
    });

    const po = await this.poService.createPO(req);
    created.push({
      poId: po.poId,
      clientPoNo,
      clientPoDate: parsedClientPoDate,
      itemCount: poItems.length,
    });
  }

  private async resolveUsername(
    username: string,
    fieldName: string,
    rec: CsvRecord,
    errors: FieldError[]
  ): Promise<number | null> {
    const u = await this.prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { userId: true },
    });
    if (!u) {
      addError(
        errors,
        rec,
        fieldName,
        `Unknown username '${username}' — user does not exist in database`
      );
      return null;
    }
    return u.userId;
  }

  private async findOrCreateClient(args: {
    clientName: string;
    clientAddress: string;
    clientContact: string;
    clientGST: string | null;
    userId: number;
  }) {
    const existing = await this.prisma.client.findFirst({
      where: { clientName: { equals: args.clientName, mode: 'insensitive' } },
    });
    if (existing) {
      const shouldUpdate =
        (!existing.clientAddress && args.clientAddress) ||
        (!existing.clientContact && args.clientContact) ||
        (!existing.clientGST && args.clientGST);
      if (shouldUpdate) {
        return await this.prisma.client.update({
          where: { clientId: existing.clientId },
          data: {
            clientAddress: existing.clientAddress || args.clientAddress,
            clientContact: existing.clientContact || args.clientContact,
            clientGST: existing.clientGST || args.clientGST,
            updatedById: args.userId,
          },
        });
      }
      return existing;
    }
    return await this.prisma.client.create({
      data: {
        clientName: args.clientName,
        clientAddress: args.clientAddress,
        clientContact: args.clientContact,
        clientGST: args.clientGST,
        isActive: true,
        createdById: args.userId,
        updatedById: args.userId,
      },
    });
  }

  private async findOrCreateCategory(categoryName: string, userId: number) {
    const existing = await this.prisma.category.findFirst({
      where: { categoryName: { equals: categoryName, mode: 'insensitive' } },
    });
    if (existing) return existing;
    return await this.prisma.category.create({
      data: {
        categoryName,
        isActive: true,
        createdById: userId,
        updatedById: userId,
      },
    });
  }

  private async findOrCreateOEM(oemName: string, userId: number) {
    const existing = await this.prisma.oEM.findFirst({
      where: { oemName: { equals: oemName, mode: 'insensitive' } },
    });
    if (existing) return existing;
    return await this.prisma.oEM.create({
      data: {
        oemName,
        isActive: true,
        createdById: userId,
        updatedById: userId,
      },
    });
  }

  private async findOrCreateProduct(
    productName: string,
    categoryId: number,
    oemId: number,
    userId: number
  ) {
    const existing = await this.prisma.product.findFirst({
      where: {
        productName: { equals: productName, mode: 'insensitive' },
        categoryId,
        oemId,
      },
    });
    if (existing) return existing;
    return await this.prisma.product.create({
      data: {
        productName,
        isActive: true,
        categoryId,
        oemId,
        createdById: userId,
        updatedById: userId,
      },
    });
  }
}
