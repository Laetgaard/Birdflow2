/**
 * Allowlist-based SVG sanitizer (no external dependencies).
 *
 * Used for user- and AI-provided inline SVG in custom components.
 * Sanitization happens at three points (defense in depth):
 *  1. On save (PATCH /api/websites/:id/builder)
 *  2. In the builder canvas before rendering with dangerouslySetInnerHTML
 *  3. At publish time when generating the Next.js project
 *
 * Threat model: stored XSS on the builder and published customer sites.
 * Strategy: strip comments/doctype/entities/CDATA, remove dangerous
 * elements together with their content, then rebuild every remaining tag
 * keeping only allowlisted elements and attributes with safe values.
 */

const MAX_SVG_LENGTH = 300_000;

/** Elements removed together with all of their content. */
const BLOCKED_CONTAINERS = [
  'script',
  'style',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'math',
  'template',
  'feimage', // can trigger external fetches
  'a', // links inside decorative SVG are unnecessary; avoids href tricks
];

const ALLOWED_ELEMENTS = new Set([
  'svg', 'g', 'defs', 'symbol', 'use',
  'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'textpath', 'title', 'desc',
  'lineargradient', 'radialgradient', 'stop', 'pattern',
  'clippath', 'mask', 'marker', 'image',
  'filter',
  'feblend', 'fecolormatrix', 'fecomponenttransfer', 'fecomposite',
  'feconvolvematrix', 'fediffuselighting', 'fedisplacementmap',
  'fedropshadow', 'feflood', 'fefunca', 'fefuncb', 'fefuncg', 'fefuncr',
  'fegaussianblur', 'femerge', 'femergenode', 'femorphology', 'feoffset',
  'fepointlight', 'fespecularlighting', 'fespotlight', 'fetile', 'feturbulence',
  'animate', 'animatetransform', 'animatemotion', 'mpath', 'set',
]);

const ALLOWED_ATTRIBUTES = new Set([
  // core
  'id', 'class', 'style', 'xmlns', 'xmlns:xlink', 'version', 'lang', 'tabindex',
  'aria-hidden', 'aria-label', 'role', 'focusable',
  // geometry
  'd', 'points', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'width', 'height', 'viewbox', 'preserveaspectratio', 'pathlength',
  // paint
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity',
  'opacity', 'color', 'display', 'visibility', 'overflow',
  'shape-rendering', 'vector-effect', 'paint-order',
  'transform', 'transform-origin',
  // gradients / patterns / masks / clips / markers
  'gradientunits', 'gradienttransform', 'spreadmethod', 'offset',
  'stop-color', 'stop-opacity',
  'patternunits', 'patterntransform', 'patterncontentunits',
  'clip-path', 'clip-rule', 'clippathunits',
  'mask', 'maskunits', 'maskcontentunits',
  'marker-start', 'marker-mid', 'marker-end',
  'markerwidth', 'markerheight', 'markerunits', 'refx', 'refy', 'orient',
  // text
  'font-family', 'font-size', 'font-weight', 'font-style',
  'text-anchor', 'dominant-baseline', 'baseline-shift', 'letter-spacing',
  'dx', 'dy', 'rotate', 'textlength', 'lengthadjust',
  // href (value-restricted below)
  'href', 'xlink:href',
  // filters
  'filterunits', 'primitiveunits', 'stddeviation', 'result', 'in', 'in2',
  'mode', 'type', 'values', 'tablevalues', 'slope', 'intercept', 'amplitude',
  'exponent', 'k1', 'k2', 'k3', 'k4', 'operator', 'radius', 'scale',
  'xchannelselector', 'ychannelselector', 'basefrequency', 'numoctaves',
  'seed', 'stitchtiles', 'surfacescale', 'specularconstant', 'specularexponent',
  'diffuseconstant', 'lighting-color', 'flood-color', 'flood-opacity',
  'azimuth', 'elevation', 'pointsatx', 'pointsaty', 'pointsatz',
  'limitingconeangle', 'color-interpolation-filters', 'flood',
  // SMIL animation
  'attributename', 'attributetype', 'begin', 'dur', 'end', 'min', 'max',
  'restart', 'repeatcount', 'repeatdur', 'calcmode', 'keytimes', 'keysplines',
  'from', 'to', 'by', 'additive', 'accumulate', 'path', 'keypoints',
]);

