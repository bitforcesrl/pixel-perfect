import {verifyRequest} from '@/lib/auth';
import {
  isFigmaTarget,
  type FigmaLayer,
  type FigmaRect,
  type FigmaRender,
} from '@/lib/figma';
import {parseRenderScale, renderScaleFor} from '@/lib/render-scale';

export const runtime = 'nodejs';

// Figma renders a tall frame at up to 2x before answering, which takes a while — and
// a sliced one is rendered part by part.
export const maxDuration = 300;

const API = 'https://api.figma.com/v1';

/** The Figma token the user typed into their own browser. */
const TOKEN_HEADER = 'x-figma-token';

/**
 * Personal access tokens are `figd_` and URL-safe characters. Anything else is
 * refused rather than cleaned up, as with the Browserless key.
 */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{8,200}$/;

/**
 * Past this, Figma shrinks a render to fit rather than refusing it. A frame
 * that would cross it is sliced instead; one that slips under these numbers
 * and still comes back shrunk is sliced on the browser's second ask, which
 * also says how large the shrunk render was — the limit Figma actually
 * applied, used from then on in place of this guess.
 */
const MAX_RENDER_AREA = 32_000_000;
/** The smallest limit the browser can report — below it, a report is noise. */
const MIN_RENDER_AREA = 1_000_000;
const MAX_RENDER_SIDE = 16_384;

/** How many levels down a too-large frame is opened looking for parts that fit. */
const MAX_SPLIT_DEPTH = 4;

/** Node ids per render request — keeps the query string a sane length. */
const IDS_PER_RENDER = 100;

/** Node types whose children can be rendered one by one in their place. */
const CONTAINERS = new Set(['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE', 'SECTION']);

/** Where Figma puts its renders. The proxy below fetches from nowhere else. */
const RENDER_HOST = /^figma-alpha-api\.s3(\.[a-z0-9-]+)*\.amazonaws\.com$/;

function readClientToken(request: Request): string | undefined {
  const raw = request.headers.get(TOKEN_HEADER)?.trim();
  return raw && TOKEN_SHAPE.test(raw) ? raw : undefined;
}

function envToken(): string | undefined {
  return process.env.FIGMA_TOKEN?.trim() || undefined;
}

class FigmaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** The token is missing or refused: the workspace asks for another. */
    readonly needsToken = false,
  ) {
    super(message);
  }
}

async function figmaGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: {'X-Figma-Token': token},
    cache: 'no-store',
  });
  if (res.ok) return (await res.json()) as T;

  const body = (await res.json().catch(() => null)) as {err?: unknown} | null;
  const detail = typeof body?.err === 'string' ? body.err : res.statusText;
  if (res.status === 403) {
    throw new FigmaError(`Figma refused the token: ${detail}`, 403, true);
  }
  if (res.status === 404) {
    throw new FigmaError(
      'Figma file not found — check the link and that this token can open it',
      404,
    );
  }
  if (res.status === 429) {
    throw new FigmaError(
      'Figma rate limit reached — wait a little and try again',
      429,
    );
  }
  throw new FigmaError(`Figma answered ${res.status}: ${detail}`, 502);
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Paint {
  type?: string;
  visible?: boolean;
  opacity?: number;
  blendMode?: string;
  color?: {r: number; g: number; b: number; a: number};
}

interface Effect {
  visible?: boolean;
}

interface FigmaNode {
  id: string;
  name?: string;
  type?: string;
  visible?: boolean;
  opacity?: number;
  blendMode?: string;
  clipsContent?: boolean;
  fills?: Paint[];
  strokes?: Paint[];
  /** Uniform stroke width, used unless `individualStrokeWeights` says per side */
  strokeWeight?: number;
  individualStrokeWeights?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  /** Where the stroke sits on the edge; Figma's default is INSIDE */
  strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';
  /** Present and non-empty for a dashed stroke */
  strokeDashes?: number[];
  effects?: Effect[];
  /** Radians; absent or 0 for a box that sits square */
  rotation?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  absoluteBoundingBox?: Box | null;
  absoluteRenderBounds?: Box | null;
  children?: FigmaNode[];
}

interface NodesResponse {
  nodes?: Record<string, {document?: FigmaNode} | null>;
}

interface ImagesResponse {
  err?: string | null;
  images?: Record<string, string | null>;
}

/**
 * Whether the deployment has a Figma token of its own — asked once when the
 * workspace mounts. Like the capture route, it never says what the token is.
 */
export async function GET(request: Request) {
  if (!(await verifyRequest(request))) {
    return Response.json({error: 'Unauthorized'}, {status: 401});
  }

  // With `?render=`, the bytes of a render the browser could not fetch itself
  const render = new URL(request.url).searchParams.get('render');
  if (render !== null) return proxyRender(render);

  return Response.json({source: envToken() ? 'env' : 'key'});
}

