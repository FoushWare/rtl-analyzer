import { NextResponse, type NextRequest } from 'next/server';

// Forward the requested language so the root layout can render the real
// <html lang dir> on the server (the Analyzer preview needs a real document direction).
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('x-sf-lang', request.nextUrl.searchParams.get('lang') === 'ar' ? 'ar' : 'en');
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/'] };
