import { DocSection } from '../DocSection';
import { Code, DocLink, ExtLink, Fields, P } from '../Prose';
import { DOCS } from '@/lib/docs';
import { SITE } from '@/lib/site';

const RUN_LOCALLY = `git clone ${SITE.githubUrl}.git
cd pixel-perfect
npm install
npm run playwright:install   # Firefox for local captures, once
npm run dev                  # → http://localhost:7654/app`;

export default function SelfHosting() {
  return (
    <DocSection
      id={DOCS.selfHosting}
      number="09"
      title="Self-hosting"
      lead="Run Pixel Perfect on your machine to unlock local captures and browser logins, and to set the Figma and Browserless keys once for everyone."
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
          {
            name: <Code>BROWSERLESS_TOKEN</Code>,
            body: (
              <>
                A Browserless key for every cloud capture. See{' '}
                <DocLink to={DOCS.browserlessKey}>
                  Get a Browserless key
                </DocLink>
                .
              </>
            ),
          },
          {
            name: <Code>BROWSERLESS_*</Code>,
            body: (
              <>
                Region (<Code>BROWSERLESS_URL</Code>), session length, proxy and
                concurrency for your Browserless plan — documented in{' '}
                <Code>.env.example</Code>.
              </>
            ),
          },
        ]}
      />
      <P>
        Leave both tokens unset on a public deployment: each visitor then brings
        their own. Docker and production builds are covered in the{' '}
        <ExtLink href={`${SITE.githubUrl}#readme`}>README</ExtLink>. In Docker,
        local captures work but browser login does not (there is no screen to
        open a window on).
      </P>
    </DocSection>
  );
}