/**
 * Render one node at its width's scale (`lib/render-scale.ts`: 2x for a
 * mobile frame, sliding to 1x for a desktop one) and say where the PNG is — or, for a node Figma would
 * shrink to fit its size limit, where each of its parts is.
 *
 * The images themselves stay on Figma's storage — the browser downloads them
 * from there — so a full-page render never has to fit through this function's
 * response. The node's own size comes back with it, which is how the
 * workspace tells a full-scale render from one Figma had to shrink, and asks
 * again with `slice: true` when it did — passing back the `scale` it got, so
 * every part of one frame is rendered at the frame's scale, not its own.
 */
export async function POST(request: Request) {
  if (!(await verifyRequest(request))) {
    return Response.json({error: 'Unauthorized'}, {status: 401});
  }

  const token = envToken() ?? readClientToken(request);
  if (!token) {
    return Response.json(
      {error: 'Add a Figma token to export frames', needsToken: true},
      {status: 400},
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {error: 'Request body must be valid JSON'},
      {status: 400},
    );
  }
  if (!isFigmaTarget(body)) {
    return Response.json(
      {error: 'fileKey and nodeId must come from a Figma frame link'},
      {status: 400},
    );
  }
  const {fileKey, nodeId} = body;
  // The browser asks again with this when a whole render came back shrunk
  const {
    slice,
    maxArea: reported,
    scale: askedScale,
  } = body as {slice?: unknown; maxArea?: unknown; scale?: unknown};
  const forceSlice = slice === true;
  const maxArea =
    typeof reported === 'number' && Number.isFinite(reported)
      ? Math.min(MAX_RENDER_AREA, Math.max(MIN_RENDER_AREA, reported))
      : MAX_RENDER_AREA;
  const ids = encodeURIComponent(nodeId);
  const file = encodeURIComponent(fileKey);

  try {
    const nodes = await figmaGet<NodesResponse>(
      `/files/${file}/nodes?ids=${ids}&depth=1`,
      token,
    );
    const node = nodes.nodes?.[nodeId]?.document;
    if (!node) {
      return Response.json(
        {error: `No node ${nodeId} in this Figma file`},
        {status: 404},
      );
    }

    const box = node.absoluteBoundingBox ?? null;
    // A part asked for on its own keeps its frame's scale; a frame gets the
    // one its width calls for
    const scale =
      parseRenderScale(askedScale) ?? renderScaleFor(box?.width ?? Number.NaN);
    const render: FigmaRender = {
      name: typeof node.name === 'string' ? node.name : 'figma',
      x: box?.x ?? null,
      y: box?.y ?? null,
      width: box?.width ?? null,
      height: box?.height ?? null,
      scale,
    };

    // Small enough for one render: Figma's own picture of the whole frame
    if (!box || (!forceSlice && fitsOneRender(box, maxArea, scale))) {
      const images = await figmaGet<ImagesResponse>(
        `/images/${file}?ids=${ids}&scale=${scale}&format=png`,
        token,
      );
      const url = images.images?.[nodeId];
      if (!url) {
        return Response.json(
          {error: images.err || 'Figma could not render this node'},
          {status: 502},
        );
      }
      return Response.json({...render, url});
    }

    return Response.json({
      ...render,
      ...(await sliceRender(node, box, file, token, maxArea, scale)),
    });
  } catch (err) {
    if (err instanceof FigmaError) {
      return Response.json(
        {error: err.message, ...(err.needsToken ? {needsToken: true} : {})},
        {status: err.status},
      );
    }
    const message = err instanceof Error ? err.message : 'Figma export failed';
    return Response.json({error: message}, {status: 500});
  }
}

function fitsOneRender(box: Box, maxArea: number, scale: number): boolean {
  const width = box.width * scale;
  const height = box.height * scale;
  return width * height <= maxArea && Math.max(width, height) <= MAX_RENDER_SIDE;
}

function intersect(a: FigmaRect | null, b: FigmaRect): FigmaRect {
  if (!a) return b;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y),
  };
}

function blendOf(mode: string | undefined): string | null {
  return !mode || mode === 'NORMAL' || mode === 'PASS_THROUGH' ? null : mode;
}

/** A flat colour paint as a fill layer; null for anything a fill can't redraw. */
function solidFill(
  paint: Paint,
  rect: FigmaRect,
  clip: FigmaRect | null,
  alpha: number,
  blend: string | null,
): Extract<FigmaLayer, {kind: 'fill'}> | null {
  if (paint.type !== 'SOLID' || !paint.color) return null;
  const {r, g, b, a} = paint.color;
  return {
    kind: 'fill',
    rect,
    clip,
    alpha: alpha * (paint.opacity ?? 1),
    blend: blendOf(paint.blendMode) ?? blend,
    color: `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`,
  };
}

