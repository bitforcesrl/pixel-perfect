export interface ScreenshotRequest {
  url: string;
  viewportWidth: number;
  viewportHeight: number;
  /** Typed into the site's password gate, if the page turns out to have one. */
  sitePassword?: string;
}

export interface ScreenshotResult {
  /**
   * Data URL of the full-page screenshot: PNG from a local browser, WebP
   * (JPEG for a very tall page) from the remote one
   */
  image: string;
  /** full-page width in CSS pixels */
  width: number;
  /** full-page height in CSS pixels */
  height: number;
}

export type ValidationOutcome =
  { ok: true; data: ScreenshotRequest } | { ok: false; error: string };

export const MIN_DIM = 200;
export const MAX_DIM = 4000;
export const MAX_SITE_PASSWORD_LENGTH = 256;

function isValidDimension(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_DIM &&
    value <= MAX_DIM
  );
}

export function validateScreenshotRequest(body: unknown): ValidationOutcome {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  const { url, viewportWidth, viewportHeight, sitePassword } = body as Record<
    string,
    unknown
  >;

  if (typeof url !== 'string') {
    return { ok: false, error: 'url must be a string' };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'url is not a valid URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'url must use http or https' };
  }
  if (!isValidDimension(viewportWidth) || !isValidDimension(viewportHeight)) {
    return {
      ok: false,
      error: `viewportWidth and viewportHeight must be integers between ${MIN_DIM} and ${MAX_DIM}`,
    };
  }
  if (
    sitePassword !== undefined &&
    (typeof sitePassword !== 'string' ||
      sitePassword.length > MAX_SITE_PASSWORD_LENGTH)
  ) {
    return {
      ok: false,
      error: `sitePassword must be a string of at most ${MAX_SITE_PASSWORD_LENGTH} characters`,
    };
  }
  return {
    ok: true,
    data: {
      url,
      viewportWidth,
      viewportHeight,
      // An empty field means a public page: nothing to type anywhere
      ...(sitePassword ? { sitePassword } : {}),
    },
  };
}