/** href / xlink:href may only reference internal ids or embedded raster data. */
const SAFE_HREF = /^(#[a-zA-Z0-9_:.-]+|data:image\/(png|jpe?g|gif|webp);base64,[a-zA-Z0-9+/=\s]*)$/;

/** Tags: captures closing slash, tag name, raw attribute chunk. */
const TAG_REGEX = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9:_-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

const ATTR_REGEX = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s"'>/]+))?/g;

function removeBlockedContainers(input: string): string {
  let out = input;
  let prev = '';
  const names = BLOCKED_CONTAINERS.join('|');
  const pairRe = new RegExp(`<\\s*(${names})\\b[\\s\\S]*?<\\s*/\\s*\\1\\s*>`, 'gi');
  const selfRe = new RegExp(`<\\s*(?:${names})\\b(?:"[^"]*"|'[^']*'|[^>"'])*>`, 'gi');
  const closeRe = new RegExp(`<\\s*/\\s*(?:${names})\\s*>`, 'gi');
  while (prev !== out) {
    prev = out;
    out = out.replace(pairRe, '');
  }
  // Orphan open/close tags of blocked elements
  out = out.replace(selfRe, '').replace(closeRe, '');
  return out;
}

function sanitizeStyleValue(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const lower = v.toLowerCase().replace(/\s+/g, '');
  if (lower.includes('<') || lower.includes('&')) return null;
  if (lower.includes('expression(') || lower.includes('javascript:') || lower.includes('@import') || lower.includes('behavior:')) return null;
  // url(...) only allowed for internal references: url(#id)
  const urlRe = /url\s*\(\s*['"]?([^'")]*)['"]?\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(v)) !== null) {
    if (!m[1].startsWith('#')) return null;
  }
  return v;
}

function unquote(raw: string): string {
  if (raw.length >= 2 && ((raw[0] === '"' && raw[raw.length - 1] === '"') || (raw[0] === "'" && raw[raw.length - 1] === "'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

function sanitizeTagAttributes(rawAttrs: string): string {
  const parts: string[] = [];
  let match: RegExpExecArray | null;
  ATTR_REGEX.lastIndex = 0;
  while ((match = ATTR_REGEX.exec(rawAttrs)) !== null) {
    if (!match[1]) continue;
    const name = match[1].toLowerCase();
    if (name.startsWith('on')) continue;
    if (!ALLOWED_ATTRIBUTES.has(name)) continue;

    let value = match[2] !== undefined ? unquote(match[2]) : '';
    // Attribute values must never contain markup
    if (value.includes('<') || value.includes('>')) continue;

    const compact = value.toLowerCase().replace(/[\s\u0000-\u001f]+/g, '');
    if (compact.includes('javascript:') || compact.includes('vbscript:')) continue;

    if (name === 'href' || name === 'xlink:href') {
      if (!SAFE_HREF.test(value.trim())) continue;
    }
    if (name === 'style') {
      const safe = sanitizeStyleValue(value);
      if (safe === null) continue;
      value = safe;
    }
    // begin/end can reference elements+events in SMIL; keep only simple forms
    if (name === 'begin' || name === 'end') {
      if (/[(){}<>&]/.test(value)) continue;
    }

    const escaped = value.replace(/&(?!(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);)/g, '&amp;').replace(/"/g, '&quot;');
    parts.push(match[2] !== undefined ? `${name}="${escaped}"` : name);
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

/**
 * Sanitize an SVG string. Returns a safe SVG string, or '' when the input
 * is empty, too large, or does not contain a usable <svg> root.
 */
export function sanitizeSvg(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';
  if (input.length > MAX_SVG_LENGTH) return '';

  // Normalize and drop control characters (except tab/newline)
  let svg = input.replace(/^\uFEFF/, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

  // Remove comments, CDATA, doctype/entities, processing instructions
  let prev = '';
  while (prev !== svg) {
    prev = svg;
    svg = svg
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
      .replace(/<!DOCTYPE[^>[]*(\[[^\]]*\])?>/gi, '')
      .replace(/<!ENTITY[^>]*>/gi, '')
      .replace(/<\?[\s\S]*?\?>/g, '');
  }

  svg = removeBlockedContainers(svg);

  // Rebuild every tag from the allowlist
  svg = svg.replace(TAG_REGEX, (_full, closing: string, name: string, rawAttrs: string) => {
    const lower = name.toLowerCase();
    if (!ALLOWED_ELEMENTS.has(lower)) return '';
    if (closing) return `</${lower}>`;
    const selfClosing = /\/\s*$/.test(rawAttrs);
    const attrs = sanitizeTagAttributes(selfClosing ? rawAttrs.replace(/\/\s*$/, '') : rawAttrs);
    return `<${lower}${attrs}${selfClosing ? ' /' : ''}>`;
  });

  // Anything tag-like that TAG_REGEX could not parse (e.g. "<script" with no
  // closing ">") survives as raw text and could still be parsed as HTML when
  // injected. Reject such malformed input entirely rather than risk it.
  const leftover = svg.replace(TAG_REGEX, '');
  if (/<\s*[a-zA-Z!?/]/.test(leftover)) return '';

  // Require an <svg> root; slice to it
  const start = svg.search(/<svg\b/i);
  if (start === -1) return '';
  const end = svg.toLowerCase().lastIndexOf('</svg>');
  if (end === -1 || end < start) return '';
  return svg.slice(start, end + 6).trim();
}

/** Quick check used by UIs to decide whether to attempt rendering. */
export function looksLikeSvg(input: string | null | undefined): boolean {
  return !!input && /<svg\b/i.test(input);
}
