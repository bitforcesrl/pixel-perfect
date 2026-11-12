import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/site';

/**
 * The card shown when a link to the site is shared (Open Graph, X, Slack,
 * LinkedIn...). Rendered once at build time: wordmark and tagline on the
 * left, the hero frame of the app on the right.
 */

export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  // The hero poster is optional: without it the card is text only
  let shot: string | null = null;
  try {
    const file = await readFile(
      path.join(process.cwd(), 'public/media/hero.jpg'),
    );
    shot = `data:image/jpeg;base64,${file.toString('base64')}`;
  } catch (error) {
    console.warn('OG image: hero.jpg not found, rendering text only', error);
  }

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        background: '#090b11',
        color: '#dfe6f2',
        padding: 64,
        gap: 48,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: '#a99cff',
            fontWeight: 700,
          }}
        >
          {SITE.name}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 24,
            fontSize: 60,
            lineHeight: 1.05,
            fontWeight: 800,
          }}
        >
          {SITE.tagline}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 24,
            lineHeight: 1.4,
            color: '#adb9cc',
          }}
        >
          Figma vs live site, per page and viewport. Free and open source.
        </div>
      </div>
      {shot && (
        <img
          src={shot}
          alt=""
          width={560}
          height={315}
          style={{ borderRadius: 12, border: '1px solid #262f40' }}
        />
      )}
    </div>,
    size,
  );
}
