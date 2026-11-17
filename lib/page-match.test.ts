import { describe, expect, it } from 'vitest';
import { findPagesByUrl, normalizePageUrl, placeIncoming } from './page-match';
import {
  createPage,
  createProject,
  MAX_PAGES,
  MAX_PROJECTS,
  type Project,
} from './projects';

describe('normalizePageUrl', () => {
  it('drops query, hash, trailing slash and host case', () => {
    expect(normalizePageUrl('https://Shop.com/products/a/?v=1#x')).toBe(
      'https://shop.com/products/a',
    );
  });

  it('treats the root with or without a slash as the same page', () => {
    expect(normalizePageUrl('https://shop.com/')).toBe(
      normalizePageUrl('https://shop.com'),
    );
  });

  it('keeps the path case, which servers may care about', () => {
    expect(normalizePageUrl('https://shop.com/Pages/About')).toBe(
      'https://shop.com/Pages/About',
    );
  });

  it('returns null for something that is not a web address', () => {
    expect(normalizePageUrl('not a url')).toBeNull();
    expect(normalizePageUrl('')).toBeNull();
    expect(normalizePageUrl('chrome://settings')).toBeNull();
  });
});

describe('findPagesByUrl', () => {
  const project = (name: string, urls: string[]): Project => {
    const base = createProject(name);
    return {
      ...base,
      pages: urls.map((url, i) => createPage(`Page ${i}`, url)),
    };
  };

  it('finds the pages for an address across projects', () => {
    const a = project('A', ['https://shop.com/products/a', '']);
    const b = project('B', [
      'https://shop.com/products/a/?ref=x',
      'https://shop.com',
    ]);
    expect(findPagesByUrl([a, b], 'https://shop.com/products/a#top')).toEqual([
      { projectId: a.id, pageId: a.pages[0].id },
      { projectId: b.id, pageId: b.pages[0].id },
    ]);
  });

  it('ignores pages without an address', () => {
    const a = project('A', ['']);
    expect(findPagesByUrl([a], 'https://shop.com')).toEqual([]);
  });

  it('finds nothing for an invalid address', () => {
    const a = project('A', ['https://shop.com']);
    expect(findPagesByUrl([a], 'nope')).toEqual([]);
  });
});

describe('placeIncoming', () => {
  const URL_ = 'https://shop.com/products/a';

  it('opens an existing page as it is', () => {
    const a = createProject('A');
    const placed = placeIncoming([a], URL_, {
      kind: 'page',
      projectId: a.id,
      pageId: a.pages[0].id,
    });
    expect(placed).toEqual({
      projects: [a],
      projectId: a.id,
      pageId: a.pages[0].id,
    });
  });

  it('adds a new page with the address to the chosen project', () => {
    const a = createProject('A');
    const b = createProject('B');
    const placed = placeIncoming([a, b], URL_, {
      kind: 'new',
      projectId: b.id,
      name: 'Product A',
    });
    expect(placed?.projectId).toBe(b.id);
    expect(placed?.projects[0]).toBe(a);
    const added = placed?.projects[1].pages.at(-1);
    expect(added).toMatchObject({ name: 'Product A', url: URL_ });
    expect(placed?.pageId).toBe(added?.id);
  });

  it('refuses a new page in a full project', () => {
    const a = createProject('A');
    const full = {
      ...a,
      pages: Array.from({ length: MAX_PAGES }, (_, i) => createPage(`P${i}`)),
    };
    expect(
      placeIncoming([full], URL_, { kind: 'new', projectId: a.id, name: 'X' }),
    ).toBeNull();
  });

  it('creates a project whose first page is the address', () => {
    const placed = placeIncoming([], URL_, {
      kind: 'new-project',
      name: 'shop.com',
    });
    expect(placed?.projects).toHaveLength(1);
    expect(placed?.projects[0].name).toBe('shop.com');
    expect(placed?.projects[0].pages).toEqual([
      expect.objectContaining({ name: 'Home', url: URL_ }),
    ]);
    expect(placed?.pageId).toBe(placed?.projects[0].pages[0].id);
  });

  it('refuses a new project past the cap', () => {
    const many = Array.from({ length: MAX_PROJECTS }, (_, i) =>
      createProject(`P${i}`),
    );
    expect(
      placeIncoming(many, URL_, { kind: 'new-project', name: 'X' }),
    ).toBeNull();
  });
});
