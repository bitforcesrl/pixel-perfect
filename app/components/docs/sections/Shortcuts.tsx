import ShortcutsReference from '../../ShortcutsReference';
import { DocSection } from '../DocSection';
import { DocLink, Kbd, P } from '../Prose';
import { DOCS } from '@/lib/docs';
import { shortcutGroups } from '@/lib/shortcuts';

/**
 * The same catalog the app's help dialog reads, so the docs never list a key
 * the app does not answer.
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
      <ShortcutsReference groups={shortcutGroups()} headingLevel="h3" />
      <P>
        <Kbd>⇧</Kbd> <Kbd>C</Kbd> captures through the{' '}
        <DocLink to={DOCS.chromeExtension}>Chrome extension</DocLink>; without
        it, the key opens the dialog that installs it. Capturing or exporting
        every viewport has no key on purpose: use the Capture menu or{' '}
        <strong>▾ All viewports</strong> in the Layers panel.
      </P>
    </DocSection>
  );
}
