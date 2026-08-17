import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { formatCOP } from './format-cop';

// ─── Styles ───────────────────────────────────────────────────────────────────
// StyleSheet.create must be a top-level constant — NOT inside render (react-pdf constraint)

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    padding: 40,
    fontSize: 10,
    color: '#1a1a1a',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 10,
    color: '#555',
    marginBottom: 16,
  },
  divider: {
    borderBottom: '1pt solid #e0e0e0',
    marginVertical: 10,
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  infoKey: {
    width: '35%',
    color: '#555',
  },
  infoValue: {
    width: '65%',
    fontFamily: 'Helvetica-Bold',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderBottom: '1pt solid #ccc',
    paddingVertical: 5,
    paddingHorizontal: 4,
    marginTop: 12,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#555',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #ebebeb',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableRowVoided: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #ebebeb',
    paddingVertical: 4,
    paddingHorizontal: 4,
    color: '#aaa',
    textDecoration: 'line-through',
  },
  colDate: { width: '13%' },
  colDesc: { width: '38%' },
  colQty: { width: '6%', textAlign: 'right' },
  colUnit: { width: '14%', textAlign: 'right' },
  colIva: { width: '8%', textAlign: 'right' },
  colTotal: { width: '14%', textAlign: 'right' },
  totalsSection: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 3,
  },
  totalsLabel: {
    width: 90,
    textAlign: 'right',
    color: '#555',
    paddingRight: 8,
  },
  totalsValue: {
    width: 90,
    textAlign: 'right',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    borderTop: '1pt solid #ccc',
    paddingTop: 4,
  },
  grandTotalLabel: {
    width: 90,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    paddingRight: 8,
  },
  grandTotalValue: {
    width: 110,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
  },
  footer: {
    marginTop: 24,
    paddingTop: 8,
    borderTop: '0.5pt solid #e0e0e0',
    fontSize: 8,
    color: '#888',
  },
  footerDisclaimer: {
    marginBottom: 4,
  },
  footerHash: {
    fontFamily: 'Helvetica',
    color: '#aaa',
  },
  pageNumber: {
    textAlign: 'right',
    fontSize: 8,
    color: '#aaa',
    marginTop: 4,
  },
  settledBadge: {
    fontSize: 8,
    color: '#888',
    marginTop: 2,
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FolioPdfItem {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPrice: number | { toString(): string };
  amount: number | { toString(): string };
  taxRate: number | { toString(): string };
  taxAmount: number | { toString(): string };
  businessDate: Date | string;
  voidedByEntryId: string | null;
  postedAt?: Date | string;
}

export interface FolioPdfProps {
  folio: {
    id: string;
    snapshotHash: string | null;
    snapshotTotal: number | { toString(): string } | null;
  };
  items: FolioPdfItem[];
  reservation: {
    checkInDate: Date | string;
    checkOutDate: Date | string;
    room: { number: string } | null;
  };
  guest: {
    fullName: string;
    documentType: string;
    documentNumber: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date | string): string {
  const iso = d instanceof Date ? d.toISOString() : d;
  // Produce DD/MM/YYYY (Colombian convention)
  const dateOnly = iso.slice(0, 10); // 'YYYY-MM-DD'
  const [y, m, day] = dateOnly.split('-');
  return `${day}/${m}/${y}`;
}

function toNum(v: number | { toString(): string }): number {
  return typeof v === 'number' ? v : Number(v.toString());
}

function nightCount(checkIn: Date | string, checkOut: Date | string): number {
  const a = new Date(checkIn instanceof Date ? checkIn.toISOString().slice(0, 10) : checkIn.slice(0, 10));
  const b = new Date(checkOut instanceof Date ? checkOut.toISOString().slice(0, 10) : checkOut.slice(0, 10));
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * FolioPdfDocument — react-pdf Document component for "ESTADO DE CUENTA" bill.
 *
 * Renders server-side via renderToBuffer() in FolioPdfService.
 * Do NOT import react-dom or browser APIs here.
 *
 * Labels (Q4 locked decision):
 *  - Title: "ESTADO DE CUENTA" (NOT "FACTURA")
 *  - Footer: "Este documento no es una factura electrónica DIAN."
 *
 * COP formatting: always via formatCOP() helper (P13 — Intl.NumberFormat unreliable in react-pdf Node)
 * Date formatting: DD/MM/YYYY (Colombian convention, consistent with TRA export in 04-04)
 * Guest privacy: documentNumber passed pre-decrypted from FolioPdfService (never decrypt here)
 */
export const FolioPdfDocument: React.FC<FolioPdfProps> = ({
  folio,
  items,
  reservation,
  guest,
}) => {
  // ── Totals calculation ──────────────────────────────────────────────────────
  const subtotal = items
    .filter((i) => i.type === 'ROOM_CHARGE' || i.type === 'MANUAL_CHARGE')
    .reduce((acc, i) => acc + toNum(i.amount), 0);

  const ivaTotal = items
    .filter((i) => i.type === 'TAX')
    .reduce((acc, i) => acc + toNum(i.amount), 0);

  // Grand total: prefer snapshotTotal (immutable, SETTLED) over computed sum
  const grandTotal = folio.snapshotTotal !== null && folio.snapshotTotal !== undefined
    ? toNum(folio.snapshotTotal)
    : items.reduce((acc, i) => acc + toNum(i.amount), 0);

  const nights = nightCount(reservation.checkInDate, reservation.checkOutDate);
  const folioShortId = folio.id.slice(0, 8).toUpperCase();
  const roomNumber = reservation.room?.number ?? 'N/A';

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <Text style={styles.title}>ESTADO DE CUENTA</Text>
        <Text style={styles.subtitle}>
          Folio #{folioShortId} · Habitación {roomNumber}
        </Text>

        {folio.snapshotHash && (
          <Text style={styles.settledBadge}>
            Liquidado · Hash: {folio.snapshotHash.slice(0, 8)}
          </Text>
        )}

        <View style={styles.divider} />

        {/* ── Guest & Stay info ───────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Información del huésped</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Huésped</Text>
          <Text style={styles.infoValue}>{guest.fullName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Documento</Text>
          <Text style={styles.infoValue}>{guest.documentType} {guest.documentNumber}</Text>
        </View>

        <View style={[styles.divider, { marginTop: 8 }]} />

        <Text style={styles.sectionLabel}>Estadía</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Llegada</Text>
          <Text style={styles.infoValue}>{fmtDate(reservation.checkInDate)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Salida</Text>
          <Text style={styles.infoValue}>{fmtDate(reservation.checkOutDate)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Noches</Text>
          <Text style={styles.infoValue}>{nights}</Text>
        </View>

        <View style={styles.divider} />

        {/* ── Items table ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Detalle de cargos</Text>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colDate]}>Fecha</Text>
          <Text style={[styles.tableHeaderCell, styles.colDesc]}>Descripción</Text>
          <Text style={[styles.tableHeaderCell, styles.colQty]}>Cant</Text>
          <Text style={[styles.tableHeaderCell, styles.colUnit]}>V. Unitario</Text>
          <Text style={[styles.tableHeaderCell, styles.colIva]}>IVA%</Text>
          <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
        </View>

        {items.map((item) => {
          const isVoided = item.type === 'VOID' || item.voidedByEntryId !== null;
          const rowStyle = isVoided ? styles.tableRowVoided : styles.tableRow;
          const taxRateNum = toNum(item.taxRate);
          const taxPct = Math.round(taxRateNum * 100);

          return (
            <View key={item.id} style={rowStyle}>
              <Text style={styles.colDate}>{fmtDate(item.businessDate)}</Text>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{formatCOP(item.unitPrice)}</Text>
              <Text style={styles.colIva}>{taxPct > 0 ? `${taxPct}%` : '—'}</Text>
              <Text style={styles.colTotal}>{formatCOP(item.amount)}</Text>
            </View>
          );
        })}

        {/* ── Totals ──────────────────────────────────────────────────────── */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{formatCOP(subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>IVA</Text>
            <Text style={styles.totalsValue}>{formatCOP(ivaTotal)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL</Text>
            <Text style={styles.grandTotalValue}>{formatCOP(grandTotal)}</Text>
          </View>
        </View>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerDisclaimer}>
            Este documento no es una factura electrónica DIAN.
          </Text>
          {folio.snapshotHash && (
            <Text style={styles.footerHash}>
              Hash de integridad: {folio.snapshotHash}
            </Text>
          )}
          <Text style={styles.pageNumber}>Página 1 de 1</Text>
        </View>

      </Page>
    </Document>
  );
};
