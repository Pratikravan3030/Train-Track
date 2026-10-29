import ExcelJS from 'exceljs';
import { sanitizeCsvFormulaInjection } from './csv';

export interface ExcelColumnDef {
  header: string;
  key: string;
  width?: number;
}

export interface GenerateExcelOptions {
  title?: string;
  sheetName?: string;
  columns: ExcelColumnDef[];
  data: Record<string, unknown>[];
  summaryCards?: { label: string; value: string | number }[];
}

/**
 * Generates an Excel workbook buffer using exceljs with complete formula injection safety,
 * institutional headers, and cell formatting.
 */
export async function generateExcelBuffer(options: GenerateExcelOptions): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CampusPlace - DYPCET T&P';
  workbook.lastModifiedBy = 'CampusPlace Report Engine';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(options.sheetName || 'Report', {
    views: [{ showGridLines: true }],
  });

  let currentRowIdx = 1;

  // Title block if provided
  if (options.title) {
    const titleRow = worksheet.getRow(currentRowIdx);
    titleRow.values = [options.title];
    titleRow.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Deep Blue
    };
    titleRow.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    titleRow.height = 32;
    currentRowIdx += 2; // leave a blank row
  }

  // Summary Metrics block if provided
  if (options.summaryCards && options.summaryCards.length > 0) {
    for (const card of options.summaryCards) {
      const summaryRow = worksheet.getRow(currentRowIdx);
      summaryRow.values = [card.label, card.value];
      summaryRow.font = { name: 'Arial', size: 10, bold: true };
      currentRowIdx++;
    }
    currentRowIdx++; // blank separator row
  }

  // Header row
  const headerRow = worksheet.getRow(currentRowIdx);
  headerRow.values = options.columns.map((c) => c.header);
  headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' }, // Brand Blue
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;
  currentRowIdx++;

  // Set column widths
  options.columns.forEach((col, idx) => {
    const column = worksheet.getColumn(idx + 1);
    column.width = col.width || Math.max(col.header.length + 4, 14);
  });

  // Data rows
  for (const record of options.data) {
    const row = worksheet.getRow(currentRowIdx);
    const rowValues = options.columns.map((col) => {
      const val = record[col.key];
      if (val === null || val === undefined) return '';
      if (val instanceof Date) return val.toISOString().split('T')[0];
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val ? 'Yes' : 'No';

      // Formula injection safety for strings
      const strVal = String(val);
      return sanitizeCsvFormulaInjection(strVal);
    });

    row.values = rowValues;
    row.font = { name: 'Arial', size: 10 };
    row.alignment = { vertical: 'middle' };
    row.height = 20;

    // Light border
    row.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    currentRowIdx++;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
