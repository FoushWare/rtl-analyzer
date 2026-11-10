export const DASHBOARD_ORIGIN = 'http://127.0.0.1:4320';
export function isAllowedDashboardOrigin(origin: string | undefined): boolean { return origin === DASHBOARD_ORIGIN; }
