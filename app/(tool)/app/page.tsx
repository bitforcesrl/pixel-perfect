import type { Metadata } from 'next';
import PixelPerfectApp from '../../components/PixelPerfectApp';

export const metadata: Metadata = { title: 'App' };

/** The tool itself, opened on whatever this browser was last working on. */
export default function AppPage() {
  return <PixelPerfectApp />;
}
