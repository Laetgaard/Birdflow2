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
  const cs = (el: Element) => win.getComputedStyle(el);
  const isHidden = (el: Element) => {
    const style = cs(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return true;
    if (el.getAttribute("aria-hidden") === "true") return true;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return true;
    if (r.right < 0 || r.left > vw) return true;
    return false;
  };
  const isExcludedTag = (el: Element) => /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|LINK|META|IFRAME|OBJECT|EMBED)$/.test(el.tagName);
  const idClass = (el: Element) => `${el.id || ""} ${typeof el.className === "string" ? el.className : ""}`;
  const isOverlay = (el: Element) => {
    const style = cs(el);
    return style.position === "fixed" || style.position === "sticky";
  };

  // 1. exclusions
  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    if (excluded.has(el)) continue;
    if (isExcludedTag(el) || isHidden(el) || isOverlay(el) || el.getAttribute("role") === "dialog" || CONSENT_RE.test(idClass(el)) || /\bmodal\b/i.test(idClass(el))) {
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
  const headerEl = pick(["header", "[role=banner]", "nav"], (el) => { const r = rectOf(el); return r.y < 260 && r.h < 320 && r.w >= vw * 0.5; });
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
      return { src: src || "", alt: (el.getAttribute("alt") || "").slice(0, 500), naturalWidth: el.naturalWidth || undefined, naturalHeight: el.naturalHeight || undefined, displayWidth: r.w, displayHeight: r.h, isBackground: false as boolean, svgMarkup: undefined as string | undefined };
    }
    if (img.tagName.toLowerCase() === "svg") {
      const r = rectOf(img);
      const markup = (img as Element).outerHTML;
      return { src: "", alt: (img.getAttribute("aria-label") || "").slice(0, 500), naturalWidth: undefined, naturalHeight: undefined, displayWidth: r.w, displayHeight: r.h, isBackground: false as boolean, svgMarkup: markup.length <= 50_000 ? markup : undefined };
    }
    return null;
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

  const header = headerEl ? {
    logo: logoIn(headerEl),
    brandText: (() => { const a = headerEl.querySelector("a[href='/'], a[href='./']"); const t = a ? text(a) : ""; return t && t.length <= 60 ? t : undefined; })(),
    nav: linkList(headerEl, 20).filter((link) => !/^(mailto:|tel:)/i.test(link.href)),
    cta: (() => {
      const buttons = Array.from(headerEl.querySelectorAll("a[href], button")).filter((el) => !isEx(el) && isButtonLike(el) && text(el));
      const best = buttons.sort((a, b) => saturation(cs(b).backgroundColor) - saturation(cs(a).backgroundColor))[0];
      return best ? { text: text(best).slice(0, 120), href: abs(best.getAttribute("href")), primary: true } : undefined;
    })(),
  } : undefined;

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
    return { columns: columns.slice(0, 6), contactText: [email, phone].filter(Boolean).join(" · ") || undefined, social, copyright: copyright?.slice(0, 200) };
  })() : undefined;

  // 3. segmentation
  const bodyText = text(doc.body).length || 1;
  const mainCandidate = pick(["main", "[role=main]", "#content", "#main", ".content", ".site-content"], (el) => text(el).length >= bodyText * 0.5);
  const root = mainCandidate ?? doc.body;
  const significantChildren = (el: Element) => Array.from(el.children).filter((child) => !isEx(child) && !inChrome(child) && rectOf(child).h > 0);
  const hasHeading = (el: Element) => !!el.querySelector("h1,h2,h3,h4");
  const ownBackground = (el: Element) => !!color(cs(el).backgroundColor) || !!bgImageUrl(el);
  // The thorough re-capture lowers the bars a page must clear to count as a
  // section, for pages whose content is real but smaller than a normal band.
  const minLeafH = opts.relaxed ? 60 : 120;
  const minLeafW = vw * (opts.relaxed ? 0.4 : 0.6);
  const minWalkH = opts.relaxed ? 24 : 40;
  const minSectionH = opts.relaxed ? 40 : 80;
  const leafWorthy = (el: Element) => {
    const r = rectOf(el);
    if (r.h < minLeafH || r.w < minLeafW) return false;
    return /^(SECTION|ARTICLE|ASIDE)$/.test(el.tagName) || el.getAttribute("role") === "region" || hasHeading(el) || (ownBackground(el) && (!el.parentElement || cs(el.parentElement).backgroundColor !== cs(el).backgroundColor));
  };
  const sections: Element[] = [];
  const segment = (el: Element, depth: number) => {
    if (isEx(el) || inChrome(el)) return;
    const r = rectOf(el);
    if (r.h < minWalkH) return;
    const kids = significantChildren(el);
    const area = r.w * r.h;
    const bigKids = kids.filter((child) => { const cr = rectOf(child); return cr.w * cr.h >= area * 0.9; });
    if (kids.length === 1 && bigKids.length === 1 && depth < 12) return segment(kids[0], depth + 1);
    const leafKids = kids.filter(leafWorthy);
    if ((r.h > vh * 1.5 || leafKids.length >= 2) && kids.length > 1 && depth < 8) {
      for (const child of kids) segment(child, depth + 1);
      return;
    }
    if (leafWorthy(el) || r.h >= minSectionH) sections.push(el);
  };
  for (const child of significantChildren(root)) segment(child, 0);
  if (!sections.length && root !== doc.body) for (const child of significantChildren(doc.body)) segment(child, 0);

  // 4. merge pass on plain elements; sections are built after
  const raw = sections.map((el) => ({ el, r: rectOf(el), heading: hasHeading(el), t: text(el) })).filter((s) => s.t.length > 0 || s.el.querySelector("img, svg, iframe, video"));
  const merged: Array<{ el: Element; extras: Element[] }> = [];
  for (const entry of raw) {
    const prev = merged[merged.length - 1];
    if (prev && !entry.heading && entry.r.h < 200) { prev.extras.push(entry.el); continue; }
    const prevText = prev ? text(prev.el) : "";
    if (prev && entry.t && prevText.includes(entry.t)) { prev.extras.push(entry.el); continue; }
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
  const repeatedItems = (section: Element) => {
    let best: { items: Element[]; container: Element } | null = null;
    const consider = (container: Element) => {
      const kids = Array.from(container.children).filter((child) => !isEx(child) && rectOf(child).h > 24);
      if (kids.length < 3) return;
      const groups = new Map<string, Element[]>();
      for (const kid of kids) { const key = sigOf(kid); groups.set(key, [...(groups.get(key) ?? []), kid]); }
      for (const group of Array.from(groups.values())) {
        if (group.length < 3) continue;
        const heights = group.map((el) => rectOf(el).h).sort((a, b) => a - b);
        const median = heights[Math.floor(heights.length / 2)] || 1;
        const uniform = group.filter((el) => Math.abs(rectOf(el).h - median) <= median * 0.35);
        if (uniform.length >= 3 && (!best || uniform.length > best.items.length)) best = { items: uniform, container };
      }
    };
    consider(section);
    for (const el of Array.from(section.querySelectorAll("*")).slice(0, 400)) { if (!isEx(el)) consider(el); }
    if (!best) return { items: [] as any[], columns: 0 };
    const b = best as { items: Element[]; container: Element };
    const firstTop = rectOf(b.items[0]).y;
    const columns = b.items.filter((el) => Math.abs(rectOf(el).y - firstTop) <= 8).length;
    const items = b.items.slice(0, 40).map((el) => {
      const heading = el.querySelector("h1,h2,h3,h4,h5,h6,strong,b,[class*='title' i],[class*='name' i]");
      const img = el.querySelector("img, svg");
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
      return { title, text: body, imageSrc: imageInfoOf?.src || undefined, href: link ? abs(link.getAttribute("href")) : undefined, price, icon, personName: person.personName, role: person.role, quote: quoteEl ? text(quoteEl).slice(0, 1500) : (/[“"«]/.test(all) && lines.length ? all.slice(0, 1500) : undefined) };
    });
    return { items, columns };
  };

  const extracted = merged.map((entry, index) => {
    const el = entry.el;
    const scope = [el, ...entry.extras];
    const q = <T extends Element>(selector: string) => scope.flatMap((s) => Array.from(s.querySelectorAll(selector))).filter((n) => !isEx(n)) as T[];
    const r = rectOf(el);
    const last = entry.extras.length ? rectOf(entry.extras[entry.extras.length - 1]) : r;
    const bbox = { x: Math.max(0, r.x), y: r.y, w: Math.max(r.w, 1), h: Math.max(last.y + last.h - r.y, r.h) };
    const headings = q<HTMLElement>("h1,h2,h3,h4,h5,h6").map((h) => ({ level: Number(h.tagName[1]), text: text(h).slice(0, 500) })).filter((h) => h.text).slice(0, 10);
    const paragraphs = scope.flatMap((s) => blockText(s)).filter((p, i, arr) => arr.indexOf(p) === i).slice(0, 25);
    const lists = q<HTMLElement>("ul, ol").filter((l) => !l.closest("nav")).map((l) => Array.from(l.querySelectorAll(":scope > li")).map((li) => text(li).slice(0, 300)).filter(Boolean).slice(0, 30)).filter((l) => l.length).slice(0, 6);
    const quotes = q<HTMLElement>("blockquote, q").map((b) => ({ text: text(b).slice(0, 1500), cite: b.querySelector("cite, footer") ? text(b.querySelector("cite, footer")!).slice(0, 200) : undefined })).filter((x) => x.text).slice(0, 10);
    const ctaEls = q<HTMLElement>("a[href], button").filter((c) => isButtonLike(c) && text(c) && text(c).length <= 120);
    const ctas = ctaEls.map((c) => ({ text: text(c).slice(0, 120), href: abs(c.getAttribute("href")), primary: false })).slice(0, 10);
    if (ctaEls.length) { let bestIdx = 0; let bestSat = -1; ctaEls.slice(0, 10).forEach((c, i) => { const s = saturation(cs(c).backgroundColor); if (s > bestSat) { bestSat = s; bestIdx = i; } }); if (ctas[bestIdx]) ctas[bestIdx].primary = true; }
    const images: any[] = [];
    for (const img of q<Element>("img, svg")) { const info = imageInfo(img); if (info && (info.src || info.svgMarkup)) images.push(info); if (images.length >= 40) break; }
    for (const s of scope) { const bg = bgImageUrl(s); if (bg) images.unshift({ src: bg, alt: "", isBackground: true, displayWidth: r.w, displayHeight: r.h }); }
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
      textColor: color(style.color),
      textAlign: style.textAlign,
      headingFont: heading ? fontOf(heading) : undefined,
      bodyFont: para ? fontOf(para) : fontOf(el),
      headingSize: heading ? parseFloat(cs(heading).fontSize) : undefined,
      paddingY: (parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0")) / 2,
      headings, paragraphs, lists, quotes, ctas, images, forms, embeds, tables, items,
      columns,
      hasCarousel,
      hiddenContent: hiddenPanels.length > 0,
      hiddenTexts: hiddenPanels.slice(0, 20).map((t) => t.slice(0, 1500)),
      textLength: full.length,
      wordCount: full.split(/\s+/).filter(Boolean).length,
    };
  });

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

  return {
    url: doc.location.href,
    title: (doc.title || "").slice(0, 500) || undefined,
    description: meta("description") || meta("og:description"),
    lang: (doc.documentElement.lang || "").slice(0, 20) || undefined,
    ogImage: abs(meta("og:image") || null),
    themeColor: meta("theme-color"),
    icons,
    fontsLoaded: Array.from(new Set(Array.from((doc as any).fonts ?? []).map((f: any) => String(f.family).replace(/["']/g, "")))).slice(0, 20) as string[],
    documentHeight: docHeight,
    chrome: { header, footer },
    sections: extracted,
    /** True when `sections` holds one page-root fallback rather than a real reading. */
    bodyFallback,
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
