/**
 * csv-import.service.ts — CSV bulk import for the Bogotá venue catalog.
 *
 * Expected CSV format (comma-separated, UTF-8, no BOM):
 *   name,type,address,phone,lat,lng,rating,description,mapsUrl,reservationUrl
 *
 * Row 0 is the header row and is skipped.
 * Each data row is validated with CreateVenueSchema.safeParse().
 * Valid rows are bulk-inserted (skip duplicates by name+address).
 * Invalid rows are collected and returned in the `errors` array — not blocking.
 *
 * Admin note: use comma separator (not semicolon). This is the international CSV
 * format. If exporting from Excel on a Spanish-locale machine (which defaults to
 * semicolons), change the separator in the export options before uploading.
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateVenueSchema } from '../dto/create-venue.dto';
import { ConciergeAdminRepository } from './concierge-admin.repository';

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: Array<{ row: number; issues: unknown[] }>;
}

// Ordered column names — must match the CSV header row exactly (case-insensitive)
const CSV_COLUMNS = [
  'name',
  'type',
  'address',
  'phone',
  'lat',
  'lng',
  'rating',
  'description',
  'mapsUrl',
  'reservationUrl',
] as const;

@Injectable()
export class CsvImportService {
  constructor(private readonly repo: ConciergeAdminRepository) {}

  /**
   * importCsv — parse and import venues from a CSV string.
   *
   * @param content - Raw UTF-8 CSV string from multipart upload
   * @returns { inserted, skipped, errors } — per-row error details for invalid rows
   */
  async importCsv(content: string): Promise<ImportResult> {
    const lines = content
      .replaceAll(/\r\n/g, '\n')
      .replaceAll(/\r/g, '\n')
      .split('\n')
      .filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV must have a header row and at least one data row');
    }

    // Skip header row (index 0), process data rows starting at index 1
    const dataRows = lines.slice(1);
    const validRows: ReturnType<typeof CreateVenueSchema.parse>[] = [];
    const errors: ImportResult['errors'] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const line = dataRows[i].trim();
      if (!line) continue;

      const cells = parseCsvLine(line);
      const rawObj: Record<string, unknown> = {};

      for (let col = 0; col < CSV_COLUMNS.length; col++) {
        const value = cells[col]?.trim() ?? '';
        if (value === '') continue;
        rawObj[CSV_COLUMNS[col]] = value;
      }

      // Coerce numeric fields
      if (rawObj.lat != null) rawObj.lat = Number(rawObj.lat);
      if (rawObj.lng != null) rawObj.lng = Number(rawObj.lng);
      if (rawObj.rating != null) {
        const r = Number(rawObj.rating);
        rawObj.rating = Number.isNaN(r) ? undefined : r;
      }

      const result = CreateVenueSchema.safeParse(rawObj);
      if (!result.success) {
        errors.push({ row: i + 2, issues: result.error.issues }); // +2: header + 1-based index
        continue;
      }
      validRows.push(result.data);
    }

    // Bulk insert valid rows
    const { inserted, skipped } = await this.repo.bulkCreateSkipDuplicates(validRows);
    return { inserted, skipped, errors };
  }
}

/**
 * parseCsvLine — split a CSV line on commas, respecting double-quoted fields.
 *
 * Basic RFC 4180 compliance: quoted fields may contain commas and escaped quotes ("").
 */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}
