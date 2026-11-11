import { isLocalRequest } from '@/lib/localhost';
import {
  canOpenLoginWindow,
  finishLoginWindow,
  forgetLoginSession,
  loginSessionStatus,
  openLoginWindow,
  sessionKey,
} from '@/lib/login-session';

export const runtime = 'nodejs';

/**
 * The login window for sites a script cannot log into (email OTP and the like).
 *
 * It opens a visible browser on the machine the app runs on and writes that
 * site's cookies to disk, so it is only offered to someone sitting at that
 * machine: a local request to an app that is not in Docker or on a server.
 */
async function guard(request: Request): Promise<Response | null> {
  if (!isLocalRequest(request) || !canOpenLoginWindow()) {
    return Response.json(
      { error: 'Browser login is only available when running on localhost' },
      { status: 403 },
    );
  }
  return null;
}

function urlFromQuery(request: Request): string | null {
  const url = new URL(request.url).searchParams.get('url');
  return url && sessionKey(url) ? url : null;
}

/** Whether a session is saved for the URL's host, and whether its window is open. */
export async function GET(request: Request) {
  const available = isLocalRequest(request) && canOpenLoginWindow();
  const url = urlFromQuery(request);
  if (!available || !url) {
    return Response.json({
      available,
      saved: false,
      savedAt: null,
      open: false,
    });
  }
  return Response.json({ available, ...(await loginSessionStatus(url)) });
}

/** `{url, action: "open" | "done"}` — open the window, or save and close it. */
export async function POST(request: Request) {
  const refused = await guard(request);
  if (refused) return refused;

  let body: { url?: unknown; action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json(
      { error: 'Request body must be valid JSON' },
      { status: 400 },
    );
  }
  const url = typeof body.url === 'string' ? body.url : '';
  if (!sessionKey(url)) {
    return Response.json(
      { error: 'url must be an http(s) URL' },
      { status: 400 },
    );
  }

  try {
    if (body.action === 'open') await openLoginWindow(url);
    else if (body.action === 'done') await finishLoginWindow(url);
    else {
      return Response.json(
        { error: 'action must be "open" or "done"' },
        { status: 400 },
      );
    }
    return Response.json(await loginSessionStatus(url));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login window failed';
    return Response.json({ error: message }, { status: 500 });
  }
}

/** Forget the saved session for the URL's host. */
export async function DELETE(request: Request) {
  const refused = await guard(request);
  if (refused) return refused;
  const url = urlFromQuery(request);
  if (!url) {
    return Response.json(
      { error: 'url must be an http(s) URL' },
      { status: 400 },
    );
  }
  await forgetLoginSession(url);
  return Response.json(await loginSessionStatus(url));
}
