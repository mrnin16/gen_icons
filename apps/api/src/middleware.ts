import { NextResponse, type NextRequest } from 'next/server';

/**
 * Allow the web app (and any other client) to call the API cross-origin.
 *
 * - In production, set CORS_ALLOW_ORIGIN to your web app's origin
 *   (e.g. https://web-service.up.railway.app).
 * - When unset, falls back to "*" so anyone can use the public assets
 *   (raw SVGs, sprite, npm tarball install URL).
 */
const ALLOW_ORIGIN = process.env.CORS_ALLOW_ORIGIN || '*';

export function middleware(req: NextRequest) {
  // Preflight: respond immediately with the CORS headers, no body.
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const res = NextResponse.next();
  const headers = corsHeaders();
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v);
  }
  return res;
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export const config = {
  matcher: ['/api/:path*', '/svg/:path*', '/sprite/:path*'],
};
