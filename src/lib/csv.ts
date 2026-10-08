/**
 * RFC 4180 Compliant CSV Parser and Serializer for CampusPlace
 * Supports quoted fields, escaped quotes, multi-line values, and CRLF / LF.
 */

export interface CsvParseOptions {
  trimFields?: boolean;
}

/**
 * Parses raw CSV text into an array of records (header -> value map).
 */
export function parseCsv(csvText: string, options: CsvParseOptions = { trimFields: true }): Record<string, string>[] {
  const lines = splitCsvRows(csvText);
  if (lines.length === 0) return [];

  const headers = lines[0].map((h) => (options.trimFields ? h.trim() : h));
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    // Skip empty lines at end
    if (row.length === 1 && row[0].trim() === '') continue;

    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const val = row[j] ?? '';
      record[headers[j]] = options.trimFields ? val.trim() : val;
    }
    records.push(record);
  }

  return records;
}

/**
 * Splits CSV string into 2D array of strings respecting quotes and escaped quotes.
 */
export function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  let i = 0;
  while (i < text.length) {
    const char = text[i];

    if (char === '"') {
      if (insideQuotes && text[i + 1] === '"') {
        // Escaped double quote
        currentField += '"';
        i += 2;
        continue;
      } else {
        // Toggle quote mode
        insideQuotes = !insideQuotes;
        i++;
        continue;
      }
    }

    if (!insideQuotes && char === ',') {
      currentRow.push(currentField);
      currentField = '';
      i++;
      continue;
    }

    if (!insideQuotes && (char === '\r' || char === '\n')) {
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      i++;
      continue;
    }

    currentField += char;
    i++;
  }

  // Push trailing record if present
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Sanitizes fields against CSV / Spreadsheet formula injection.
 * Any value starting with =, +, -, @, \t, or \r is prefixed with a single quote.
 */
export function sanitizeCsvFormulaInjection(val: string): string {
  if (!val || typeof val !== 'string') return val;
  const firstChar = val.charAt(0);
  if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@' || firstChar === '\t' || firstChar === '\r') {
    return `'${val}`;
  }
  return val;
}

/**
 * Escapes a single CSV field value per RFC 4180 rules and formula injection protection.
 */
export function escapeCsvField(field: string, sanitizeFormulas = true): string {
  const val = sanitizeFormulas ? sanitizeCsvFormulaInjection(field) : field;
  if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Converts array of records into RFC 4180 CSV string.
 */
export function serializeCsv(
  headers: { key: string; label: string }[],
  data: Record<string, unknown>[],
  options: { sanitizeFormulas?: boolean } = { sanitizeFormulas: true }
): string {
  const headerLine = headers.map((h) => escapeCsvField(h.label, false)).join(',');
  const lines: string[] = [headerLine];

  for (const row of data) {
    const rowLine = headers
      .map((h) => {
        const val = row[h.key];
        if (val === null || val === undefined) return '';
        if (val instanceof Date) return val.toISOString().split('T')[0];
        return escapeCsvField(String(val), options.sanitizeFormulas ?? true);
      })
      .join(',');
    lines.push(rowLine);
  }

  return lines.join('\r\n');
}
