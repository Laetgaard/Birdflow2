import { BLUE } from "@/components/bf2/theme";

/* ─────────────────────────────────────────────────────────────
   Page-scoped CSS for /auth.

   Injected next to the shared bf2 PAGE_CSS, and built from the
   shared tokens rather than new ones — this only covers the states
   inline styles cannot express (hover, focus-visible, active,
   disabled, invalid, the Radix data-state on the tabs). The
   reduced-motion rule in PAGE_CSS already switches every transition
   below off, because the page wrapper carries .bf2-page.
   ───────────────────────────────────────────────────────────── */

export const AUTH_CSS = `
.bfa-input {
  display: block;
  width: 100%;
  height: 48px;
  padding: 0 14px;
  border-radius: 12px;
  border: 2px solid rgba(0,0,0,0.14);
  background: #FFFFFF;
  color: #000000;
  font-family: 'Nunito', sans-serif;
  font-size: 16px;
  font-weight: 600;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.bfa-input::placeholder { color: rgba(0,0,0,0.42); font-weight: 500; }
.bfa-input:hover { border-color: rgba(0,0,0,0.26); }
.bfa-input:focus { border-color: ${BLUE}; box-shadow: 0 0 0 4px rgba(48,109,218,0.22); }
.bfa-input[aria-invalid="true"] { border-color: #000000; }
.bfa-input[aria-invalid="true"]:focus { box-shadow: 0 0 0 4px rgba(0,0,0,0.16); }

/* Tabs: the active one is told apart by its filled surface, heavier
   weight and the bar underneath it — not by colour alone. */
.bfa-tab {
  flex: 1 1 0;
  min-height: 46px;
  padding: 0 14px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: rgba(0,0,0,0.62);
  font-family: 'Nunito', sans-serif;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.bfa-tab:hover { color: #000000; background: rgba(255,255,255,0.55); }
.bfa-tab[data-state="active"] {
  background: #FFFFFF;
  color: #000000;
  font-weight: 800;
  box-shadow: inset 0 -3px 0 0 ${BLUE};
}
.bfa-tab:focus-visible { outline: 3px solid ${BLUE}; outline-offset: 2px; }

.bfa-submit {
  display: block;
  width: 100%;
  min-height: 52px;
  padding: 0 20px;
  border: none;
  border-radius: 12px;
  background: ${BLUE};
  color: #FFFFFF;
  font-family: 'Nunito', sans-serif;
  font-size: 16.5px;
  font-weight: 800;
  cursor: pointer;
  transition: filter 0.15s ease, transform 0.1s ease;
}
.bfa-submit:hover:not(:disabled) { filter: brightness(1.08); }
.bfa-submit:active:not(:disabled) { transform: translateY(1px); filter: brightness(0.94); }
.bfa-submit:focus-visible { outline: 3px solid #000000; outline-offset: 3px; }
.bfa-submit:disabled { opacity: 0.62; cursor: not-allowed; }

.bfa-link {
  color: ${BLUE};
  font-weight: 800;
  text-decoration: none;
  background: none;
  border: none;
  padding: 0;
  font-family: 'Nunito', sans-serif;
  font-size: inherit;
  cursor: pointer;
}
.bfa-link:hover { text-decoration: underline; }
.bfa-link:focus-visible { outline: 3px solid ${BLUE}; outline-offset: 3px; border-radius: 4px; }

.bfa-logo:focus-visible { outline: 3px solid #FFFFFF; outline-offset: 6px; border-radius: 8px; }
.bfa-logo-dark:focus-visible { outline-color: ${BLUE}; }

/* Toasts are app furniture rendered outside this page's wrapper, so they
   need a global selector — but this stylesheet only exists while /auth is
   mounted, so no other page is restyled by it. */
li[role="status"], li[role="status"] * { font-family: 'Nunito', sans-serif; }
`;
