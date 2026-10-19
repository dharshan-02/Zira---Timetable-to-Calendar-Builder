import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

/** Protect the shared single-workspace demo when a deployment password is set. */
export function proxy(request: NextRequest) {
  const password = process.env.WORKSPACE_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV !== 'production') return NextResponse.next();
    return new NextResponse('Workspace access is not configured. Set WORKSPACE_PASSWORD in the deployment environment.', { status: 503 });
  }

  const username = process.env.WORKSPACE_USERNAME || 'weekline';
  const expected = Buffer.from(`${username}:${password}`);
  const authorization = request.headers.get('authorization') || '';
  const provided = authorization.startsWith('Basic ')
    ? Buffer.from(authorization.slice(6), 'base64')
    : Buffer.alloc(0);
  const valid = provided.length === expected.length && timingSafeEqual(provided, expected);

  if (valid) return NextResponse.next();
  return new NextResponse('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Weekline", charset="UTF-8"', 'Cache-Control': 'no-store' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
