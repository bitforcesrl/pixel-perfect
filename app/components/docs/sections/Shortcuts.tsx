import ShortcutsReference from '../../ShortcutsReference';
import { DocSection } from '../DocSection';
import { Kbd, P } from '../Prose';
import { DOCS } from '@/lib/docs';
import { shortcutGroups } from '@/lib/shortcuts';

/**
 * The same catalog the app's help dialog reads, so the docs never list a key
 * the app does not answer. Local captures are included, with a word on where
 * they work.
 */
export default function Shortcuts() {
  return (
    <DocSection
      id={DOCS.shortcuts}
      number="08"
      title="Keyboard shortcuts"
      lead={
        <>
          Single keys, plus <Kbd>⇧</Kbd> for anything that replaces a layer —
          off while you type in a field or a dialog is open. In the app,{' '}
          <Kbd>?</Kbd> shows this list.
        </>
      }
    >
      <ShortcutsReference
        groups={shortcutGroups({ localCapture: true })}
        headingLevel="h3"
      />
      <P>
        <Kbd>⇧</Kbd> <Kbd>L</Kbd> works only on a self-hosted app opened at{' '}
        <code>localhost</code>. Capturing or exporting every viewport has no key
        on purpose: use the Capture menu or <strong>All</strong> in the Layers
        panel.
      </P>
    </DocSection>
  );
}
