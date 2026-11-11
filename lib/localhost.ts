/**
 * Is the app being used from the machine it runs on?
 *
 * Capture normally goes to Browserless, wherever the app is deployed. The one
 * exception is the developer's own machine, which already has Playwright's
 * browsers installed — there the workspace offers a second, local capture that
 * needs no key. Nothing about *permission* hangs on this; it only decides
 * whether that extra button is worth showing.
 */

/** Hosts that mean "this machine". */
export function isLocalHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]'
  );
}

/**
 * The hostname out of a `Host` header, port removed.
 *
 * An IPv6 literal carries its own colons, so the port is only the part after
 * the last colon when the host is not bracketed.
 */
function hostnameOf(header: string): string {
  const host = header.trim();
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    return end === -1 ? host : host.slice(0, end + 1);
  }
  const colon = host.lastIndexOf(':');
  return colon === -1 ? host : host.slice(0, colon);
}

export function isLocalRequest(request: Request): boolean {
  const header = request.headers.get('host');
  if (!header) return false;
  return isLocalHostname(hostnameOf(header));
}
