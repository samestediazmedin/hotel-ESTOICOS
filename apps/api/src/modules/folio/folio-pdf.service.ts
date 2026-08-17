import { Injectable, BadRequestException } from '@nestjs/common';
import * as React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { FolioPdfDocument } from './pdf/FolioPdfDocument';
import { FolioService } from './folio.service';
import { GuestEncryptionService } from '../guests/encryption/guest-encryption.service';

/** Sentinel value for guests who have invoked their erasure right (Ley 1581). */
const ANONYMIZED_SENTINEL = '[ANONYMIZED]';

/**
 * FolioPdfService — generates on-demand PDF "Estado de Cuenta" for settled folios.
 *
 * Design decisions (04-03 PLAN):
 *  - On-demand only (no R2 storage in v1) — generate fresh Buffer per request.
 *  - SETTLED folios only — requires snapshotHash (set by closeFolio at check-out).
 *    Open folio → BadRequestException (belt-and-suspenders with UI disabled button).
 *  - documentNumber decrypted here (not in PDF component) — separation of concerns.
 *    ANONYMIZED sentinel passed through as-is (guest erasure right, Ley 1581).
 *  - Uses React.createElement (not JSX) to call FolioPdfDocument — avoids any
 *    JSX transform issues at runtime in Node.js.
 */
@Injectable()
export class FolioPdfService {
  constructor(
    private readonly folioService: FolioService,
    private readonly guestEncryption: GuestEncryptionService,
  ) {}

  /**
   * generateFolioPdf — renders a PDF Buffer for the given folio.
   *
   * @param folioId — UUID of the folio to render
   * @returns Promise<Buffer> — PDF binary buffer starting with %PDF- magic bytes
   * @throws BadRequestException if folio snapshotHash is null (not yet SETTLED)
   * @throws NotFoundException if folio does not exist (propagated from getFolioForPdf)
   */
  async generateFolioPdf(folioId: string): Promise<Buffer> {
    const folio = await this.folioService.getFolioForPdf(folioId);

    // Belt-and-suspenders guard: PDF only for SETTLED folios (snapshotHash proves settlement)
    if (!folio.snapshotHash) {
      throw new BadRequestException(
        `Folio ${folioId} must be SETTLED before generating a PDF. ` +
        `Complete check-out first to close the folio.`,
      );
    }

    const reservation = folio.reservation;
    const guest = reservation.guest;

    // Decrypt documentNumber unless guest is anonymized (Ley 1581 erasure right)
    const decryptedDocNumber =
      guest.documentNumber === ANONYMIZED_SENTINEL
        ? ANONYMIZED_SENTINEL
        : this.guestEncryption.decrypt(guest.documentNumber);

    // Build props for the PDF template
    const docProps = {
      folio: {
        id: folio.id,
        snapshotHash: folio.snapshotHash,
        snapshotTotal: folio.snapshotTotal,
      },
      items: (folio.items as any[]).map((i) => ({
        id: i.id,
        type: i.type,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        amount: i.amount,
        taxRate: i.taxRate,
        taxAmount: i.taxAmount,
        businessDate: i.businessDate,
        voidedByEntryId: i.voidedByEntryId,
        postedAt: i.postedAt,
      })),
      reservation: {
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        room: reservation.room ? { number: reservation.room.number } : null,
      },
      guest: {
        fullName: guest.fullName,
        documentType: guest.documentType,
        documentNumber: decryptedDocNumber,
      },
    };

    // React.createElement avoids JSX transform dependency at runtime.
    // Cast to 'any' is required: renderToBuffer expects ReactElement<DocumentProps>
    // but our component returns DocumentProps-compatible JSX — types are structurally
    // compatible at runtime, just not reflected by TS's stricter nominal check here.
    const element = React.createElement(FolioPdfDocument, docProps) as any;
    return renderToBuffer(element);
  }
}
