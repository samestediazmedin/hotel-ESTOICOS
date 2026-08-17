import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { formatCOP } from '../../folio/pdf/format-cop';
import type { OperationsReportDto } from '../dto/operations-report.dto';

// ─── Styles ───────────────────────────────────────────────────────────────────
// StyleSheet.create must be a top-level constant — NOT inside render (react-pdf constraint)

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    padding: 40,
    fontSize: 10,
    color: '#1a1a1a',
  },
  // ── Header ──────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  hotelName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#c45a3a',
  },
  reportTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    textAlign: 'center',
    flex: 1,
  },
  generatedAt: {
    fontSize: 8,
    color: '#888',
    textAlign: 'right',
  },
  periodRow: {
    marginBottom: 16,
    fontSize: 9,
    color: '#555',
  },
  // ── Divider ─────────────────────────────────────────────────────────────────
  divider: {
    borderBottom: '1pt solid #e0e0e0',
    marginVertical: 10,
  },
  // ── Section labels ───────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#c45a3a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  // ── Summary grid ─────────────────────────────────────────────────────────────
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 12,
  },
  summaryCard: {
    width: '31%',
    backgroundColor: '#faf8f5',
    borderRadius: 3,
    padding: 6,
    marginBottom: 4,
  },
  summaryCardLabel: {
    fontSize: 7,
    color: '#888',
    marginBottom: 2,
  },
  summaryCardValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
  },
  // ── Table ────────────────────────────────────────────────────────────────────
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5ede8',
    borderBottom: '1pt solid #c45a3a',
    paddingVertical: 5,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#c45a3a',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #ebebeb',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '0.5pt solid #ebebeb',
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: '#faf8f5',
  },
  // ── Column widths ─────────────────────────────────────────────────────────────
  colFecha:    { width: '14%' },
  colOcup:     { width: '14%', textAlign: 'right' },
  colAdr:      { width: '15%', textAlign: 'right' },
  colRevpar:   { width: '15%', textAlign: 'right' },
  colLlegadas: { width: '12%', textAlign: 'right' },
  colSalidas:  { width: '12%', textAlign: 'right' },
  colIngresos: { width: '18%', textAlign: 'right' },
  // ── Footer ───────────────────────────────────────────────────────────────────
  footer: {
    marginTop: 20,
    paddingTop: 8,
    borderTop: '0.5pt solid #e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#aaa',
  },
  footerNote: {
    fontSize: 8,
    color: '#aaa',
  },
  pageNumber: {
    fontSize: 8,
    color: '#aaa',
    textAlign: 'right',
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportPdfProps {
  hotelName: string;
  report: OperationsReportDto;
  generatedAt?: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(isoDate: string): string {
  // isoDate is 'YYYY-MM-DD'
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function fmtDatetime(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ReportPdfDocument — react-pdf Document component for "REPORTE OPERACIONAL".
 *
 * Label: "REPORTE OPERACIONAL" (NOT FACTURA, NOT ESTADO DE CUENTA).
 * No DIAN disclaimer needed — this is a hotel management report, not a guest bill.
 *
 * COP formatting: always via formatCOP() imported from folio/pdf/format-cop.ts
 * (P13 — Intl.NumberFormat unreliable in @react-pdf/renderer Node.js context).
 *
 * Date formatting: DD/MM/YYYY (Colombian convention).
 * No charts — Recharts uses React DOM/SVG; incompatible with react-pdf engine (P3).
 */
export const ReportPdfDocument: React.FC<ReportPdfProps> = ({
  hotelName,
  report,
  generatedAt = new Date(),
}) => {
  const { range, totals, daily } = report;

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <Text style={styles.hotelName}>{hotelName}</Text>
          <Text style={styles.reportTitle}>REPORTE OPERACIONAL</Text>
          <View>
            <Text style={styles.generatedAt}>
              Generado: {fmtDatetime(generatedAt)}
            </Text>
          </View>
        </View>

        <Text style={styles.periodRow}>
          Periodo: {fmtDate(range.startDate)} al {fmtDate(range.endDate)}
        </Text>

        <View style={styles.divider} />

        {/* ── KPI Summary ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Resumen del periodo</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Ingreso total</Text>
            <Text style={styles.summaryCardValue}>{formatCOP(totals.totalRevenue)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Ocupación promedio</Text>
            <Text style={styles.summaryCardValue}>{fmtPct(totals.avgOccupancyPct)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>ADR promedio</Text>
            <Text style={styles.summaryCardValue}>{formatCOP(totals.avgAdr)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>RevPAR promedio</Text>
            <Text style={styles.summaryCardValue}>{formatCOP(totals.avgRevpar)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Total llegadas</Text>
            <Text style={styles.summaryCardValue}>{totals.totalArrivals}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardLabel}>Total salidas</Text>
            <Text style={styles.summaryCardValue}>{totals.totalDepartures}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Daily breakdown table ────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Detalle diario</Text>

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colFecha]}>Fecha</Text>
          <Text style={[styles.tableHeaderCell, styles.colOcup]}>Ocupación</Text>
          <Text style={[styles.tableHeaderCell, styles.colAdr]}>ADR</Text>
          <Text style={[styles.tableHeaderCell, styles.colRevpar]}>RevPAR</Text>
          <Text style={[styles.tableHeaderCell, styles.colLlegadas]}>Llegadas</Text>
          <Text style={[styles.tableHeaderCell, styles.colSalidas]}>Salidas</Text>
          <Text style={[styles.tableHeaderCell, styles.colIngresos]}>Ingresos</Text>
        </View>

        {daily.length === 0 && (
          <View style={styles.tableRow}>
            <Text style={{ color: '#aaa', fontSize: 9, padding: 8 }}>
              Sin datos para este rango
            </Text>
          </View>
        )}

        {daily.map((row, idx) => (
          <View key={row.businessDate} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <Text style={styles.colFecha}>{fmtDate(row.businessDate)}</Text>
            <Text style={styles.colOcup}>{fmtPct(row.occupancyPct)}</Text>
            <Text style={styles.colAdr}>{formatCOP(row.adr)}</Text>
            <Text style={styles.colRevpar}>{formatCOP(row.revpar)}</Text>
            <Text style={styles.colLlegadas}>{row.arrivalsCount}</Text>
            <Text style={styles.colSalidas}>{row.departuresCount}</Text>
            <Text style={styles.colIngresos}>{formatCOP(row.totalRevenue)}</Text>
          </View>
        ))}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerNote}>
            HotelOS AI — documento generado automáticamente
          </Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            fixed
          />
        </View>

      </Page>
    </Document>
  );
};
