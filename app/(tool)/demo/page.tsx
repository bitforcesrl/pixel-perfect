import type { Metadata } from 'next';
import { NO_INDEX } from '@/lib/seo';
import PixelPerfectApp from '../../components/PixelPerfectApp';
import { DEMO_ZIP_URL } from '@/lib/demo';

// A tool screen, not content: kept out of search results
export const metadata: Metadata = { title: 'Live demo', robots: NO_INDEX };

/**
 * The tool, seeded with the demo project.
 *
 * The ZIP in `public/` is imported into this browser exactly like
 * File ▸ Import project from ZIP, then the URL settles on `/app`.
 */
export default function DemoPage() {
  return <PixelPerfectApp demoUrl={DEMO_ZIP_URL} />;
}
