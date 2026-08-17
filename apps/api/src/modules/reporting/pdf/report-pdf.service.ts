import { Injectable } from '@nestjs/common';
import * as React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportPdfDocument } from './ReportPdfDocument';
import type { ReportPdfProps } from './ReportPdfDocument';

/**
 * ReportPdfService — renders a REPORTE OPERACIONAL PDF buffer.
 *
 * Reuses the pattern from Phase 04-03 FolioPdfService:
 *  - renderToBuffer() (server-side, no headless Chrome)
 *  - React.createElement() avoids JSX transform issues at runtime in Node.js
 *  - Cast to 'any' resolves TS nominal mismatch between FunctionComponentElement
 *    and DocumentProps (same issue documented in 04-03)
 *
 * @react-pdf/renderer already installed in apps/api from Phase 04-03.
 * react + react-dom peer deps already present.
 */
@Injectable()
export class ReportPdfService {
  async renderToBuffer(props: ReportPdfProps): Promise<Buffer> {
    const element = React.createElement(ReportPdfDocument, props) as any;
    return renderToBuffer(element);
  }
}
