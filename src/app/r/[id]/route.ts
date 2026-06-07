import { NextResponse } from 'next/server';
import { OWNER_COOKIE, ownerCookieOptions, signValue, isPlausibleToken } from '@/lib/identity';

export const runtime = 'nodejs';

/**
 * GET /r/[id]?o=<owner_token>
 *
 * Identity bridge. The desktop app opens this URL in the owner's own browser to
 * hand over its device identity: it sets a signed, httpOnly wip_uid cookie equal
 * to the owner_token, then 302-redirects to the clip viewer at /c/[id]. From then
 * on the browser is recognized as the owner and the clip shows up in /me.
 *
 * The owner_token travels in the query string here - acceptable for the alpha
 * (see lib/identity for the security model). The shared link copied to the
 * clipboard is always the plain /c/[id]; only the owner ever sees this bridge.
 *
 * Redirects to the same origin as the request (via req.url) so the cookie and
 * the destination stay on one host across localhost / preview / production.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const ownerToken = new URL(req.url).searchParams.get('o');

  const res = NextResponse.redirect(new URL(`/c/${encodeURIComponent(id)}`, req.url), 302);
  if (ownerToken !== null && isPlausibleToken(ownerToken)) {
    res.cookies.set(OWNER_COOKIE, signValue(ownerToken), ownerCookieOptions);
  }
  return res;
}
