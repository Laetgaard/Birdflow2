/**
 * Did the customer ask for a new design — in their own words?
 *
 * This exists for migrated sites. A site rebuilt from the customer's own old
 * website carries that website's colours, fonts and spacing on purpose, so
 * the assistant's whole-site styling tools (apply_preset, update_brand_guide,
 * a global token rewrite) are closed there: one of them undoes the copy in a
 * single call, and "gør den mere moderne" is in the model's own playbook as a
 * reason to reach for exactly that.
 *
 * So the tools stay shut until the customer says what they want, and this is
 * the test. It looks for the phrases people actually use when they want the
 * look replaced — not for any mention of a colour: "skift farven på knappen"
 * is an edit, "skift farverne" is a redesign.
 *
 * Both mistakes are cheap: a phrase this misses costs one clarifying
 * question, and a false match costs a restyle the migration snapshot undoes.
 * That is why it is a word test and not another model call.
 */
export function asksForRedesign(prompt: string): boolean {
  const text = String(prompt ?? "").toLowerCase();
  const patterns = [
    /\bre[- ]?design/,
    /\b(nyt|andet|helt nyt|friskt?|moderne) design\b/,
    /\bdesign(et)? om\b/,
    /\bnyt (look|udseende|tema|udtryk)\b/,
    /\bmoderniser/,
    /\bny stil\b|\banden stil\b|\bskift stil(en)?\b/,
    // No leading \b on these two: JavaScript word boundaries are ASCII, so a
    // \b in front of "ændr" never matches at all.
    /(skift|ændr|ny[et]?) (hele )?(farvepalet|farvetema|farveskema)/,
    /(skift|ændr|nye) farver(ne)?\b(?!\s+(på|i) (knappen|teksten|overskriften|denne|den))/,
    /\bnye skrifttyper\b|\bskift skrifttype(rne|n)?\b/,
    /\bhele (siden|sitet|hjemmesiden) (skal|om)\b/,
    /\bnew (design|look|theme|style|colou?r scheme|palette)\b/,
    /\bmoderni[sz]e\b|\brestyle\b|\bre[- ]?theme\b/,
    /\bchange the (whole|entire) (design|look|style|palette)\b/,
  ];
  return patterns.some((pattern) => pattern.test(text));
}
