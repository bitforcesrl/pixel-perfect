import { DocSection } from '../DocSection';
import { Code, DocLink, ExtLink, Fields, P } from '../Prose';
import { DOCS } from '@/lib/docs';
import { SITE } from '@/lib/site';

const RUN_LOCALLY = `git clone ${SITE.githubUrl}.git
cd pixel-perfect
npm install
npm run dev   # → http://localhost:7654/app`;

export default function SelfHosting() {
  return (
    <DocSection
      id={DOCS.selfHosting}
      number="09"
      title="Self-hosting"
      lead="Run Pixel Perfect on your own machine or server, and set the Figma token once for everyone."
    >
      <pre className="overflow-x-auto rounded-md border border-ink-800 bg-ink-950 p-5 font-mono text-[13px] leading-relaxed text-ink-200">
        <code>{RUN_LOCALLY}</code>
      </pre>
      <P>
        Optional settings go in a <Code>.env</Code> file (start from{' '}
        <Code>.env.example</Code>):
      </P>
      <Fields
        items={[
          {
            name: <Code>FIGMA_TOKEN</Code>,
            body: (
              <>
                A Figma token for every export; nobody is asked for one. See{' '}
                <DocLink to={DOCS.figmaToken}>Get a Figma token</DocLink>.
              </>
            ),
          },
        ]}
      />
      <P>
        Leave it unset on a public deployment: each visitor then brings their
        own. Docker and production builds are covered in the{' '}
        <ExtLink href={`${SITE.githubUrl}#readme`}>README</ExtLink>.
      </P>
      <P>
        Site captures need nothing on the server: they run in each
        visitor&apos;s{' '}
        <DocLink to={DOCS.chromeExtension}>Chrome extension</DocLink>. The
        extension answers <Code>pixelperfect.fit</Code> and{' '}
        <Code>localhost</Code> out of the box; for a copy on another address,
        add it in the extension&apos;s settings (right-click its icon ▸{' '}
        <strong>Options</strong>).
      </P>
    </DocSection>
  );
}
