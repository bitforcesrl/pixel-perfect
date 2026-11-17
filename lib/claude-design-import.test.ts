import { describe, expect, it } from 'vitest';
import {
  planDesignImport,
  pngEntries,
  splitTitle,
} from './claude-design-import';
import { VIEWPORT_LIST } from './viewports';

const presets = VIEWPORT_LIST;
const bytes = new Uint8Array(1);

describe('pngEntries', () => {
  it('keeps PNGs only, without folders or macOS forks', () => {
    const files = new Map([
      ['Home – Desktop.png', bytes],
      ['design/Retail – Desktop.PNG', bytes],
      ['__MACOSX/._Home – Desktop.png', bytes],
      ['design/._Retail – Desktop.png', bytes],
      ['README.md', bytes],
    ]);
    expect(pngEntries(files).map((png) => png.name)).toEqual([
      'Home – Desktop.png',
      'Retail – Desktop.PNG',
    ]);
  });
});

describe('splitTitle', () => {
  it('splits the viewport off the title', () => {
    expect(splitTitle('Home – Desktop.png', presets)).toEqual({
      screen: 'Home',
      viewportKey: 'desktop',
    });
    expect(
      splitTitle('Ho.Re.Ca › I nostri prodotti - mobile.png', presets),
    ).toEqual({
      screen: 'Ho.Re.Ca › I nostri prodotti',
      viewportKey: 'mobile',
    });
  });

  it('drops the (n) of a repeated title', () => {
    expect(splitTitle('Home – Tablet (2).png', presets)).toEqual({
      screen: 'Home',
      viewportKey: 'tablet',
    });
  });

  it('keeps a title whose last part is not a viewport', () => {
    expect(splitTitle('Retail – Brand center.png', presets)).toEqual({
      screen: 'Retail – Brand center',
      viewportKey: null,
    });
    expect(splitTitle('Modale di ricerca.png', presets).viewportKey).toBeNull();
  });

  it('matches custom viewport labels', () => {
    const custom = [
      ...presets,
      { key: 'vp-1', label: 'Wide', width: 1920, height: 1080 },
    ];
    expect(splitTitle('Home – Wide.png', custom).viewportKey).toBe('vp-1');
  });
});

describe('planDesignImport', () => {
  const item = (name: string, width = 2880) => ({ name, width, height: 2000 });

  it('groups viewports of one screen into one page', () => {
    const plan = planDesignImport(
      [
        item('Home – Desktop.png'),
        item('Retail – Desktop.png'),
        item('Home – Mobile.png', 750),
      ],
      presets,
      [],
    );
    expect(plan.map((p) => [p.name, p.shots.map((s) => s.key)])).toEqual([
      ['Home', ['desktop', 'mobile']],
      ['Retail', ['desktop']],
    ]);
    expect(plan.every((p) => p.existingPageId === null)).toBe(true);
  });

  it('routes a title with no viewport by width, at 1x or 2x', () => {
    const plan = planDesignImport(
      [item('Search.png', 2880), item('Menu.png', 750), item('Tab.png', 768)],
      presets,
      [],
    );
    expect(plan.map((p) => p.shots[0].key)).toEqual([
      'desktop',
      'mobile',
      'tablet',
    ]);
  });

  it('puts a second image for the same viewport on its own page', () => {
    const plan = planDesignImport(
      [item('Home – Desktop.png'), item('Home – Desktop (2).png')],
      presets,
      [],
    );
    expect(plan.map((p) => p.name)).toEqual(['Home', 'Home (2)']);
  });

  it('updates a page that already has the name', () => {
    const plan = planDesignImport(
      [item('Home – Desktop.png'), item('Retail – Desktop.png')],
      presets,
      [{ id: 'p1', name: 'home' }],
    );
    expect(plan.map((p) => p.existingPageId)).toEqual(['p1', null]);
  });
});