const visible = <T extends {visible?: boolean}>(items: T[] | undefined): T[] =>
  (items ?? []).filter((item) => item.visible !== false);

const isSolid = (paint: Paint) => paint.type === 'SOLID' && !!paint.color;

/**
 * Where the stroke of an axis-aligned box paints, as up to four bands: top and
 * bottom across the full width, left and right between them, so no corner is
 * painted twice — which would show with a translucent stroke.
 */
function strokeBands(box: FigmaRect, node: FigmaNode): FigmaRect[] {
  const uniform = node.strokeWeight ?? 1;
  const side = node.individualStrokeWeights;
  const top = side?.top ?? uniform;
  const right = side?.right ?? uniform;
  const bottom = side?.bottom ?? uniform;
  const left = side?.left ?? uniform;
  // How far past the box edge the stroke reaches, as a share of its width
  const outward =
    node.strokeAlign === 'OUTSIDE' ? 1 : node.strokeAlign === 'CENTER' ? 0.5 : 0;

  const x0 = box.x - left * outward;
  const y0 = box.y - top * outward;
  const x1 = box.x + box.width + right * outward;
  const y1 = box.y + box.height + bottom * outward;
  const bands: FigmaRect[] = [
    {x: x0, y: y0, width: x1 - x0, height: top},
    {x: x0, y: y1 - bottom, width: x1 - x0, height: bottom},
    {x: x0, y: y0 + top, width: left, height: y1 - y0 - top - bottom},
    {x: x1 - right, y: y0 + top, width: right, height: y1 - y0 - top - bottom},
  ];
  return bands.filter((band) => band.width > 0 && band.height > 0);
}

/**
 * A node that paints nothing but flat colour on a square box — a rectangle,
 * or a container with nothing inside — redrawn exactly as fill layers: its
 * fills over the box, then a solid stroke as bands along the edges. Null when
 * it paints anything else: a gradient or image, a dashed stroke, a shadow, a
 * rounded corner or a rotation.
 *
 * Such a node is redrawn exactly whatever its size, so a page-tall background
 * or a page-tall guide outline that no full-scale render could hold never needs one.
 */
function flatBoxLayers(
  node: FigmaNode,
  box: FigmaRect,
  clip: FigmaRect | null,
  alpha: number,
): PlannedLayer[] | null {
  const shape =
    node.type === 'RECTANGLE' ||
    (CONTAINERS.has(node.type ?? '') && !node.children?.length);
  const radii = [node.cornerRadius ?? 0, ...(node.rectangleCornerRadii ?? [])];
  const fills = visible(node.fills);
  const strokes = visible(node.strokes);
  const flat =
    shape &&
    !node.rotation &&
    radii.every((radius) => radius === 0) &&
    !node.strokeDashes?.length &&
    visible(node.effects).length === 0 &&
    fills.every(isSolid) &&
    strokes.every(isSolid);
  if (!flat) return null;

  // Its own opacity and blend, which a render would have carried
  const own = alpha * (node.opacity ?? 1);
  const blend = blendOf(node.blendMode);
  const paint = (paints: Paint[], rects: FigmaRect[]) =>
    paints.flatMap((p) =>
      rects.flatMap((rect) => solidFill(p, rect, clip, own, blend) ?? []),
    );
  const bands = strokes.length > 0 ? strokeBands(box, node) : [];
  return [...paint(fills, [box]), ...paint(strokes, bands)];
}

type PlannedLayer =
  | Extract<FigmaLayer, {kind: 'fill'}>
  | Omit<Extract<FigmaLayer, {kind: 'image'}>, 'url'>;

/**
 * A frame too large for one render at `scale`, as parts that each fit.
 *
 * Figma's API renders whole nodes and nothing smaller, so the slices are the
 * frame's own children — on a page, its sections — each rendered at `scale` and
 * placed where it sits. A child still too large is opened up in turn. What
 * a container paints itself is redrawn from its fills: flat colours exactly,
 * anything else is reported, as is a part that cannot be split any further.
 */
