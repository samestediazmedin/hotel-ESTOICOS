/**
 * csv-import.service.spec.ts — Tests for CsvImportService.
 *
 * Tests: happy path import, invalid row reporting, duplicate skipping.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { CsvImportService } from './csv-import.service';
import { ConciergeAdminRepository } from './concierge-admin.repository';

const HEADER = 'name,type,address,phone,lat,lng,rating,description,mapsUrl,reservationUrl';

describe('CsvImportService', () => {
  let svc: CsvImportService;
  let bulkCreateMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    bulkCreateMock = vi.fn().mockResolvedValue({ inserted: 2, skipped: 0 });

    const moduleRef = await Test.createTestingModule({
      providers: [
        CsvImportService,
        {
          provide: ConciergeAdminRepository,
          useValue: { bulkCreateSkipDuplicates: bulkCreateMock },
        },
      ],
    }).compile();

    svc = moduleRef.get(CsvImportService);
  });

  // Test 1: happy path — 2 valid rows imported
  it('imports 2 valid rows and returns inserted=2 errors=[]', async () => {
    const csv =
      HEADER +
      '\n' +
      'Museo del Oro,MUSEUM,Cra 6 #15-88,,4.5981,-74.0762,4.5,El museo mas famoso de Colombia,,\n' +
      'Parque Simón Bolívar,PARK,Carrera 50,,4.6588,-74.0936,4.8,,,\n';

    const result = await svc.importCsv(csv);
    expect(result.inserted).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(bulkCreateMock).toHaveBeenCalledTimes(1);
    const rows = bulkCreateMock.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Museo del Oro');
    expect(rows[0].type).toBe('MUSEUM');
    expect(rows[0].lat).toBe(4.5981);
  });

  // Test 2: invalid row (bad lat — not a number in range)
  it('reports error for row with invalid lat and does not insert it', async () => {
    bulkCreateMock.mockResolvedValue({ inserted: 1, skipped: 0 });
    const csv =
      HEADER +
      '\n' +
      'Valid Venue,CAFE,,, 4.5,-74.0,,,, \n' +
      'Bad Venue,BAR,,,not_a_number,-74.0,,,,\n';

    const result = await svc.importCsv(csv);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3); // header=1, row1=2, row2=3
    expect(result.inserted).toBe(1);
  });

  // Test 3: duplicate row is skipped (returned by bulkCreate)
  it('returns skipped count when bulkCreateSkipDuplicates reports duplicates', async () => {
    bulkCreateMock.mockResolvedValue({ inserted: 1, skipped: 1 });
    const csv =
      HEADER +
      '\n' +
      'Venue A,MUSEUM,,, 4.5,-74.0,,,, \n' +
      'Venue A,MUSEUM,,, 4.5,-74.0,,,, \n'; // duplicate

    const result = await svc.importCsv(csv);
    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(1);
  });

  // Test 4: CSV with fewer than 2 lines throws BadRequest
  it('throws BadRequestException when CSV has only a header row', async () => {
    const { BadRequestException } = await import('@nestjs/common');
    await expect(svc.importCsv(HEADER)).rejects.toThrow(BadRequestException);
  });
});
