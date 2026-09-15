/**
 * The script that runs INSIDE the captured page and turns the rendered DOM
 * into ordered sections.
 *
 * It is handed to `page.evaluate`, which serialises the function, so it
 * must be entirely self-contained: no imports, no closures over module
 * scope. Types are stripped before serialisation. Everything it returns is
 * plain JSON, validated on the node side by domExtract.ts.
 *
 * Segmentation, in order:
 *  1. exclude what is not content (hidden, overlays, consent, dialogs);
 *  2. find the header and footer and take them out of the running;
 *  3. from the main content root, unwrap single-child wrappers, split blocks
 *     that are taller than a screen or contain several section-like
 *     children, and keep the rest as leaves;
 *  4. merge short heading-less fragments into their predecessor;
 *  5. per section: text, images, buttons, repeated items, computed styles.
 */

export type RawExtraction = ReturnType<typeof extractPageInBrowser>;

export function extractPageInBrowser(opts: { maxSections: number; viewportWidth: number; viewportHeight: number; relaxed?: boolean }) {
  const doc = document;
  const win = window;
  const vw = opts.viewportWidth;
  const vh = opts.viewportHeight;
  const CONSENT_RE = /cookie|consent|gdpr|cmp|cc-|privacy-banner|onetrust|cookiebot|usercentrics|coi-banner|cookiescript/i;

  const excluded = new Set<Element>();
  const rectOf = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + win.scrollX, y: r.top + win.scrollY, w: r.width, h: r.height };
  };
  // The pseudo-element argument matters: a theme's gold rule is usually
  // drawn in ::before, not in an element of its own.
  const cs = (el: Element, pseudo?: string) => win.getComputedStyle(el, pseudo);
  const isVisuallyHidden = (el: Element) => {
    const style = cs(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return true;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return true;
    if (r.right < 0 || r.left > vw) return true;
    return false;
  };
  // aria-hidden marks decoration as well as hidden UI; text extraction skips
  // both, the decoration pass below picks the artwork back up.
  const isHidden = (el: Element) => isVisuallyHidden(el) || el.getAttribute("aria-hidden") === "true";
  const isExcludedTag = (el: Element) => /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|LINK|META|IFRAME|OBJECT|EMBED)$/.test(el.tagName);
  const idClass = (el: Element) => `${el.id || ""} ${typeof el.className === "string" ? el.className : ""}`;
  const isOverlay = (el: Element) => {
    const style = cs(el);
    return style.position === "fixed" || style.position === "sticky";
  };
  /**
   * The site's own header, wherever it sits.
   *
   * Almost every modern theme makes its header sticky or fixed, and the
   * overlay rule below threw out every fixed element AND its descendants
   * before the header was ever looked for. The result was a site with no
   * captured header at all: no menu, no logo, no brand — the rebuilt site
   * got a one-item "Forside" menu and the company name from the admin form.
   */
  const HEADER_SELECTOR = "header, [role=banner], #masthead, #main-header, .site-header, .elementor-location-header, [class*='site-header'], [class*='navbar'], [id*='header']";
  const isHeaderLike = (el: Element) => {
    if (!el.matches(HEADER_SELECTOR)) return false;
    if (el.closest("main, article, footer")) return false;
    const r = rectOf(el);
    return r.y < 260 && r.h < 320 && r.w >= vw * 0.5;
  };

  // 1. exclusions
  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    if (excluded.has(el)) continue;
    if (isExcludedTag(el) || isHidden(el) || el.getAttribute("role") === "dialog" || CONSENT_RE.test(idClass(el)) || /\bmodal\b/i.test(idClass(el))) {
      excluded.add(el);
      for (const child of Array.from(el.querySelectorAll("*"))) excluded.add(child);
      continue;
    }
    // A sticky banner is content-blocking furniture — unless it is the site's
    // header, which is exactly what the migration needs to read.
    if (isOverlay(el) && !isHeaderLike(el) && !Array.from(el.children).some((child) => isHeaderLike(child))) {
      excluded.add(el);
      for (const child of Array.from(el.querySelectorAll("*"))) excluded.add(child);
    }
  }
  const isEx = (el: Element) => excluded.has(el);

  const text = (el: Element) => (((el as HTMLElement).innerText ?? el.textContent) || "").replace(/\s+/g, " ").trim();
  const abs = (href: string | null) => { if (!href) return undefined; try { return new URL(href, doc.baseURI).toString(); } catch { return undefined; } };
  const color = (value: string) => value && value !== "rgba(0, 0, 0, 0)" && value !== "transparent" ? value : undefined;
  const bgImageUrl = (el: Element) => {
    const bg = cs(el).backgroundImage;
    const match = bg && bg !== "none" ? bg.match(/url\((['"]?)(.*?)\1\)/) : null;
    return match ? abs(match[2]) : undefined;
  };
  const fontOf = (el: Element) => (cs(el).fontFamily || "").split(",")[0].replace(/["']/g, "").trim();
  const isButtonLike = (el: Element) => {
    const style = cs(el);
    const hasBg = !!color(style.backgroundColor);
    const hasBorder = parseFloat(style.borderTopWidth || "0") > 0 && style.borderTopStyle !== "none";
    const padded = parseFloat(style.paddingLeft || "0") >= 8;
    return el.tagName === "BUTTON" || el.getAttribute("role") === "button" || (hasBg && padded) || (hasBorder && padded);
  };
  const saturation = (rgb: string | undefined) => {
    const m = rgb?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return 0;
    const [r, g, b] = [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
    const max = Math.max(r, g, b); const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  };

  // 1b. decoration candidates — artwork that is not content. Found before
  // anything is segmented so an aria-hidden wave, a background div or a
  // ::before ornament is kept as geometry instead of being thrown away.
  const DECO_CLASS_RE = /wave|divider|shape|deco|separator|curve|blob|ornament|swoosh|\bbg\b|background|pattern/i;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const MIN_DECO_PX = 120;
  const MAX_MARKUP = 50_000;
  const MARKUP_BUDGET = 400_000;
  type Rect = { x: number; y: number; w: number; h: number };
  type DecoCandidate = {
    el: Element;
    rect: Rect;
    kind: "svg" | "image" | "background" | "pseudo";
    svgMarkup?: string;
    src?: string;
    pseudo?: "before" | "after";
    fills: string[];
    opacity?: number;
    flipX?: boolean;
    flipY?: boolean;
    ariaHidden?: boolean;
    bgSize?: string;
    bgPosition?: string;
    bgRepeat?: string;
    naturalWidth?: number;
    naturalHeight?: number;
    zIndex: number;
    absolute: boolean;
    consumed?: boolean;
  };
  const decoCandidates: DecoCandidate[] = [];
  const decorativeSet = new Set<Element>();
  const rawWarnings: string[] = [];
  let markupBudget = MARKUP_BUDGET;

  const ariaHiddenWithin = (el: Element, levels: number) => {
    let cur: Element | null = el;
    for (let i = 0; cur && i <= levels; i++, cur = cur.parentElement) if (cur.getAttribute("aria-hidden") === "true") return true;
    return false;
  };
  const inOverlayOrHidden = (el: Element) => {
    for (let cur: Element | null = el; cur && cur !== doc.body; cur = cur.parentElement) {
      if (isExcludedTag(cur) || (isOverlay(cur) && !isHeaderLike(cur)) || cur.getAttribute("role") === "dialog" || CONSENT_RE.test(idClass(cur)) || /\bmodal\b/i.test(idClass(cur))) return true;
      const style = cs(cur);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return true;
    }
    return false;
  };
  /** Width of the box an absolutely positioned element is placed against. */
  const containingBlockWidth = (el: Element) => {
    for (let cur = el.parentElement; cur && cur !== doc.body; cur = cur.parentElement) {
      if (cs(cur).position !== "static") return rectOf(cur).w;
    }
    return vw;
  };
  const noText = (el: Element) => text(el).length < 2;
  const round3 = (n: number) => Math.round(n * 1000) / 1000;
  const flipsOf = (el: Element) => {
    let flipX = false;
    let flipY = false;
    for (let cur: Element | null = el, i = 0; cur && i < 3; cur = cur.parentElement, i++) {
      const m = cs(cur).transform.match(/matrix\(([^)]+)\)/);
      if (!m) continue;
      const [a, , , d] = m[1].split(",").map((n) => parseFloat(n));
      if (a < 0) flipX = !flipX;
      if (d < 0) flipY = !flipY;
    }
    return { flipX: flipX || undefined, flipY: flipY || undefined };
  };
  const fillsIn = (markup: string) => {
    const out: string[] = [];
    const re = /(?:fill|stroke|stop-color)\s*[=:]\s*["']?(rgba?\([^)]*\)|hsla?\([^)]*\)|[^"';)\s]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(markup)) && out.length < 6) {
      const v = m[1].trim();
      if (!v || /^(none|currentcolor|inherit|transparent|url\(|context-)/i.test(v) || out.includes(v)) continue;
      out.push(v.slice(0, 60));
    }
    return out;
  };
  /** Inline markup that renders the same outside the page: xmlns, sprites, computed colours. */
  const svgMarkupOf = (svg: Element): string | undefined => {
    const clone = svg.cloneNode(true) as Element;
    if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", SVG_NS);
    if (!clone.getAttribute("viewBox")) {
      const w = parseFloat(clone.getAttribute("width") || "") || rectOf(svg).w;
      const h = parseFloat(clone.getAttribute("height") || "") || rectOf(svg).h;
      if (w > 0 && h > 0) clone.setAttribute("viewBox", `0 0 ${Math.round(w)} ${Math.round(h)}`);
    }
    let uses = 0;
    for (const use of Array.from(clone.querySelectorAll("use"))) {
      if (uses++ >= 20) break;
      const href = use.getAttribute("href") || use.getAttribute("xlink:href") || "";
      const ref = href.startsWith("#") ? doc.getElementById(href.slice(1)) : null;
      if (!ref) continue;
      const wrap = doc.createElementNS(SVG_NS, ref.tagName.toLowerCase() === "symbol" ? "svg" : "g");
      for (const attr of ["viewBox", "preserveAspectRatio"]) if (ref.getAttribute(attr)) wrap.setAttribute(attr, ref.getAttribute(attr)!);
      for (const attr of ["x", "y", "width", "height", "transform", "fill", "stroke"]) if (use.getAttribute(attr)) wrap.setAttribute(attr, use.getAttribute(attr)!);
      for (const child of Array.from(ref.childNodes)) wrap.appendChild(child.cloneNode(true));
      use.replaceWith(wrap);
    }
    // Colours that come from the page's stylesheet or currentColor would be
    // lost outside the page: bake the computed values in as attributes.
    const original = Array.from(svg.querySelectorAll("*"));
    const copies = Array.from(clone.querySelectorAll("*"));
    const paintable = /^(path|circle|ellipse|rect|polygon|polyline|line|g|text|use)$/i;
    for (let i = 0; i < original.length && i < copies.length && i < 400; i++) {
      const source = original[i];
      const target = copies[i];
      if (!paintable.test(source.tagName) || source.tagName !== target.tagName) continue;
      const style = cs(source);
      for (const prop of ["fill", "stroke"] as const) {
        const attr = target.getAttribute(prop);
        const computed = style[prop];
        if ((!attr || /currentcolor/i.test(attr)) && computed && computed !== "none" && !/^url\(/.test(computed)) target.setAttribute(prop, computed);
        else if (!attr && computed === "none" && prop === "fill" && /^(path|circle|ellipse|rect|polygon)$/i.test(source.tagName)) target.setAttribute(prop, "none");
      }
      const opacity = style.fillOpacity;
      if (opacity && opacity !== "1" && !target.getAttribute("fill-opacity")) target.setAttribute("fill-opacity", opacity);
    }
    for (const el of Array.from(clone.querySelectorAll("script, style, foreignObject"))) el.remove();
    const markup = clone.outerHTML;
    return markup.length <= MAX_MARKUP ? markup : undefined;
  };
  const withinBudget = (markup: string | undefined) => {
    if (!markup) return undefined;
    if (markup.length > markupBudget) { if (!rawWarnings.includes("decoration_markup_budget")) rawWarnings.push("decoration_markup_budget"); return undefined; }
    markupBudget -= markup.length;
    return markup;
  };
  const pushCandidate = (c: DecoCandidate) => {
    if (decoCandidates.length >= 200) return;
    decoCandidates.push(c);
    // A pseudo-element's host (a footer, say) is still content; only real
    // artwork elements leave the content passes.
    if (c.kind === "pseudo") return;
    decorativeSet.add(c.el);
    for (const child of Array.from(c.el.querySelectorAll("*"))) decorativeSet.add(child);
  };
  const decorativeReason = (el: Element, kind: "svg" | "image" | "background") => {
    const style = cs(el);
    const r = rectOf(el);
    const strong = ariaHiddenWithin(el, 3) || el.getAttribute("role") === "presentation" || DECO_CLASS_RE.test(idClass(el) + " " + (el.parentElement ? idClass(el.parentElement) : "")) || style.pointerEvents === "none";
    const absolute = style.position === "absolute" && containingBlockWidth(el) >= vw * 0.6;
    const wide = kind !== "image" && r.w >= vw * 0.6 && r.h <= 320;
    return strong || absolute || wide;
  };
  let scanned = 0;
  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    if (scanned++ > 6000) break;
    if (decorativeSet.has(el)) continue;
    const tag = el.tagName.toLowerCase();
    const style = cs(el);
    // ::before / ::after artwork on a host that may itself carry text (a footer).
    for (const which of ["before", "after"] as const) {
      const ps = win.getComputedStyle(el, `::${which}`);
      const bg = ps.backgroundImage && ps.backgroundImage !== "none" ? ps.backgroundImage.match(/url\((['"]?)(.*?)\1\)/) : null;
      const content = ps.content && ps.content !== "none" ? ps.content.match(/url\((['"]?)(.*?)\1\)/) : null;
      const url = abs((bg ?? content)?.[2] ?? null);
      if (!url || inOverlayOrHidden(el) || tag === "svg") continue;
      const host = rectOf(el);
      const pw = parseFloat(ps.width);
      const ph = parseFloat(ps.height);
      const w = Number.isFinite(pw) ? pw : host.w;
      const h = Number.isFinite(ph) ? ph : host.h;
      if (w < 40 || h < 40) continue;
      const top = parseFloat(ps.top);
      const left = parseFloat(ps.left);
      const bottom = parseFloat(ps.bottom);
      const y = ps.position === "absolute" ? (Number.isFinite(top) ? host.y + top : Number.isFinite(bottom) ? host.y + host.h - bottom - h : host.y) : host.y;
      const x = ps.position === "absolute" && Number.isFinite(left) ? host.x + left : host.x;
      pushCandidate({ el, rect: { x, y, w, h }, kind: "pseudo", pseudo: which, src: url, fills: [], opacity: parseFloat(ps.opacity) || undefined, zIndex: parseInt(ps.zIndex, 10) || 0, absolute: ps.position === "absolute", bgSize: ps.backgroundSize, bgPosition: ps.backgroundPosition, bgRepeat: ps.backgroundRepeat });
    }
    if (tag === "picture" || tag === "source") continue;
    const isSvg = tag === "svg";
    const isImg = tag === "img";
    const bgUrl = !isSvg && !isImg ? bgImageUrl(el) : undefined;
    if (!isSvg && !isImg && !bgUrl) continue;
    if (isSvg && el.parentElement?.closest("svg")) continue;
    if (inOverlayOrHidden(el) || isVisuallyHidden(el)) continue;
    const r = rectOf(el);
    if (r.w < MIN_DECO_PX && r.h < MIN_DECO_PX) continue;
    const kind: "svg" | "image" | "background" = isSvg ? "svg" : isImg ? "image" : "background";
    if (!isImg && !noText(el)) continue;
    if (!decorativeReason(el, kind)) continue;
    const flips = flipsOf(el);
    const base = { el, rect: r, fills: [] as string[], opacity: parseFloat(style.opacity) < 1 ? parseFloat(style.opacity) : undefined, ...flips, ariaHidden: ariaHiddenWithin(el, 3) || undefined, zIndex: parseInt(style.zIndex, 10) || 0, absolute: style.position === "absolute" };
    if (isSvg) {
      const markup = withinBudget(svgMarkupOf(el));
      pushCandidate({ ...base, kind: "svg", svgMarkup: markup, fills: markup ? fillsIn(markup) : [] });
    } else if (isImg) {
      const img = el as HTMLImageElement;
      pushCandidate({ ...base, kind: "image", src: abs(img.currentSrc || img.getAttribute("src")), naturalWidth: img.naturalWidth || undefined, naturalHeight: img.naturalHeight || undefined });
    } else {
      pushCandidate({ ...base, kind: "background", src: bgUrl, bgSize: style.backgroundSize, bgPosition: style.backgroundPosition, bgRepeat: style.backgroundRepeat });
    }
  }
  const isDeco = (el: Element) => decorativeSet.has(el);
  /** First image-like descendant that is content, not decoration. */
  const contentMedia = (root: Element, selector: string) => Array.from(root.querySelectorAll(selector)).find((n) => !isEx(n) && !isDeco(n)) ?? null;

  // 2. chrome
  const pick = (selectors: string[], predicate: (el: Element) => boolean) => {
    for (const selector of selectors) {
      for (const el of Array.from(doc.querySelectorAll(selector))) {
        if (!isEx(el) && predicate(el)) return el;
      }
    }
    return null;
  };
  const docHeight = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
  const headerEl = pick([HEADER_SELECTOR, "nav"], (el) => {
    if (el.closest("main, article, footer")) return false;
    const r = rectOf(el);
    return r.y < 260 && r.h < 320 && r.w >= vw * 0.5;
  });
  const footerEl = (() => {
    const candidates = Array.from(doc.querySelectorAll("footer, [role=contentinfo]")).filter((el) => !isEx(el));
    if (candidates.length) return candidates[candidates.length - 1];
    return null;
  })();
  const chromeSet = new Set<Element>();
  for (const root of [headerEl, footerEl]) {
    if (!root) continue;
    chromeSet.add(root);
    for (const child of Array.from(root.querySelectorAll("*"))) chromeSet.add(child);
  }
  const inChrome = (el: Element) => chromeSet.has(el);

  const linkList = (root: Element, cap: number) => {
    const out: Array<{ text: string; href: string }> = [];
    const seen = new Set<string>();
    for (const a of Array.from(root.querySelectorAll("a[href]"))) {
      if (isEx(a)) continue;
      const href = abs(a.getAttribute("href"));
      const label = text(a).slice(0, 80);
      if (!href || !label || seen.has(href + label)) continue;
      seen.add(href + label);
      out.push({ text: label, href });
      if (out.length >= cap) break;
    }
    return out;
  };
  const imageInfo = (img: Element) => {
    if (img.tagName === "IMG") {
      const el = img as HTMLImageElement;
      const srcset = el.getAttribute("srcset");
      let src = abs(el.currentSrc || el.getAttribute("src"));
      if (srcset) {
        const best = srcset.split(",").map((part) => part.trim().split(/\s+/)).map(([url, size]) => ({ url, w: parseInt(size || "0", 10) || 0 })).filter((c) => c.w <= 2500).sort((a, b) => b.w - a.w)[0];
        if (best?.url) src = abs(best.url) || src;
      }
      const r = rectOf(el);
      const style = cs(el);
      return { src: src || "", alt: (el.getAttribute("alt") || "").slice(0, 500), naturalWidth: el.naturalWidth || undefined, naturalHeight: el.naturalHeight || undefined, displayWidth: r.w, displayHeight: r.h, x: r.x, y: r.y, position: style.position, objectFit: style.objectFit, isBackground: false as boolean, svgMarkup: undefined as string | undefined, decorative: undefined as boolean | undefined, role: undefined as ("ornament" | "icon" | "content") | undefined, anchor: undefined as { afterHeading?: string; beforeParagraph?: string; domIndex: number; position?: "start" | "inline" | "end" } | undefined };
    }
    if (img.tagName.toLowerCase() === "svg") {
      const r = rectOf(img);
      const markup = (img as Element).outerHTML;
      return { src: "", alt: (img.getAttribute("aria-label") || "").slice(0, 500), naturalWidth: undefined, naturalHeight: undefined, displayWidth: r.w, displayHeight: r.h, x: r.x, y: r.y, position: cs(img).position, objectFit: undefined as string | undefined, isBackground: false as boolean, svgMarkup: markup.length <= 50_000 ? markup : undefined, decorative: undefined as boolean | undefined, role: undefined as ("ornament" | "icon" | "content") | undefined, anchor: undefined as { afterHeading?: string; beforeParagraph?: string; domIndex: number; position?: "start" | "inline" | "end" } | undefined };
    }
    return null;
  };
  // A translucent layer laid over a backdrop: an absolutely positioned,
  // textless box the size of its section with a see-through colour.
  const alphaOf = (value: string) => { const m = value.match(/rgba?\(\s*\d+[,\s]+\d+[,\s]+\d+(?:[,\s/]+([\d.]+))?/i); return m ? (m[1] === undefined ? 1 : Number(m[1])) : value === "transparent" ? 0 : 1; };
  const scrimOf = (section: Element) => {
    const sr = rectOf(section);
    for (const child of Array.from(section.querySelectorAll("*")).slice(0, 60)) {
      if (isEx(child) || child.tagName === "IMG" || child.querySelector("img, h1, h2, h3, p")) continue;
      const style = cs(child);
      if (style.position !== "absolute" && style.position !== "fixed") continue;
      const cr = rectOf(child);
      if (cr.w < sr.w * 0.9 || cr.h < sr.h * 0.9) continue;
      const bg = style.backgroundColor;
      const alpha = alphaOf(bg);
      const gradient = style.backgroundImage && style.backgroundImage.includes("gradient");
      if ((alpha > 0 && alpha < 1) || gradient) return { color: bg && bg !== "transparent" ? bg : "rgba(0, 0, 0, 0.35)", alpha: gradient && alpha >= 1 ? 0.35 : alpha };
    }
    return undefined;
  };
  // Decoration between the words: a rule, a flourish, a small icon. Read
  // from the element kinds themes actually use for them, and remembered with
  // the heading and paragraph it sat between, so it can go back there.
  const ORNAMENT_SELECTOR = "hr, [class*='divid'], [class*='separat'], [class*='ornament'], [class*='decor'], .wp-block-separator";
  const pseudoImage = (el: Element, which: "::before" | "::after") => {
    const style = cs(el, which);
    const content = style.content && style.content !== "none" ? style.content.match(/url\((['\"]?)(.*?)\1\)/) : null;
    if (content) return abs(content[2]);
    const bg = style.backgroundImage && style.backgroundImage !== "none" ? style.backgroundImage.match(/url\((['\"]?)(.*?)\1\)/) : null;
    return bg ? abs(bg[2]) : undefined;
  };
  const logoIn = (root: Element | null) => {
    if (!root) return undefined;
    const candidates: Element[] = [];
    for (const a of Array.from(root.querySelectorAll("a[href]"))) {
      const href = a.getAttribute("href") || "";
      if (href === "/" || href === "./" || abs(href) === new URL("/", doc.baseURI).toString()) candidates.push(...Array.from(a.querySelectorAll("img, svg")));
    }
    candidates.push(...Array.from(root.querySelectorAll("img[alt*='logo' i], img[src*='logo' i], img[class*='logo' i], .logo img, .brand img, svg[class*='logo' i]")));
    for (const el of candidates) {
      if (isEx(el)) continue;
      const info = imageInfo(el);
      if (info && (info.src || info.svgMarkup)) return info;
    }
    return undefined;
  };

  /** The background and box of a chrome surface, so the rebuilt header/footer can carry its art. */
  const surfaceOf = (el: Element) => {
    const style = cs(el);
    const bg = bgImageUrl(el);
    return {
      bgColor: color(style.backgroundColor),
      bgImage: bg,
      bgSize: bg ? style.backgroundSize : undefined,
      bgPosition: bg ? style.backgroundPosition : undefined,
      bgRepeat: bg ? style.backgroundRepeat : undefined,
      textColor: color(style.color),
      bbox: rectOf(el),
    };
  };

  /**
   * Links from a menu that is not on screen.
   *
   * A hamburger menu, an off-canvas drawer, a `display:none` desktop
   * fallback: the site's real navigation, invisible at capture time and
   * therefore excluded everywhere else. `innerText` is empty on a hidden
   * element, so the label has to come from `textContent`.
   */
  const rawLinkList = (root: Element, cap: number) => {
    const out: Array<{ text: string; href: string }> = [];
    const seen = new Set<string>();
    for (const a of Array.from(root.querySelectorAll("a[href]"))) {
      const href = abs(a.getAttribute("href"));
      const label = ((a.textContent || "").replace(/\s+/g, " ").trim()).slice(0, 80);
      if (!href || !label || seen.has(href + label)) continue;
      seen.add(href + label);
      out.push({ text: label, href });
      if (out.length >= cap) break;
    }
    return out;
  };
  const homeHref = new URL("/", doc.baseURI).toString();
  const isHomeLink = (a: Element) => { const href = a.getAttribute("href") || ""; return href === "/" || href === "./" || abs(href) === homeHref; };

  const header = headerEl ? (() => {
    const logo = logoIn(headerEl);
    const brandLink = Array.from(headerEl.querySelectorAll("a[href]")).find(isHomeLink);
    const brandOwnText = brandLink ? ((brandLink.textContent || "").replace(/\s+/g, " ").trim()) : "";
    const brandHasLogo = !!brandLink && !!brandLink.querySelector("img, svg");
    const visible = linkList(headerEl, 20).filter((link) => !/^(mailto:|tel:)/i.test(link.href));
    // Anything that is not the home link counts as a menu item; a header with
    // one link is a logo, not a menu, and its real menu is behind a burger.
    const menuish = visible.filter((link) => abs(link.href) !== homeHref);
    let nav = visible;
    let menuHidden = false;
    if (menuish.length < 2) {
      const roots: Element[] = [];
      for (const el of Array.from(headerEl.querySelectorAll("nav, [role=navigation], .menu, ul[id*='menu'], ul[class*='menu']"))) roots.push(el);
      for (const button of Array.from(doc.querySelectorAll("button[aria-controls], a[aria-controls], [data-target]"))) {
        const id = button.getAttribute("aria-controls") || (button.getAttribute("data-target") || "").replace(/^#/, "");
        const target = id ? doc.getElementById(id) : null;
        if (target) roots.push(target);
      }
      for (const el of Array.from(doc.querySelectorAll("#mobile-menu, .mobile-menu, .et_mobile_menu, .elementor-nav-menu--dropdown, .off-canvas, .menu-mobile, [class*='mobile-nav'], [class*='offcanvas']"))) roots.push(el);
      for (const root of roots) {
        const links = rawLinkList(root, 20).filter((link) => !/^(mailto:|tel:)/i.test(link.href) && !/^javascript:/i.test(link.href));
        if (links.filter((link) => abs(link.href) !== homeHref).length >= 2) { nav = links; menuHidden = true; break; }
      }
    }
    const headerRect = rectOf(headerEl);
    const bgColor = (() => {
      const own = color(cs(headerEl).backgroundColor);
      if (own) return own;
      for (const child of Array.from(headerEl.querySelectorAll("*")).slice(0, 40)) {
        if (rectOf(child).w < vw * 0.9) continue;
        const bg = color(cs(child).backgroundColor);
        if (bg) return bg;
      }
      return undefined;
    })();
    const sticky = (() => {
      let el: Element | null = headerEl;
      for (let i = 0; el && i < 3; i++, el = el.parentElement) {
        const position = cs(el).position;
        if (position === "fixed" || position === "sticky") return true;
      }
      return false;
    })();
    return {
      ...surfaceOf(headerEl),
      logo,
      brandText: brandOwnText && brandOwnText.length <= 60 ? brandOwnText : undefined,
      /** What the original actually showed: a logo, a word, or both. */
      brandShown: (brandHasLogo || logo ? (brandOwnText ? "both" : "logo") : "text") as "logo" | "text" | "both",
      nav,
      menuHidden: menuHidden || undefined,
      bgColor,
      textColor: (() => { const link = headerEl.querySelector("a[href]"); return link ? color(cs(link).color) : undefined; })(),
      sticky: sticky || undefined,
      height: Math.round(headerRect.h) || undefined,
      logoHeight: (() => { const img = brandLink?.querySelector("img, svg") ?? headerEl.querySelector("img, svg"); const h = img ? Math.round(rectOf(img).h) : 0; return h > 0 ? h : undefined; })(),
      cta: (() => {
        const buttons = Array.from(headerEl.querySelectorAll("a[href], button")).filter((el) => !isEx(el) && isButtonLike(el) && text(el));
        const best = buttons.sort((a, b) => saturation(cs(b).backgroundColor) - saturation(cs(a).backgroundColor))[0];
        return best ? { text: text(best).slice(0, 120), href: abs(best.getAttribute("href")), primary: true } : undefined;
      })(),
      /** Filled in after segmentation: whether the first band runs under it. */
      transparent: undefined as boolean | undefined,
    };
  })() : undefined;

  const footer = footerEl ? (() => {
    const columns: Array<{ heading?: string; links: Array<{ text: string; href: string }>; text?: string }> = [];
    const kids = Array.from(footerEl.children).flatMap((child) => child.children.length >= 2 && child.querySelectorAll("a").length === 0 ? Array.from(child.children) : [child]);
    for (const col of kids.slice(0, 8)) {
      if (isEx(col)) continue;
      const heading = col.querySelector("h1,h2,h3,h4,h5,h6,strong");
      const links = linkList(col, 12).filter((link) => !/(facebook|instagram|linkedin|twitter|x\.com|youtube|tiktok)\./i.test(link.href));
      const body = text(col).slice(0, 600);
      if (!links.length && !body) continue;
      columns.push({ heading: heading ? text(heading).slice(0, 80) : undefined, links, text: links.length ? undefined : body });
    }
    const all = text(footerEl);
    const email = all.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    const phone = all.match(/(?:\+?\d[\d\s().-]{6,}\d)/)?.[0];
    const copyright = all.match(/(©|\(c\)|copyright)[^.|]{0,120}/i)?.[0]?.trim();
    const social = linkList(footerEl, 40).filter((link) => /(facebook|instagram|linkedin|twitter|x\.com|youtube|tiktok)\./i.test(link.href)).map((link) => ({ network: (link.href.match(/(facebook|instagram|linkedin|twitter|x\.com|youtube|tiktok)/i)?.[1] || "social").toLowerCase().replace("x.com", "x"), href: link.href })).slice(0, 10);
    return { ...surfaceOf(footerEl), columns: columns.slice(0, 6), contactText: [email, phone].filter(Boolean).join(" · ") || undefined, social, copyright: copyright?.slice(0, 200) };
  })() : undefined;

  // 3. segmentation
  //
  // The content root is measured against the page's CONTENT text, not its
  // whole body. Measured against the body — header and footer included — a
  // short sub-page with a fat WordPress footer never reached half, so `main`
  // was rejected and the root fell back to `<body>`: one giant section for
  // the entire page. The selector list also has to know the wrappers the
  // common builders emit, or their pages segment as one block.
  const chromeText = [headerEl, footerEl].reduce((n, el) => n + (el ? text(el).length : 0), 0);
  const contentText = Math.max(1, text(doc.body).length - chromeText);
  const chromeHeight = [headerEl, footerEl].reduce((n, el) => n + (el ? rectOf(el).h : 0), 0);
  const contentHeight = Math.max(1, docHeight - chromeHeight);
  const mainCandidate = pick(
    ["main", "[role=main]", "article", "#main-content", "#et-main-area", "#content", "#main", "#primary", ".site-main", ".site-content", ".entry-content", ".elementor[data-elementor-type]", "#page-container", ".content"],
    (el) => !inChrome(el) && !el.closest("header, footer") && (text(el).length >= contentText * 0.5 || rectOf(el).h >= contentHeight * 0.5)
  );
  const root = mainCandidate ?? doc.body;
  const significantChildren = (el: Element) => Array.from(el.children).filter((child) => !isEx(child) && !isDeco(child) && !inChrome(child) && rectOf(child).h > 0);
  const hasHeading = (el: Element) => !!el.querySelector("h1,h2,h3,h4");
  const ownBackground = (el: Element) => !!color(cs(el).backgroundColor) || !!bgImageUrl(el);
  // The thorough re-capture lowers the bars a page must clear to count as a
  // section, for pages whose content is real but smaller than a normal band.
  const minLeafH = opts.relaxed ? 60 : 120;
  const minLeafW = vw * (opts.relaxed ? 0.4 : 0.6);
  const minWalkH = opts.relaxed ? 24 : 40;
  const minSectionH = opts.relaxed ? 40 : 80;
  /** The classes the page builders give their own top-level bands. */
  const BUILDER_SECTION_RE = /\b(et_pb_section|elementor-top-section|elementor-section|e-con-boxed|wp-block-cover|wp-block-group|vc_row|brxe-section|fl-row)\b/;
  const distinctBackground = (el: Element) => {
    if (bgImageUrl(el)) return true;
    const own = color(cs(el).backgroundColor);
    if (!own) return false;
    return !el.parentElement || cs(el.parentElement).backgroundColor !== cs(el).backgroundColor;
  };
  const paddedBand = (el: Element) => {
    const style = cs(el);
    return parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0") >= 40;
  };
  const leafWorthy = (el: Element) => {
    const r = rectOf(el);
    if (r.h < minLeafH || r.w < minLeafW) return false;
    const cls = typeof el.className === "string" ? el.className : "";
    return /^(SECTION|ARTICLE|ASIDE)$/.test(el.tagName) || el.getAttribute("role") === "region" || BUILDER_SECTION_RE.test(cls) || hasHeading(el) || distinctBackground(el);
  };
  const sections: Element[] = [];
  const pushed = new Set<Element>();
  const strayOrnaments: Element[] = [];
  /**
   * Walk down to the real bands.
   *
   * Two rules used to stop the walk dead on ordinary WordPress markup. A
   * single child was only entered when it covered 90 % of the parent's AREA
   * — but the parent's rect includes the header and footer it does not hold,
   * and a centred 1200px wrapper in a 1440 viewport is 83 % wide — and a
   * container with one child could never be split. `body > #page > main`
   * therefore pushed the whole page as one section. A single significant
   * child is now always entered; what a leaf gives back is the innermost
   * BAND it sat in (its own background, or real vertical padding), so a
   * section keeps its colour and rhythm instead of reporting the inner
   * text wrapper.
   */
  const segment = (el: Element, depth: number, band?: Element) => {
    // Artwork the decoration pass claimed is placed by geometry, never walked.
    if (isEx(el) || isDeco(el) || inChrome(el)) return;
    const r = rectOf(el);
    if (r.h < minWalkH) {
      // Too short to be a section on its own — but if it is the single line
      // inside a coloured band (a "Book now" strip is exactly that), the
      // band is the section, and dropping it loses the strip entirely.
      if (band && band !== el && (leafWorthy(band) || rectOf(band).h >= minSectionH)) {
        if (!pushed.has(band)) { pushed.add(band); sections.push(band); }
        return;
      }
      // A divider band is this short too. Keep it and hand it to the section
      // it precedes.
      if (r.h > 0 && text(el).length === 0 && (el.matches(ORNAMENT_SELECTOR) || contentMedia(el, "img, svg, hr"))) strayOrnaments.push(el);
      return;
    }
    const here = distinctBackground(el) || paddedBand(el) ? el : band;
    const kids = significantChildren(el);
    if (kids.length === 1 && depth < 16) return segment(kids[0], depth + 1, here);
    const leafKids = kids.filter(leafWorthy);
    if ((r.h > vh * 1.5 || leafKids.length >= 2) && kids.length > 1 && depth < 10) {
      // Each child is its own band from here; the parent's is not theirs.
      for (const child of kids) segment(child, depth + 1, undefined);
      return;
    }
    // What gets kept is the band, not the inner wrapper the walk ended on:
    // a themed band is `<section style="padding:72px 0"><div class="inner">`,
    // and the inner div is both too short to count as a section and stripped
    // of the colour and rhythm the band carries.
    const keep = here && here !== el ? here : el;
    const kr = rectOf(keep);
    if (leafWorthy(keep) || kr.h >= minSectionH) {
      if (!pushed.has(keep)) { pushed.add(keep); sections.push(keep); }
    }
  };
  for (const child of significantChildren(root)) segment(child, 0);
  if (!sections.length && root !== doc.body) for (const child of significantChildren(doc.body)) segment(child, 0);

  // 4. merge pass on plain elements; sections are built after
  // A block that holds nothing but decoration (a wave wrapper) is not a section.
  const raw = sections.map((el) => ({ el, r: rectOf(el), heading: hasHeading(el), t: text(el) })).filter((s) => s.t.length > 0 || contentMedia(s.el, "img, svg, iframe, video"));
  const merged: Array<{ el: Element; extras: Element[] }> = [];
  // A band with its own background, or one carrying a picture, a video or a
  // form, is a section of its own however short and however heading-less:
  // swallowing it is how an image band or a coloured call-to-action strip
  // disappeared into the block above it.
  const standsAlone = (el: Element) => distinctBackground(el) || !!el.querySelector("img, svg, video, iframe, form");
  for (const entry of raw) {
    const prev = merged[merged.length - 1];
    if (prev && !entry.heading && entry.r.h < 200 && !standsAlone(entry.el)) { prev.extras.push(entry.el); continue; }
    const prevText = prev ? text(prev.el) : "";
    if (prev && entry.t && entry.t.length < 300 && prevText.includes(entry.t) && !standsAlone(entry.el)) { prev.extras.push(entry.el); continue; }
    merged.push({ el: entry.el, extras: [] });
  }
  // A page that segments into nothing (a thin page, a splash/redirect page, or
  // one whose whole body sits inside header/footer chrome) still has content
  // worth keeping. Fall back to the page root as a single section so the page
  // always yields a real section id instead of forcing the planner to invent
  // one. Marked so the admin can see it was a fallback rather than a reading.
  let bodyFallback = false;
  if (!merged.length) {
    const fallbackRoot = root ?? doc.body;
    if (fallbackRoot && (text(fallbackRoot).length > 0 || fallbackRoot.querySelector("img, svg, iframe, video"))) {
      merged.push({ el: fallbackRoot, extras: [] });
      bodyFallback = true;
    }
  }
  if (merged.length > opts.maxSections) {
    const last = merged[opts.maxSections - 1];
    for (const extra of merged.slice(opts.maxSections)) last.extras.push(extra.el, ...extra.extras);
    merged.length = opts.maxSections;
  }

  // 5. per-section extraction
  const priceRe = /(\d[\d.,]*)\s?(kr\.?|dkk|€|\$|£)|(kr\.?|dkk|€|\$|£)\s?\d[\d.,]*/i;
  const blockText = (root: Element) => {
    const out: string[] = [];
    const walk = (el: Element) => {
      if (isEx(el)) return;
      if (/^(P|LI|BLOCKQUOTE|DD|DT|FIGCAPTION|TD|TH|SPAN|DIV)$/.test(el.tagName)) {
        const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => (n.textContent || "").replace(/\s+/g, " ").trim()).join(" ").trim();
        if (own.length >= 2 && /^(P|LI|BLOCKQUOTE|DD|DT|FIGCAPTION|TD|TH)$/.test(el.tagName)) { out.push(text(el).slice(0, 1500)); return; }
        if (own.length >= 20 && /^(SPAN|DIV)$/.test(el.tagName) && !el.querySelector("p,li,h1,h2,h3,h4")) { out.push(own.slice(0, 1500)); return; }
      }
      for (const child of Array.from(el.children)) walk(child);
    };
    walk(root);
    return out;
  };
  const sigOf = (el: Element) => `${el.tagName}|${(typeof el.className === "string" ? el.className : "").split(/\s+/).filter(Boolean).sort().join(".")}|${Math.min(el.childElementCount, 6)}`;
  // A looser fingerprint: the same tag with the same number of children,
  // whatever extra classes one of them carries. It is what finds a row of
  // cards where one is "featured", "highlighted" or — as on the site this
  // was written for — the one review whose quote sits on its picture. Under
  // the exact signature those three cards split into a group of two and a
  // group of one, neither reached the minimum, and the whole review section
  // arrived as three loose quotes with the illustrations thrown away.
  const looseSigOf = (el: Element) => `${el.tagName}|${Math.min(el.childElementCount, 6)}`;
  const repeatedItems = (section: Element) => {
    let best: { items: Element[]; container: Element } | null = null;
    const consider = (container: Element, signature: (el: Element) => string) => {
      const kids = Array.from(container.children).filter((child) => !isEx(child) && rectOf(child).h > 24);
      if (kids.length < 3) return;
      const groups = new Map<string, Element[]>();
      for (const kid of kids) { const key = signature(kid); groups.set(key, [...(groups.get(key) ?? []), kid]); }
      for (const group of Array.from(groups.values())) {
        if (group.length < 3) continue;
        const heights = group.map((el) => rectOf(el).h).sort((a, b) => a - b);
        const median = heights[Math.floor(heights.length / 2)] || 1;
        const uniform = group.filter((el) => Math.abs(rectOf(el).h - median) <= median * 0.35);
        if (uniform.length >= 3 && (!best || uniform.length > best.items.length)) best = { items: uniform, container };
      }
    };
    const descendants = Array.from(section.querySelectorAll("*")).slice(0, 400);
    consider(section, sigOf);
    for (const el of descendants) { if (!isEx(el)) consider(el, sigOf); }
    // Only when nothing matched exactly: the same walk, one rule looser. A
    // page whose cards really are identical keeps the strict answer.
    if (!best) {
      consider(section, looseSigOf);
      for (const el of descendants) { if (!isEx(el)) consider(el, looseSigOf); }
    }
    if (!best) return { items: [] as any[], columns: 0 };
    const b = best as { items: Element[]; container: Element };
    const firstTop = rectOf(b.items[0]).y;
    const columns = b.items.filter((el) => Math.abs(rectOf(el).y - firstTop) <= 8).length;
    const items = b.items.slice(0, 40).map((el) => {
      const heading = el.querySelector("h1,h2,h3,h4,h5,h6,strong,b,[class*='title' i],[class*='name' i]");
      const itemRect = rectOf(el);
      const inside = (outer: Rect, inner: Rect, slack = 4) => inner.x >= outer.x - slack && inner.y >= outer.y - slack && inner.x + inner.w <= outer.x + outer.w + slack && inner.y + inner.h <= outer.y + outer.h + slack;
      // The card's picture: a content image, or an illustration the
      // decoration pass claimed (aria-hidden art inside a review card).
      let img: Element | null = contentMedia(el, "img, svg");
      let claimed: DecoCandidate | undefined;
      if (!img) {
        claimed = decoCandidates.find((c) => !c.consumed && (c.kind === "svg" || c.kind === "image") && el.contains(c.el) && inside(itemRect, c.rect, 8));
        if (claimed) { claimed.consumed = true; img = claimed.el; }
      }
      const link = el.querySelector("a[href]");
      const all = text(el);
      const title = heading ? text(heading).slice(0, 300) : undefined;
      const body = title ? all.replace(title, "").trim().slice(0, 1500) : all.slice(0, 1500);
      const price = all.match(priceRe)?.[0];
      const quoteEl = el.querySelector("blockquote, q, [class*='quote' i]");
      const icon = (() => {
        const iconEl = el.querySelector("i[class*='fa-'], i[class*='icon'], [class*='icon'] svg, svg");
        if (!iconEl) return undefined;
        const r = rectOf(iconEl);
        if (r.w > 96 || r.h > 96) return undefined;
        const cls = typeof iconEl.className === "string" ? iconEl.className : (iconEl as any).className?.baseVal || "";
        return (cls.match(/fa-[a-z0-9-]+|icon-[a-z0-9-]+|lucide-[a-z0-9-]+/i)?.[0] || "svg").slice(0, 80);
      })();
      const lines = all.split(/(?<=[.!?])\s+|\n/).map((s) => s.trim()).filter(Boolean);
      const person = (() => {
        if (!img) return {} as { personName?: string; role?: string };
        const short = Array.from(el.querySelectorAll("h3,h4,h5,strong,b,p,span")).map((n) => text(n)).filter((t) => t.length >= 3 && t.length <= 40);
        const name = short.find((t) => /^[A-ZÆØÅ][a-zæøå]+(\s[A-ZÆØÅ][a-zæøå.-]+){1,3}$/.test(t));
        if (!name) return {};
        const role = short.find((t) => t !== name && !/\d/.test(t) && t.length <= 40);
        return { personName: name, role };
      })();
      const imageInfoOf = img ? imageInfo(img) : null;
      // A card's photo is often a CSS background rather than an <img>: the
      // card then came through with no picture at all, and the words that sat
      // ON the photo were rebuilt on a plain card. Read the background of the
      // card and its first two wrappers, and remember whether the text was on
      // top of it — the same overlap rule the section-level backdrop uses.
      const bgHost = [el, el.firstElementChild, el.firstElementChild?.firstElementChild].find((node) => node && bgImageUrl(node)) as Element | undefined;
      const cssBg = bgHost ? bgImageUrl(bgHost) : undefined;
      const photoRect = img ? rectOf(img) : bgHost ? rectOf(bgHost) : undefined;
      const textEl = heading ?? el.querySelector("p, span, div");
      const textRect = textEl ? rectOf(textEl) : undefined;
      const overlaps = photoRect && textRect && textRect.w > 0 && textRect.h > 0
        ? Math.max(0, Math.min(photoRect.x + photoRect.w, textRect.x + textRect.w) - Math.max(photoRect.x, textRect.x)) *
          Math.max(0, Math.min(photoRect.y + photoRect.h, textRect.y + textRect.h) - Math.max(photoRect.y, textRect.y)) >= textRect.w * textRect.h * 0.5
        : false;
      // An inline illustration (a drawn character beside a review) is kept as
      // markup, with where it sat in the card and whether the quote was drawn
      // on top of it, so the rebuild can lay the card out the same way.
      const relTo = (outer: Rect, inner: Rect) => ({ x: round3((inner.x - outer.x) / (outer.w || 1)), y: round3((inner.y - outer.y) / (outer.h || 1)), w: round3(inner.w / (outer.w || 1)), h: round3(inner.h / (outer.h || 1)) });
      const bigSvg = !!img && img.tagName.toLowerCase() === "svg" && !!photoRect && (photoRect.w >= 80 || photoRect.h >= 80);
      const svgMarkup = bigSvg ? (claimed?.svgMarkup ?? withinBudget(svgMarkupOf(img!))) : undefined;
      const quoteRect = quoteEl ? rectOf(quoteEl) : null;
      const quoteInside = !!(photoRect && quoteRect && quoteRect.w > 0 && inside(photoRect, quoteRect, 6));
      const imageSrc = svgMarkup ? undefined : imageInfoOf?.src || cssBg || undefined;
      return {
        title, text: body, imageSrc,
        svgMarkup,
        imageIsCssBackground: !svgMarkup && !imageInfoOf?.src && !!cssBg ? true : undefined,
        imageBehindText: imageSrc && overlaps ? true : undefined,
        imageRect: (imageSrc || svgMarkup) && photoRect ? { x: Math.round(photoRect.x), y: Math.round(photoRect.y), w: Math.round(photoRect.w), h: Math.round(photoRect.h) } : undefined,
        imageRel: (imageSrc || svgMarkup) && photoRect ? relTo(itemRect, photoRect) : undefined,
        quoteInsideImage: quoteInside || undefined,
        quoteRel: quoteInside && photoRect && quoteRect ? relTo(photoRect, quoteRect) : undefined,
        href: link ? abs(link.getAttribute("href")) : undefined, price, icon, personName: person.personName, role: person.role,
        quote: quoteEl ? text(quoteEl).slice(0, 1500) : (/[“"«]/.test(all) && lines.length ? all.slice(0, 1500) : undefined),
      };
    });
    return { items, columns };
  };

  const extracted = merged.map((entry, index) => {
    const el = entry.el;
    const scope = [el, ...entry.extras];
    const q = <T extends Element>(selector: string) => scope.flatMap((s) => Array.from(s.querySelectorAll(selector))).filter((n) => !isEx(n) && !isDeco(n)) as T[];
    const r = rectOf(el);
    const last = entry.extras.length ? rectOf(entry.extras[entry.extras.length - 1]) : r;
    const bbox = { x: Math.max(0, r.x), y: r.y, w: Math.max(r.w, 1), h: Math.max(last.y + last.h - r.y, r.h) };
    const headings = q<HTMLElement>("h1,h2,h3,h4,h5,h6").map((h) => ({ level: Number(h.tagName[1]), text: text(h).slice(0, 500) })).filter((h) => h.text).slice(0, 10);
    const paragraphs = scope.flatMap((s) => blockText(s)).filter((p, i, arr) => arr.indexOf(p) === i).slice(0, 25);
    const lists = q<HTMLElement>("ul, ol").filter((l) => !l.closest("nav")).map((l) => Array.from(l.querySelectorAll(":scope > li")).map((li) => text(li).slice(0, 300)).filter(Boolean).slice(0, 30)).filter((l) => l.length).slice(0, 6);
    const quotes = q<HTMLElement>("blockquote, q").map((b) => ({ text: text(b).slice(0, 1500), cite: b.querySelector("cite, footer") ? text(b.querySelector("cite, footer")!).slice(0, 200) : undefined })).filter((x) => x.text).slice(0, 10);
    // A link is a call to action when it is styled as a button — or when it
    // is the only thing a band says. A coloured "Book your session" strip
    // whose link the theme styles with nothing but colour otherwise came
    // through as an empty band and was planned away as decoration.
    const ctaEls = q<HTMLElement>("a[href], button").filter((c) => {
      const label = text(c);
      if (!label || label.length > 120) return false;
      if (isButtonLike(c)) return true;
      return !c.closest("p, li, nav, h1, h2, h3, h4, h5, h6") && label.length === text(scope[0] ?? c).length;
    });
    const ctas = ctaEls.map((c) => ({ text: text(c).slice(0, 120), href: abs(c.getAttribute("href")), primary: false })).slice(0, 10);
    if (ctaEls.length) { let bestIdx = 0; let bestSat = -1; ctaEls.slice(0, 10).forEach((c, i) => { const s = saturation(cs(c).backgroundColor); if (s > bestSat) { bestSat = s; bestIdx = i; } }); if (ctas[bestIdx]) ctas[bestIdx].primary = true; }
    const images: any[] = [];
    for (const img of q<Element>("img, svg")) { const info = imageInfo(img); if (info && (info.src || info.svgMarkup)) images.push(info); if (images.length >= 40) break; }
    // The rects of the words: what decides, on the node side, whether an
    // image sits behind the text (a backdrop) or beside it (a picture).
    const textRects = q<HTMLElement>("h1,h2,h3,h4,p").map(rectOf).filter((t) => t.w > 0 && t.h > 0).slice(0, 12);
    // A picture that is only decoration — a rule, a flourish, an icon between
    // the words — is marked as such and remembered with its neighbours.
    const flow = q<Element>("h1,h2,h3,h4,h5,h6,p,li,img,svg,hr");
    const anchorFor = (el: Element) => {
      const at = flow.indexOf(el);
      let afterHeading: string | undefined;
      let beforeParagraph: string | undefined;
      for (let i = at - 1; i >= 0; i--) { if (/^H[1-6]$/.test(flow[i].tagName)) { afterHeading = text(flow[i]).slice(0, 500); break; } if (/^(P|LI)$/.test(flow[i].tagName) && text(flow[i])) break; }
      for (let i = at + 1; i < flow.length; i++) { if (/^(P|LI)$/.test(flow[i].tagName) && text(flow[i])) { beforeParagraph = text(flow[i]).slice(0, 1500); break; } if (/^H[1-6]$/.test(flow[i].tagName)) break; }
      const position: "start" | "inline" | "end" = at <= 0 ? "start" : at >= flow.length - 1 ? "end" : "inline";
      return { afterHeading, beforeParagraph, domIndex: Math.max(0, at), position };
    };
    const isOrnamentSize = (w: number, h: number) => (w < 220 && h < 140) || (h <= 48 && w <= vw * 0.6);
    for (const img of images) {
      const el = q<Element>("img, svg").find((n) => (n.tagName === "IMG" ? abs((n as HTMLImageElement).currentSrc || n.getAttribute("src")) === img.src || img.src === "" : n.outerHTML === img.svgMarkup));
      const w = img.displayWidth ?? 0, h = img.displayHeight ?? 0;
      const linked = !!el?.closest("a[href]");
      if (isOrnamentSize(w, h) && !(el && el.closest("li, [class*='card'], [class*='item'], [class*='feature'], [class*='team']") && linked)) {
        img.decorative = true;
        img.role = h <= 48 || w >= h * 3 ? "ornament" : "icon";
        if (el) img.anchor = anchorFor(el);
      }
    }
    // Ornaments themes draw without an <img>: a styled <hr>, a small box with
    // a background image, a ::before/::after flourish.
    for (const orn of q<Element>(ORNAMENT_SELECTOR).slice(0, 12)) {
      if (text(orn).length > 0) continue;
      const or = rectOf(orn);
      if (or.h <= 0 || or.h > 160) continue;
      const src = bgImageUrl(orn) ?? pseudoImage(orn, "::before") ?? pseudoImage(orn, "::after");
      if (!src || images.some((img) => img.src === src)) continue;
      images.push({ src, alt: "", displayWidth: or.w, displayHeight: or.h, x: or.x, y: or.y, isBackground: false, decorative: true, role: "ornament", anchor: anchorFor(orn) });
      if (images.length >= 40) break;
    }
    for (const stray of strayOrnaments) {
      const sr = rectOf(stray);
      if (!(sr.y + sr.h <= r.y + 8 && sr.y >= r.y - 240)) continue; // just above this section
      // A wave the decoration pass already holds is not read a second time here.
      const el = stray.matches("img, svg") ? (isDeco(stray) ? null : stray) : contentMedia(stray, "img, svg");
      const info = el ? imageInfo(el) : null;
      const src = info?.src || bgImageUrl(stray) || pseudoImage(stray, "::before") || pseudoImage(stray, "::after");
      if ((!src && !info?.svgMarkup) || images.some((img) => src && img.src === src)) continue;
      images.push({ ...(info ?? { src: src ?? "", alt: "", displayWidth: sr.w, displayHeight: sr.h, x: sr.x, y: sr.y }), src: src ?? "", isBackground: false, decorative: true, role: "ornament", anchor: { domIndex: 0, position: "start" } });
    }
    // The background is imported like any image but it is not the section's
    // picture: it goes last, flagged, so the first image stays the photo the
    // visitor sees in front of it. Themes often paint it on an inner wrapper
    // rather than the section itself, so those are read too.
    const backdropHosts = [...scope, ...scope.flatMap((s) => Array.from(s.children)).filter((c) => !isEx(c) && rectOf(c).w >= r.w * 0.85), ...scope.flatMap((s) => Array.from(s.children)).flatMap((c) => Array.from(c.children)).filter((c) => !isEx(c) && rectOf(c).w >= r.w * 0.85)];
    for (const s of backdropHosts) { const bg = bgImageUrl(s); if (bg && !images.some((img) => img.src === bg)) images.push({ src: bg, alt: "", isBackground: true, displayWidth: r.w, displayHeight: r.h, x: r.x, y: r.y }); }
    const overlay = scrimOf(el);
    const forms = q<HTMLFormElement>("form").map((f) => ({
      action: abs(f.getAttribute("action")),
      fields: Array.from(f.querySelectorAll("input, textarea, select")).filter((i) => !/hidden|submit|button/i.test((i as HTMLInputElement).type || "")).map((i) => { const input = i as HTMLInputElement; const label = input.id ? f.querySelector(`label[for='${input.id}']`) : input.closest("label"); return { type: (input.tagName === "TEXTAREA" ? "textarea" : input.tagName === "SELECT" ? "select" : input.type || "text").slice(0, 40), name: (input.name || "").slice(0, 120) || undefined, label: (label ? text(label) : input.placeholder || "").slice(0, 200) || undefined, required: input.required || undefined }; }).slice(0, 20),
      submitText: (() => { const b = f.querySelector("button[type=submit], input[type=submit], button"); return b ? (text(b) || (b as HTMLInputElement).value || "").slice(0, 80) || undefined : undefined; })(),
    })).slice(0, 3);
    const embeds = q<HTMLElement>("iframe, video, audio").map((e) => { const src = abs(e.getAttribute("src")) || abs(e.querySelector("source")?.getAttribute("src") || null) || ""; const kind = e.tagName === "VIDEO" ? "video" : e.tagName === "AUDIO" ? "audio" : /google\.com\/maps|openstreetmap|mapbox/i.test(src) ? "map" : "iframe"; return { kind, src }; }).filter((e) => e.src).slice(0, 6);
    const tables = q<HTMLTableElement>("table").map((t) => Array.from(t.querySelectorAll("tr")).slice(0, 20).map((row) => Array.from(row.querySelectorAll("th, td")).slice(0, 12).map((cell) => text(cell).slice(0, 200)))).slice(0, 2);
    const { items, columns } = repeatedItems(el);
    const full = scope.map((s) => text(s)).join(" ");
    const heading = q<HTMLElement>("h1,h2,h3")[0];
    const para = q<HTMLElement>("p")[0];
    const hasCarousel = /slider|swiper|carousel|slick|splide|glide/i.test(scope.map(idClass).join(" ") + " " + q<Element>("[class]").slice(0, 60).map(idClass).join(" "));
    const hiddenPanels = Array.from(el.querySelectorAll("[aria-expanded=false] ~ *, [hidden], details:not([open]) > *:not(summary)")).map((n) => (n.textContent || "").replace(/\s+/g, " ").trim()).filter((t) => t.length > 10);
    const style = cs(el);
    return {
      order: index,
      tag: el.tagName.toLowerCase(),
      domPath: (() => { const parts: string[] = []; let cur: Element | null = el; while (cur && parts.length < 5 && cur !== doc.body) { parts.unshift(`${cur.tagName.toLowerCase()}${cur.id ? "#" + cur.id : ""}${typeof cur.className === "string" && cur.className ? "." + cur.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}`); cur = cur.parentElement; } return parts.join(">").slice(0, 400); })(),
      bbox,
      bgColor: color(style.backgroundColor),
      bgImage: bgImageUrl(el),
      bgSize: bgImageUrl(el) ? style.backgroundSize : undefined,
      bgPosition: bgImageUrl(el) ? style.backgroundPosition : undefined,
      bgRepeat: bgImageUrl(el) ? style.backgroundRepeat : undefined,
      clipPath: style.clipPath && style.clipPath !== "none" ? style.clipPath.slice(0, 300) : undefined,
      maskImage: (() => { const mask = (style as any).maskImage || (style as any).webkitMaskImage; return mask && mask !== "none" ? String(mask).slice(0, 300) : undefined; })(),
      textColor: color(style.color),
      textAlign: style.textAlign,
      headingFont: heading ? fontOf(heading) : undefined,
      bodyFont: para ? fontOf(para) : fontOf(el),
      headingSize: heading ? parseFloat(cs(heading).fontSize) : undefined,
      // The personality of the band's headline: a site whose headings are
      // uppercase and widely tracked reads as a different site without it.
      headingWeight: heading ? Number(cs(heading).fontWeight) || undefined : undefined,
      headingTransform: heading && cs(heading).textTransform !== "none" ? cs(heading).textTransform.slice(0, 20) : undefined,
      headingLetterSpacing: heading && cs(heading).letterSpacing !== "normal" ? cs(heading).letterSpacing.slice(0, 20) : undefined,
      bodyLineHeight: para && cs(para).lineHeight !== "normal" ? cs(para).lineHeight.slice(0, 20) : undefined,
      paddingY: (parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0")) / 2,
      headings, paragraphs, lists, quotes, ctas, images, forms, embeds, tables, items,
      textRects,
      overlay,
      columns,
      hasCarousel,
      hiddenContent: hiddenPanels.length > 0,
      hiddenTexts: hiddenPanels.slice(0, 20).map((t) => t.slice(0, 1500)),
      textLength: full.length,
      wordCount: full.split(/\s+/).filter(Boolean).length,
      decorations: [] as Decoration[],
    };
  });

  // 5b. attribute the remaining decoration candidates to the section or
  // chrome surface they belong to, with the geometry the rebuild needs.
  type Decoration = {
    kind: "svg" | "image" | "background" | "pseudo";
    src?: string; svgMarkup?: string; bbox: Rect; rel: Rect;
    edge: "top" | "bottom" | "left" | "right" | "fill" | "float";
    overlap: "none" | "prev" | "next"; overlapPx?: number;
    zOrder: "behind" | "above"; fills: string[]; opacity?: number;
    flipX?: boolean; flipY?: boolean; ariaHidden?: boolean; pseudo?: "before" | "after";
    bgSize?: string; bgPosition?: string; bgRepeat?: string; domPath?: string;
    displayWidth?: number; displayHeight?: number; naturalWidth?: number; naturalHeight?: number;
  };
  const domPathOf = (el: Element) => { const parts: string[] = []; let cur: Element | null = el; while (cur && parts.length < 5 && cur !== doc.body) { parts.unshift(`${cur.tagName.toLowerCase()}${cur.id ? "#" + cur.id : ""}${typeof cur.className === "string" && cur.className ? "." + cur.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}`); cur = cur.parentElement; } return parts.join(">").slice(0, 400); };
  const headerDecorations: Decoration[] = [];
  const footerDecorations: Decoration[] = [];
  const hosts = extracted.map((section, index) => ({ index, rect: section.bbox, els: [merged[index].el, ...merged[index].extras] }));
  const vOverlap = (a: Rect, b: Rect) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  for (const c of decoCandidates) {
    if (c.consumed) continue;
    const r = c.rect;
    let target: { kind: "header" | "footer" | "section"; rect: Rect; index?: number; el?: Element } | null = null;
    if (headerEl && (headerEl === c.el || headerEl.contains(c.el))) target = { kind: "header", rect: rectOf(headerEl), el: headerEl };
    else if (footerEl && (footerEl === c.el || footerEl.contains(c.el))) target = { kind: "footer", rect: rectOf(footerEl), el: footerEl };
    else {
      const byDom = hosts.find((h) => h.els.some((el) => el === c.el || el.contains(c.el)));
      let host = byDom;
      if (!host) {
        let best = 0;
        for (const h of hosts) { const ov = vOverlap(r, h.rect); if (ov > best) { best = ov; host = h; } }
      }
      if (!host) {
        const prev = [...hosts].reverse().find((h) => h.rect.y + h.rect.h <= r.y);
        const next = hosts.find((h) => h.rect.y >= r.y + r.h);
        if (prev && (!next || r.y - (prev.rect.y + prev.rect.h) <= 8)) host = prev;
        else if (next) host = next;
      }
      if (host) target = { kind: "section", rect: host.rect, index: host.index, el: host.els[0] };
    }
    if (!target) continue;
    const list = target.kind === "header" ? headerDecorations : target.kind === "footer" ? footerDecorations : extracted[target.index!].decorations;
    if (list.length >= (target.kind === "section" ? 12 : 8)) continue;
    const h = target.rect;
    const cy = r.y + r.h / 2;
    const cx = r.x + r.w / 2;
    let edge: Decoration["edge"];
    if (r.w >= h.w * 0.9 && r.h >= h.h * 0.9) edge = "fill";
    else if (r.w >= h.w * 0.9 && r.h <= h.h * 0.35) edge = cy < h.y + h.h / 2 ? "top" : "bottom";
    else if (cy < h.y + h.h * 0.25) edge = "top";
    else if (cy > h.y + h.h * 0.75) edge = "bottom";
    else if (r.w <= h.w * 0.4 && r.h >= h.h * 0.5 && cx < h.x + h.w * 0.3) edge = "left";
    else if (r.w <= h.w * 0.4 && r.h >= h.h * 0.5 && cx > h.x + h.w * 0.7) edge = "right";
    else edge = "float";
    const neighbourBelow = target.kind === "section" ? hosts.find((x) => x.rect.y >= h.y + h.h - 8 && x.index !== target!.index) : undefined;
    const neighbourAbove = target.kind === "section" ? [...hosts].reverse().find((x) => x.rect.y + x.rect.h <= h.y + 8 && x.index !== target!.index) : undefined;
    const overNext = neighbourBelow ? r.y + r.h - Math.max(neighbourBelow.rect.y, h.y + h.h) : r.y + r.h - (h.y + h.h);
    const overPrev = neighbourAbove ? Math.min(neighbourAbove.rect.y + neighbourAbove.rect.h, h.y) - r.y : h.y - r.y;
    let overlap: Decoration["overlap"] = "none";
    let overlapPx: number | undefined;
    if (overNext > 8 && edge !== "fill") { overlap = "next"; overlapPx = Math.round(overNext); }
    else if (overPrev > 8 && edge !== "fill") { overlap = "prev"; overlapPx = Math.round(overPrev); }
    let zOrder: Decoration["zOrder"] = "above";
    if (c.kind === "background" || c.kind === "pseudo" || c.zIndex < 0) zOrder = "behind";
    else if (c.absolute) {
      const firstText = target.el ? target.el.querySelector("h1,h2,h3,h4,p,li,a,button") : null;
      const precedes = !!firstText && !!(c.el.compareDocumentPosition(firstText) & 4);
      zOrder = c.zIndex <= 0 && precedes ? "behind" : c.zIndex > 0 ? "above" : "behind";
    } else zOrder = edge === "float" ? "above" : "behind";
    list.push({
      kind: c.kind, src: c.src, svgMarkup: c.svgMarkup, bbox: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) },
      rel: { x: round3((r.x - h.x) / (h.w || 1)), y: round3((r.y - h.y) / (h.h || 1)), w: round3(r.w / (h.w || 1)), h: round3(r.h / (h.h || 1)) },
      edge, overlap, overlapPx, zOrder, fills: c.fills, opacity: c.opacity, flipX: c.flipX, flipY: c.flipY, ariaHidden: c.ariaHidden, pseudo: c.pseudo,
      bgSize: c.bgSize, bgPosition: c.bgPosition, bgRepeat: c.bgRepeat, domPath: domPathOf(c.el),
      displayWidth: Math.round(r.w), displayHeight: Math.round(r.h), naturalWidth: c.naturalWidth, naturalHeight: c.naturalHeight,
    });
  }
  // brand samples across the visible page
  const paletteSamples: Array<{ color: string; kind: "bg" | "text" | "cta" | "link" | "heading"; weight: number }> = [];
  const fontSamples: Array<{ family: string; kind: "heading" | "body"; weight: number }> = [];
  const radii: number[] = [];
  let cardShadow: "none" | "subtle" | "elevated" = "none";
  let counted = 0;
  const canvas = color(cs(doc.body).backgroundColor) || color(cs(doc.documentElement).backgroundColor) || "rgb(255, 255, 255)";
  paletteSamples.push({ color: canvas, kind: "bg", weight: vw * docHeight });
  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    if (counted++ > 3000) break;
    if (isEx(el)) continue;
    const style = cs(el);
    const r = el.getBoundingClientRect();
    const area = Math.max(0, r.width * r.height);
    if (area <= 0) continue;
    const bg = color(style.backgroundColor);
    // Only real buttons and links count as calls to action; a padded header
    // or a quote box with a background is a surface, not a button.
    const isCta = (/^(A|BUTTON)$/.test(el.tagName) || (el.tagName === "INPUT" && /submit|button/.test((el as HTMLInputElement).type)) || el.getAttribute("role") === "button") && isButtonLike(el);
    if (bg) paletteSamples.push({ color: bg, kind: isCta ? "cta" : "bg", weight: isCta ? 1 : area });
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => (n.textContent || "").trim()).join("").length;
    if (own > 0) {
      const size = parseFloat(style.fontSize) || 16;
      const isHeading = /^H[1-3]$/.test(el.tagName);
      paletteSamples.push({ color: color(style.color) || "rgb(0,0,0)", kind: isHeading ? "heading" : el.tagName === "A" ? "link" : "text", weight: own * size });
      fontSamples.push({ family: fontOf(el), kind: isHeading ? "heading" : "body", weight: isHeading ? 1 : own });
    }
    if (isCta) radii.push(parseFloat(style.borderTopLeftRadius) || 0);
    if (style.boxShadow && style.boxShadow !== "none") { const blur = parseFloat(style.boxShadow.split(" ")[3] || "0"); if (blur > 20) cardShadow = "elevated"; else if (cardShadow === "none") cardShadow = "subtle"; }
  }
  radii.sort((a, b) => a - b);
  const paddings = extracted.map((s) => s.paddingY).filter((p) => p > 0).sort((a, b) => a - b);

  const icons = Array.from(doc.querySelectorAll("link[rel*='icon' i]")).map((l) => ({ rel: (l.getAttribute("rel") || "").slice(0, 60), href: abs(l.getAttribute("href")) || "", sizes: l.getAttribute("sizes") || undefined })).filter((i) => i.href).slice(0, 10);
  const meta = (name: string) => (doc.querySelector(`meta[name='${name}'], meta[property='${name}']`)?.getAttribute("content") || "").trim() || undefined;

  // A header the first band runs under is drawn over the photo, not above it.
  // Known only once the sections are in hand, so it is filled in here.
  if (header && headerEl) {
    const headerRect = rectOf(headerEl);
    const firstTop = extracted.length ? extracted[0].bbox.y : Number.POSITIVE_INFINITY;
    const translucent = !header.bgColor || alphaOf(cs(headerEl).backgroundColor) < 0.1;
    header.transparent = translucent && firstTop < headerRect.y + headerRect.h - 1 ? true : undefined;
  }
  const headerOut = header ? { ...header, decorations: headerDecorations } : undefined;
  const footerOut = footer ? { ...footer, decorations: footerDecorations } : undefined;

  return {
    url: doc.location.href,
    title: (doc.title || "").slice(0, 500) || undefined,
    /** What the site calls itself — never the name typed into the admin form. */
    siteName: (meta("og:site_name") || "").slice(0, 120) || undefined,
    description: meta("description") || meta("og:description"),
    lang: (doc.documentElement.lang || "").slice(0, 20) || undefined,
    ogImage: abs(meta("og:image") || null),
    themeColor: meta("theme-color"),
    icons,
    fontsLoaded: Array.from(new Set(Array.from((doc as any).fonts ?? []).map((f: any) => String(f.family).replace(/["']/g, "")))).slice(0, 20) as string[],
    documentHeight: docHeight,
    chrome: { header: headerOut, footer: footerOut },
    sections: extracted,
    /** True when `sections` holds one page-root fallback rather than a real reading. */
    bodyFallback,
    warnings: rawWarnings,
    paletteSamples: paletteSamples.slice(0, 400),
    fontSamples: fontSamples.slice(0, 60),
    ctaRadiusPx: radii.length ? radii[Math.floor(radii.length / 2)] : undefined,
    medianSectionPaddingY: paddings.length ? paddings[Math.floor(paddings.length / 2)] : undefined,
    cardShadow,
  };
}

/** Click the consent banner's accept button, then hide whatever is left of it. */
export function dismissConsentInBrowser(): { detected: boolean; dismissed: boolean } {
  const CONSENT_RE = /cookie|consent|gdpr|cmp|cc-|privacy-banner|onetrust|cookiebot|usercentrics|coi-banner|cookiescript/i;
  const ACCEPT_RE = /^(accept(er)?( alle| all| cookies)?|acceptér( alle)?|tillad( alle)?|godkend( alle)?|ok(ay)?|jeg forstår|got it|i agree|agree|allow all|accept cookies|accept all cookies|ja tak|forstået)$/i;
  const idClass = (el: Element) => `${el.id || ""} ${typeof el.className === "string" ? el.className : ""}`;
  const containers = Array.from(document.querySelectorAll("*")).filter((el) => CONSENT_RE.test(idClass(el)) && el.getBoundingClientRect().height > 0);
  let detected = containers.length > 0;
  let dismissed = false;
  for (const container of containers) {
    const buttons = Array.from(container.querySelectorAll("button, a, [role=button], input[type=submit]"));
    const accept = buttons.find((b) => ACCEPT_RE.test((b.textContent || (b as HTMLInputElement).value || "").replace(/\s+/g, " ").trim()));
    if (accept) { (accept as HTMLElement).click(); dismissed = true; detected = true; break; }
  }
  for (const container of containers) {
    const style = getComputedStyle(container);
    if (style.position === "fixed" || style.position === "sticky") (container as HTMLElement).style.setProperty("display", "none", "important");
  }
  return { detected, dismissed };
}

/** Scroll through the page so lazy content loads, then return to the top. */
export async function scrollThroughInBrowser(stepDelayMs: number): Promise<void> {
  const height = () => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  const step = window.innerHeight;
  for (let y = 0; y < Math.min(height(), 20_000); y += step) {
    window.scrollTo(0, y);
    await new Promise((resolve) => setTimeout(resolve, stepDelayMs));
  }
  window.scrollTo(0, 0);
  try { await (document as any).fonts?.ready; } catch { /* no font API */ }
  await new Promise((resolve) => setTimeout(resolve, 600));
}
