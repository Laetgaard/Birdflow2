import { JOURNEY } from "./copy";

/* The three numbered steps of the Birdflow journey. Rendered twice:
   in full on the purple brand panel (tone="onPurple") and condensed
   under the form on mobile (tone="onLight"), from the same copy. */

export function AuthJourney({ tone }: { tone: "onPurple" | "onLight" }) {
  const onPurple = tone === "onPurple";
  const text = onPurple ? "#FFFFFF" : "#000000";
  const rule = onPurple ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)";

  return (
    <ol className="list-none m-0 p-0" data-testid={`auth-journey-${tone}`}>
      {JOURNEY.map((step, i) => (
        <li
          key={step.number}
          className={onPurple ? "py-4 lg:py-5" : "py-3"}
          style={{ borderTop: i === 0 ? "none" : `1.5px solid ${rule}` }}
        >
          <p
            className={`m-0 font-extrabold ${onPurple ? "text-[15px] lg:text-[17px]" : "text-[14.5px]"}`}
            style={{ color: text }}
          >
            <span className="tabular-nums">{step.number}</span>
            <span aria-hidden="true"> — </span>
            {step.title}
          </p>
          <p
            className={`m-0 mt-1 leading-[1.5] ${onPurple ? "hidden lg:block text-[14.5px]" : "text-[13.5px]"}`}
            style={{ color: onPurple ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)" }}
          >
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  );
}
