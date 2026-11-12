import { DocSection } from '../DocSection';
import Figure from '../Figure';
import { DocLink, Kbd, Menu, P, Steps, WithAside } from '../Prose';
import { DOCS } from '@/lib/docs';

export default function Projects() {
  return (
    <DocSection
      id={DOCS.projects}
      number="02"
      title="Projects"
      lead="A project is one site under review. It owns its pages and its viewport sizes; nothing is shared between projects."
    >
      <WithAside
        aside={
          <Figure
            src="/docs/new-project.webp"
            width={768}
            height={470}
            displayWidth={384}
            alt="The New project dialog, with a project name typed in and the Create button."
            caption="File ▸ New project…"
          />
        }
      >
        <Steps>
          {[
            <>
              Open <Menu path={['File', 'New project…']} /> or press{' '}
              <Kbd>N</Kbd>.
            </>,
            <>
              Type a name (up to 60 characters) and press{' '}
              <strong>Create</strong>.
            </>,
            <>
              The <strong>First page</strong> dialog opens right after: name the
              page and, if you have it, its URL. See{' '}
              <DocLink to={DOCS.pages}>Pages</DocLink>.
            </>,
          ]}
        </Steps>
        <P>
          Switch, rename or delete projects from{' '}
          <Menu path={['File', 'Projects…']} /> (<Kbd>⇧</Kbd> <Kbd>P</Kbd>).
          Deleting a project removes its pages, captures, exports, snapshots and
          notes. The last project cannot be deleted.
        </P>
        <P>
          A browser keeps up to <strong>6 projects</strong>, each with up to{' '}
          <strong>6 pages</strong>. Everything is stored in the browser, and a
          banner warns you when that storage is nearly full: export the projects
          you are done with, then delete them to make room.
        </P>
      </WithAside>
    </DocSection>
  );
}
