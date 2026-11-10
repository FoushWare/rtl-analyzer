export const PREVIEW_MANIFEST_VERSION = 1 as const;
export const PREVIEW_COMPANION_ORIGIN = 'http://127.0.0.1:4318';
export type PreviewMode = 'ltr' | 'rtl';
export interface PreviewMapping { readonly id: string; readonly source: string; readonly application: 'invoicing'; readonly owningRoute: '/invoices'; readonly routes: Readonly<Record<PreviewMode, string>>; }
export const previewManifest = { version: PREVIEW_MANIFEST_VERSION, mappings: [{ id: 'invoicing-invoice-table', source: 'apps/invoicing/src/components/InvoiceTable.tsx', application: 'invoicing', owningRoute: '/invoices', routes: { ltr: '/invoices', rtl: '/invoices?demo=unmigrated-rtl&lang=ar' } }] } as const;
const mappingById = new Map<string, PreviewMapping>(previewManifest.mappings.map((mapping) => [mapping.id, mapping]));
export function approvedPreviewForSource(source: string): PreviewMapping | null { return previewManifest.mappings.find((mapping) => mapping.source === source) ?? null; }
export function validatedPreviewRoute(mappingId: string, mode: string): { mapping: PreviewMapping; mode: PreviewMode; route: string } | null {
  const mapping = mappingById.get(mappingId); if (!mapping || (mode !== 'ltr' && mode !== 'rtl')) return null;
  const selectedMode = mode as PreviewMode; const route = mapping.routes[selectedMode];
  if (!route.startsWith(mapping.owningRoute) || (selectedMode === 'rtl' && route !== '/invoices?demo=unmigrated-rtl&lang=ar')) return null;
  return { mapping, mode: selectedMode, route };
}
