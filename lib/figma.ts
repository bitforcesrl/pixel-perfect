/**
 * A Figma link, reduced to what the REST API asks for.
 *
 * The link is what Figma hands out — "Copy link to selection" — so that is what
 * the page form takes, rather than asking anyone to dig a node id out of it.
 * Shared by the form, which flags a link it cannot read, and the API route,
 * which refuses one.
 */
export interface FigmaTarget {
  fileKey: string;
  /** In the API's own form, `12:34` — the link spells it `12-34`. */
  nodeId: string;
}

const FILE_KEY = /^[A-Za-z0-9]{10,64}$/;
// A part inside an instance is spelled `I12:34;56:78` — the export route asks
// for those when it slices a frame
const NODE_ID = /^I?\d+:\d+(;\d+:\d+)*$/;

export function isFigmaTarget(value: unknown): value is FigmaTarget {
  if (typeof value !== 'object' || value === null) return false;
  const { fileKey, nodeId } = value as Partial<FigmaTarget>;
  return (
    typeof fileKey === 'string' &&
    FILE_KEY.test(fileKey) &&
    typeof nodeId === 'string' &&
    NODE_ID.test(nodeId)
  );
}

/**
 * `figma.com/design/:key/:name?node-id=12-34`, and the older `/file/` form.
 * A branch link names its branch key as well, and that is the file the node
 * lives in. Null for anything else, including a link with no node selected.
 */
export function parseFigmaUrl(raw: string): FigmaTarget | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== 'figma.com' && !host.endsWith('.figma.com')) return null;

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'design' && parts[0] !== 'file') return null;
  const fileKey = parts[2] === 'branch' && parts[3] ? parts[3] : parts[1];

  const target = {
    fileKey,
    nodeId: (url.searchParams.get('node-id') ?? '').replace('-', ':'),
  };
  return isFigmaTarget(target) ? target : null;
}

/** A rectangle in the exported frame's own coordinates, at 1x. */
export interface FigmaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One thing painted into a sliced render, bottom to top.
 *
 * `clip` is the area a clipping ancestor lets the layer show through, `alpha`
 * the opacity of the ancestors that were opened up rather than rendered whole —
 * a layer's own opacity is already in its render. `blend` is Figma's blend mode
 * name, null for normal.
 */
export type FigmaLayer =
  | {
      kind: 'fill';
      rect: FigmaRect;
      clip: FigmaRect | null;
      alpha: number;
      blend: string | null;
      /** CSS colour */
      color: string;
    }
  | {
      kind: 'image';
      rect: FigmaRect;
      clip: FigmaRect | null;
      alpha: number;
      blend: string | null;
      /** Where Figma put this part's render */
      url: string;
      /** The part's node, asked for again in slices if Figma shrank it */
      id: string;
      /** Whether it has children to slice it into */
      splittable: boolean;
    };

/**
 * What the export route answers: either one render of the whole frame, or —
 * for a frame Figma would shrink to fit its size limit — the frame's parts,
 * each rendered at full scale, for the browser to put back together.
 */
export interface FigmaRender {
  name: string;
  /** The frame's own position on the Figma canvas and size, 1x */
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  scale: number;
  url?: string;
  layers?: FigmaLayer[];
  /** What the sliced render could not reproduce, when anything */
  warning?: string;
}
