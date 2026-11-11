import { isGateEnabled, verifyPassword } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Whether this deployment asks for a password at all. */
export function GET() {
  return Response.json({ required: isGateEnabled() });
}

/** Checks a password — the one the visitor just typed, or the stored one. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Request body must be valid JSON' },
      { status: 400 },
    );
  }

  const password =
    typeof body === 'object' && body !== null && 'password' in body
      ? (body as { password: unknown }).password
      : undefined;

  if (typeof password !== 'string') {
    return Response.json(
      { error: 'password must be a string' },
      { status: 400 },
    );
  }

  if (!(await verifyPassword(password))) {
    return Response.json({ error: 'Wrong password.' }, { status: 401 });
  }

  return Response.json({ ok: true });
}
