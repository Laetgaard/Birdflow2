import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

/* One labelled field: visible Nunito label, brand-styled input and, when
   react-hook-form reports a problem, an alert-role message tied to the
   input through aria-describedby. Forwards the ref so the caller can
   spread register() straight onto it. */

type AuthFieldProps = ComponentProps<"input"> & {
  id: string;
  label: string;
  error?: string;
  testId: string;
  /** Sits opposite the label — the forgot-password link uses it. */
  action?: ReactNode;
};

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
  function AuthField({ id, label, error, testId, action, ...inputProps }, ref) {
    const errorId = `${id}-error`;
    return (
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <label htmlFor={id} className="text-[14px] font-extrabold text-black">
            {label}
          </label>
          {action}
        </div>
        <input
          {...inputProps}
          id={id}
          ref={ref}
          className="bfa-input"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          data-testid={testId}
        />
        {error && (
          <p
            id={errorId}
            role="alert"
            className="flex items-start gap-1.5 m-0 mt-1.5 text-[13.5px] font-bold text-black"
          >
            <AlertCircle className="w-4 h-4 mt-[1px] shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  },
);
