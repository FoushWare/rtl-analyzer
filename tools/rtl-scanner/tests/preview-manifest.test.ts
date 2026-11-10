import { describe, expect, it } from 'vitest';
import { approvedPreviewForSource, validatedPreviewRoute } from '../src/preview-manifest.js';

describe('preview manifest', () => {
  it('maps InvoiceTable to the approved owning route', () => {
    const mapping = approvedPreviewForSource('apps/invoicing/src/components/InvoiceTable.tsx');
    expect(mapping).toMatchObject({ id: 'invoicing-invoice-table', application: 'invoicing', owningRoute: '/invoices', routes: { ltr: '/invoices', rtl: '/invoices?demo=unmigrated-rtl&lang=ar' } });
  });
  it('rejects unknown mappings and modes', () => {
    expect(approvedPreviewForSource('apps/invoicing/src/components/Other.tsx')).toBeNull();
    expect(validatedPreviewRoute('unknown', 'ltr')).toBeNull();
    expect(validatedPreviewRoute('invoicing-invoice-table', 'javascript')).toBeNull();
  });
  it('returns only validated application routes', () => {
    expect(validatedPreviewRoute('invoicing-invoice-table', 'ltr')?.route).toBe('/invoices');
    expect(validatedPreviewRoute('invoicing-invoice-table', 'rtl')?.route).toBe('/invoices?demo=unmigrated-rtl&lang=ar');
  });
});
