/**
 * Reading a JSON payload that was cut off mid-sentence.
 *
 * When a model hits its completion ceiling while writing a tool call, the
 * arguments arrive as valid JSON with the end missing — often a list where
 * the first nine entries are perfect and the tenth stops mid-word. Handing
 * that to JSON.parse throws, and the whole run is discarded. For plan mode
 * that meant a customer waiting a minute and getting nothing, when nine
 * usable steps were sitting in the response.
 *
 * So: rewind to the last point where the document was structurally sound,
 * close whatever is still open, and parse that. The half-written entry is
 * dropped — never guessed at. The caller is told recovery happened so it can
 * say so out loud; silently returning nine of ten steps as if nothing were
 * wrong would be worse than failing.
 */

/** How many rewind candidates to try before giving up. */
const MAX_ATTEMPTS = 400;

type CutPoint = { end: number; stack: string[] };

/**
 * Every position where the text could be truncated and still closed into a
 * valid document: after a finished token, or just before a comma.
 */
function findCutPoints(text: string): CutPoint[] {
  const points: CutPoint[] = [];
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
        points.push({ end: i + 1, stack: [...stack] });
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }
    if (char === "}" || char === "]") {
      stack.pop();
      points.push({ end: i + 1, stack: [...stack] });
      continue;
    }
    if (char === ",") {
      // Cut BEFORE the comma: whatever followed it is unfinished.
      points.push({ end: i, stack: [...stack] });
      continue;
    }
    // A bare token (number, true, false, null) ends where whitespace or a
    // structural character begins; the next iteration records that.
    if (/\s/.test(char) && i > 0 && /[\d"eslu]/.test(text[i - 1] ?? "")) {
      points.push({ end: i, stack: [...stack] });
    }
  }

  return points;
}

function close(text: string, stack: string[]): string {
  let out = text;
  for (let i = stack.length - 1; i >= 0; i--) {
    out += stack[i] === "{" ? "}" : "]";
  }
  return out;
}

export type PartialParse =
  | { ok: true; value: unknown; recovered: boolean }
  | { ok: false };

/**
 * Parse JSON, falling back to the longest valid prefix.
 *
 * `recovered: true` means the tail was dropped — the caller must treat the
 * result as incomplete and tell the customer.
 */
export function parsePartialJson(text: string): PartialParse {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false };

  try {
    return { ok: true, value: JSON.parse(trimmed), recovered: false };
  } catch {
    // fall through to recovery
  }

  const points = findCutPoints(trimmed);
  let attempts = 0;

  for (let i = points.length - 1; i >= 0 && attempts < MAX_ATTEMPTS; i--) {
    const point = points[i];
    if (point.end <= 0) continue;
    attempts += 1;
    try {
      const value = JSON.parse(close(trimmed.slice(0, point.end), point.stack));
      return { ok: true, value, recovered: true };
    } catch {
      continue;
    }
  }

  return { ok: false };
}
