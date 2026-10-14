import { NextResponse, type NextRequest } from 'next/server';

// Simple crew lock: HTTP basic auth against APP_PASSWORD (any username).
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get('authorization');
  if (header?.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const supplied = decoded.slice(decoded.indexOf(':') + 1);
      if (supplied === password) return NextResponse.next();
    } catch {
      // fall through to 401
    }
  }

  return new NextResponse('Password required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Wav Avatar Studio"' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