async function sliceRender(
  root: FigmaNode,
  rootBox: Box,
  file: string,
  token: string,
  maxArea: number,
  scale: number,
): Promise<{layers: FigmaLayer[]; warning?: string}> {
  const planned: PlannedLayer[] = [];
  const warnings = new Set<string>();
  const local = (box: Box): FigmaRect => ({
    x: box.x - rootBox.x,
    y: box.y - rootBox.y,
    width: box.width,
    height: box.height,
  });

  const open = async (
    node: FigmaNode,
    clip: FigmaRect | null,
    alpha: number,
    depth: number,
  ) => {
    const bounds = node.absoluteBoundingBox;
    if (bounds) {
      for (const paint of visible(node.fills)) {
        const fill = solidFill(paint, local(bounds), clip, alpha, null);
        if (fill) planned.push(fill);
        else {
          warnings.add(
            `“${node.name ?? node.id}” has a background that is not a flat colour — it is left out of the ${scale}x slices`,
          );
        }
      }
    }
    const innerClip =
      node.clipsContent && bounds ? intersect(clip, local(bounds)) : clip;
    const innerAlpha = alpha * (node === root ? 1 : (node.opacity ?? 1));

    const children = (node.children ?? []).filter(
      (child) => child.visible !== false && child.absoluteRenderBounds,
    );
    // The children too large to render whole, fetched a level deeper
    const tooLarge = children.filter(
      (child) =>
        !fitsOneRender(child.absoluteRenderBounds!, maxArea, scale) &&
        depth < MAX_SPLIT_DEPTH &&
        CONTAINERS.has(child.type ?? ''),
    );
    const opened = new Map<string, FigmaNode>();
    // Every too-large container as fetched, children or not: an empty one may
    // still be a flat box, redrawn from its fills
    const fetched = new Map<string, FigmaNode>();
    if (tooLarge.length > 0) {
      const ids = encodeURIComponent(tooLarge.map((child) => child.id).join(','));
      const deeper = await figmaGet<NodesResponse>(
        `/files/${file}/nodes?ids=${ids}&depth=1`,
        token,
      );
      for (const child of tooLarge) {
        const doc = deeper.nodes?.[child.id]?.document;
        if (doc) fetched.set(child.id, doc);
        if (doc?.children?.length) opened.set(child.id, doc);
      }
    }

    for (const child of children) {
      const deeper = opened.get(child.id);
      if (deeper) {
        await open(deeper, innerClip, innerAlpha, depth + 1);
        continue;
      }
      if (!fitsOneRender(child.absoluteRenderBounds!, maxArea, scale)) {
        // A container's children only show on its own fetch: one not fetched
        // (past the split depth) would look empty, so only rectangles qualify
        const node =
          fetched.get(child.id) ?? (child.type === 'RECTANGLE' ? child : null);
        const box = node?.absoluteBoundingBox;
        const flat =
          node && box ? flatBoxLayers(node, local(box), innerClip, innerAlpha) : null;
        if (flat) {
          planned.push(...flat);
          continue;
        }
        warnings.add(
          `“${child.name ?? child.id}” is too large for a ${scale}x render and cannot be split further — it is stretched to fit`,
        );
      }
      planned.push({
        kind: 'image',
        id: child.id,
        rect: local(child.absoluteRenderBounds!),
        clip: innerClip,
        alpha: innerAlpha,
        blend: blendOf(child.blendMode),
        splittable: CONTAINERS.has(child.type ?? ''),
      });
    }
  };

  // No clip around the root of its own: the picture ends at the frame's edges
  // anyway, and a part sliced on its own clips only if it clips its content
  await open(root, null, 1, 0);

  // Every part rendered in as few requests as the query string allows
  const ids = planned.flatMap((layer) => (layer.kind === 'image' ? [layer.id] : []));
  const urls: Record<string, string | null> = {};
  for (let i = 0; i < ids.length; i += IDS_PER_RENDER) {
    const batch = encodeURIComponent(ids.slice(i, i + IDS_PER_RENDER).join(','));
    const images = await figmaGet<ImagesResponse>(
      `/images/${file}?ids=${batch}&scale=${scale}&format=png`,
      token,
    );
    Object.assign(urls, images.images ?? {});
  }

  const layers = planned.flatMap((layer): FigmaLayer[] => {
    if (layer.kind === 'fill') return [layer];
    const url = urls[layer.id];
    // Figma renders nothing for an empty part, which leaves nothing to draw
    if (!url) return [];
    return [{...layer, url}];
  });
  return {
    layers,
    ...(warnings.size > 0 ? {warning: [...warnings].join('; ')} : {}),
  };
}

/** Stream a render through, for a browser that cannot fetch it cross-origin. */
async function proxyRender(raw: string): Promise<Response> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return Response.json({error: 'render is not a URL'}, {status: 400});
  }
  if (url.protocol !== 'https:' || !RENDER_HOST.test(url.hostname)) {
    return Response.json({error: 'Not a Figma render'}, {status: 400});
  }
  const res = await fetch(url, {cache: 'no-store'});
  if (!res.ok || !res.body) {
    return Response.json(
      {error: `Could not download the render (${res.status})`},
      {status: 502},
    );
  }
  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/png',
      'Cache-Control': 'no-store',
    },
  });
}
