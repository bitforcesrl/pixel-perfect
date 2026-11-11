import { canLaunchLocally, captureEnv } from '@/lib/browser';
import { isLocalRequest } from '@/lib/localhost';
import { takeScreenshot } from '@/lib/screenshot';
import { validateScreenshotRequest } from '@/lib/validation';

export const runtime = 'nodejs';

// Capturing a tall, lazy-loading page routinely runs past the 60s a serverless
// function gets by default. Vercel plans cap this — lower it to 60 on Hobby.
export const maxDuration = 300;

/** The Browserless key the user typed into their own browser. */
const TOKEN_HEADER = 'x-browserless-token';
/** Set when the click was on "Local" rather than on "Capture". */
const LOCAL_HEADER = 'x-capture-local';

/**
 * Browserless tokens are UUID-shaped. Anything else is refused rather than
 * cleaned up: the token goes into a URL we then connect to, and the endpoint
 * itself is never something the client gets to influence.
 */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{8,200}$/;

function readClientToken(request: Request): string | undefined {
  const raw = request.headers.get(TOKEN_HEADER)?.trim();
  return raw && TOKEN_SHAPE.test(raw) ? raw : undefined;
}

/** Whether this machine can take the capture itself, for the caller asking. */
function localAvailable(request: Request): boolean {
  return isLocalRequest(request) && canLaunchLocally(process.env);
}

function hasEnvToken(): boolean {
  return Boolean(process.env.BROWSERLESS_TOKEN?.trim());
}

/**
 * Where the capture would come from — asked once when the workspace mounts.
 *
 * It says whether the deployment has a token of its own, never what that token
 * is: a workspace that hears `key` is the one that has to ask the user for one.
 */
export async function GET(request: Request) {
  return Response.json({
    source: hasEnvToken() ? 'env' : 'key',
    localAvailable: localAvailable(request),
  });
}

export async function POST(request: Request) {

  const wantsLocal = request.headers.get(LOCAL_HEADER) === '1';
  if (wantsLocal && !localAvailable(request)) {
    return Response.json(
      { error: 'Local capture is only available on localhost' },
      { status: 403 },
    );
  }

  const clientToken = readClientToken(request);
  // Nothing to capture with. The workspace answers this by opening the dialog
  // that takes a key, so the flag matters more than the message.
  if (!wantsLocal && !hasEnvToken() && !clientToken) {
    return Response.json(
      { error: 'Add a Browserless key to capture', needsKey: true },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Request body must be valid JSON' },
      { status: 400 },
    );
  }

  const parsed = validateScreenshotRequest(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await takeScreenshot(
      parsed.data,
      captureEnv(process.env, { clientToken, forceLocal: wantsLocal }),
    );
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Screenshot failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
