'use client';

import Modal from './Modal';
import { EXTENSION_STORE_URL } from '@/lib/features';
import { DOCS, docsHref } from '@/lib/docs';

export interface ExtensionRequiredDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * What a capture says when this browser has no Pixel Perfect Capture
 * extension to run in.
 *
 * Sites are captured by the extension, in the user's own Chrome — there is no
 * other way to capture them — so the Chrome buttons stay on screen either way
 * and this dialog is where they lead until it is installed: a link to install
 * it, and the docs section that explains it. While the extension is not on the
 * Chrome Web Store yet (`EXTENSION_STORE_URL` is null), the install link opens
 * the docs' steps for loading it by hand instead.
 */
export default function ExtensionRequiredDialog({
  open,
  onClose,
}: ExtensionRequiredDialogProps) {
  const guide = docsHref(DOCS.chromeExtension);
  const installHref = EXTENSION_STORE_URL ?? guide;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Install the extension"
      subtitle="needed to capture the site"
    >
      <div className="flex flex-col gap-4">
        <p className="text-[12px] leading-5 text-ink-400">
          The site is captured by the{' '}
          <span className="text-ink-200">Pixel Perfect Capture</span> Chrome
          extension, in your own browser: with your logins, cookies and site
          passwords, at every viewport&apos;s exact width. It is not installed
          in this browser yet.
        </p>

        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[12px] leading-5 text-ink-400">
          <li>
            {EXTENSION_STORE_URL
              ? 'Add it to Chrome from the Chrome Web Store.'
              : 'Load it in Chrome, following the steps in the guide.'}
          </li>
          <li>
            Reload this page: an extension only reaches the pages opened after
            it was installed.
          </li>
          <li>Press Chrome again.</li>
        </ol>

        <div className="flex items-center gap-2">
          <a
            href={installHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="rounded bg-press-cyan px-3 py-1.5 text-[12px] font-semibold text-ink-950 transition-colors hover:bg-press-cyan/85"
          >
            {EXTENSION_STORE_URL ? 'Add to Chrome' : 'Install the extension'}
          </a>
          {/* The guide is the install link itself until the store page exists */}
          {EXTENSION_STORE_URL && (
            <a
              href={guide}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-ink-700 px-3 py-1.5 text-[12px] text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100"
            >
              How it works
            </a>
          )}
          <span className="ml-auto text-[11px] text-ink-600">
            Or upload screenshots taken elsewhere.
          </span>
        </div>
      </div>
    </Modal>
  );
}
