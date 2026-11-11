import type { Metadata } from 'next';
import PixelPerfectApp from '../../components/PixelPerfectApp';
import { DEMO_ZIP_URL } from '@/lib/demo';

export const metadata: Metadata = { title: 'Live demo' };

/**
 * The tool, seeded with the demo project.
 *
 * The ZIP in `public/` is imported into this browser exactly like
 * File ▸ Import project from ZIP, then the URL settles on `/app`.
 */
export default function DemoPage() {
  return <PixelPerfectApp demoUrl={DEMO_ZIP_URL} />;
}
