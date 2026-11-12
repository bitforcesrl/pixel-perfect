import type { Metadata } from 'next';
import { NO_INDEX } from '@/lib/seo';
import PixelPerfectApp from '../../components/PixelPerfectApp';

// A tool screen, not content: kept out of search results
export const metadata: Metadata = { title: 'App', robots: NO_INDEX };

/** The tool itself, opened on whatever this browser was last working on. */
export default function AppPage() {
  return <PixelPerfectApp />;
}
