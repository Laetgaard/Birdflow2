import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useLocale } from "@/lib/locale";
import { AUTH_MODES, type AuthMode } from "./copy";

/* The mode switch. Radix keeps the tablist/tab semantics, arrow-key
   navigation and aria-selected; .bfa-tab in the page CSS gives the
   active tab its filled surface, heavier weight and underline bar so
   it is not told apart by colour alone. */

export function AuthModeTabs() {
  const { lang } = useLocale();
  const modes = AUTH_MODES[lang];
  return (
    <TabsPrimitive.List
      className="flex gap-1.5 p-1.5 rounded-[14px] w-full"
      style={{ background: "rgba(0,0,0,0.06)" }}
      aria-label={lang === "en" ? "Log in or create account" : "Log ind eller opret konto"}
    >
      {(Object.keys(modes) as AuthMode[]).map((mode) => (
        <TabsPrimitive.Trigger
          key={mode}
          value={mode}
          className="bfa-tab"
          data-testid={`tab-${mode}`}
        >
          {modes[mode].tab}
        </TabsPrimitive.Trigger>
      ))}
    </TabsPrimitive.List>
  );
}
