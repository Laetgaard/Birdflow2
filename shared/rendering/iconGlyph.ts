/**
 * An icon name from someone else's website, as something a visitor can see.
 *
 * A migrated card carries the class name the source's icon font used —
 * `fa-heart`, `lucide-check`, `icon-star`. Both renderers printed that string
 * straight into the card, so a Font Awesome site came out with the word
 * "heart" where its icon had been. BirdFlow has no icon font: the registry's
 * own defaults are emoji. So a known name becomes the emoji that means the
 * same thing, an emoji passes through untouched, and a name nothing maps to
 * renders as nothing at all — an empty chip is better than a stray word.
 */

export const ICON_GLYPHS: Record<string, string> = {
  // contact & people
  phone: "📞", "phone-call": "📞", mobile: "📱", envelope: "✉️", mail: "✉️", "mail-open": "📨",
  user: "👤", users: "👥", "user-group": "👥", team: "👥", "user-check": "✅",
  "map-marker": "📍", "map-pin": "📍", location: "📍", map: "🗺️", globe: "🌍", building: "🏢", home: "🏠", house: "🏠",
  // time & booking
  calendar: "📅", "calendar-check": "📅", clock: "🕐", history: "🕐", hourglass: "⏳", bell: "🔔",
  // trust & quality
  check: "✅", "check-circle": "✅", "badge-check": "✅", shield: "🛡️", "shield-check": "🛡️", lock: "🔒", key: "🔑",
  star: "⭐", "star-half": "⭐", heart: "❤️", "thumbs-up": "👍", award: "🏆", trophy: "🏆", medal: "🏅", certificate: "📜", diamond: "💎", gem: "💎",
  // work & growth
  briefcase: "💼", "chart-line": "📈", "trending-up": "📈", "chart-bar": "📊", "bar-chart": "📊", target: "🎯", rocket: "🚀", bolt: "⚡", zap: "⚡", fire: "🔥", flame: "🔥",
  lightbulb: "💡", idea: "💡", brain: "🧠", puzzle: "🧩", gear: "⚙️", cog: "⚙️", settings: "⚙️", wrench: "🔧", tools: "🛠️", hammer: "🔨",
  // money
  money: "💰", "money-bill": "💰", coins: "🪙", "credit-card": "💳", tag: "🏷️", tags: "🏷️", cart: "🛒", "shopping-cart": "🛒", "shopping-bag": "🛍️", gift: "🎁",
  // talk
  comment: "💬", comments: "💬", "message-circle": "💬", "message-square": "💬", quote: "❝", "quote-left": "❝", headset: "🎧", microphone: "🎙️", mic: "🎙️",
  // craft & care
  palette: "🎨", brush: "🖌️", camera: "📷", image: "🖼️", video: "🎬", music: "🎵", book: "📖", "book-open": "📖", "graduation-cap": "🎓", pencil: "✏️", edit: "✏️", "file-text": "📄",
  leaf: "🌿", seedling: "🌱", tree: "🌳", flower: "🌸", sun: "☀️", moon: "🌙", water: "💧", droplet: "💧", wind: "🍃", spa: "🧘", yoga: "🧘", "hand-holding-heart": "🤲",
  stethoscope: "🩺", "heart-pulse": "💗", "first-aid": "🩹", pills: "💊", dumbbell: "🏋️", "running-shoe": "👟", bicycle: "🚲",
  // food & hospitality
  utensils: "🍽️", coffee: "☕", "wine-glass": "🍷", cake: "🍰", bed: "🛏️", car: "🚗", truck: "🚚", plane: "✈️", ship: "🚢",
  // structure
  code: "💻", laptop: "💻", desktop: "🖥️", server: "🗄️", database: "🗄️", cloud: "☁️", wifi: "📶", link: "🔗", share: "🔗", download: "⬇️", upload: "⬆️", search: "🔍", filter: "⚗️",
  megaphone: "📣", bullhorn: "📣", newspaper: "📰", "paper-plane": "📨", handshake: "🤝", "hands-helping": "🤝", smile: "😊", sparkles: "✨", magic: "✨", "wand-magic": "✨",
};

/** True for a string that is already something to look at, not a name. */
function isGlyph(value: string): boolean {
  // Anything that is not a plain ascii identifier is already a symbol.
  return !!value && !/^[a-z0-9][a-z0-9 _-]*$/i.test(value);
}

export function iconGlyph(icon: unknown): string {
  const raw = String(icon ?? "").trim();
  if (!raw) return "";
  if (isGlyph(raw)) return raw;
  const name = raw
    .toLowerCase()
    .replace(/^(fa[srlbd]?|fa|icon|lucide|bi|mdi|ti|feather)[-\s]+/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!name || name === "svg") return "";
  return ICON_GLYPHS[name] ?? ICON_GLYPHS[name.replace(/s$/, "")] ?? ICON_GLYPHS[name.split("-")[0]] ?? "";
}
