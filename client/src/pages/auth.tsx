import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/lib/locale";
import { BLUSH } from "@/components/bf2/theme";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthFormHeader } from "@/components/auth/AuthFormHeader";
import { AuthModeTabs } from "@/components/auth/AuthModeTabs";
import { AuthField } from "@/components/auth/AuthField";
import { AuthMobileReassurance } from "@/components/auth/AuthMobileReassurance";
import { AUTH_MODES, AUTH_SHARED, AUTH_VALIDATION, type AuthMode } from "@/components/auth/copy";

const SURFACE = {
  background: BLUSH,
  border: "2px solid rgba(0,0,0,0.08)",
};

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const defaultTab = searchParams.get("mode") === "signup" ? "signup" : "signin";

  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const { lang } = useLocale();
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>(defaultTab);

  const copy = AUTH_MODES[lang][mode];
  const shared = AUTH_SHARED[lang];
  const v = AUTH_VALIDATION[lang];

  // Schemas defined at render time so validation messages follow the locale.
  // Lang is stable during a single page visit (set on the marketing site
  // before the user navigates here), so these memos never recreate in practice.
  const signUpSchema = z.object({
    fullName: z.string().min(2, v.nameRequired),
    email: z.string().email(v.emailInvalid),
    phoneNumber: z.string().min(8, v.phoneRequired),
    password: z.string().min(8, v.passwordMin),
  });

  const signInSchema = z.object({
    email: z.string().email(v.emailInvalid),
    password: z.string().min(1, v.passwordRequired),
  });

  const signUpForm = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: "",
      password: "",
    },
  });

  const signInForm = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSignUp = async (data: z.infer<typeof signUpSchema>) => {
    try {
      setIsLoading(true);
      const result = await signUp({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
      });

      if (result.needsEmailConfirmation) {
        setLocation(`/check-email?email=${encodeURIComponent(data.email)}`);
      } else {
        toast({
          title: AUTH_MODES[lang].signup.successTitle,
          description: AUTH_MODES[lang].signup.successDescription,
        });
      }
    } catch (error: any) {
      toast({
        title: shared.errorTitle,
        description: error.message || shared.errorFallback,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSignIn = async (data: z.infer<typeof signInSchema>) => {
    try {
      setIsLoading(true);
      await signIn(data.email, data.password);
      toast({
        title: AUTH_MODES[lang].signin.successTitle,
        description: AUTH_MODES[lang].signin.successDescription,
      });
    } catch (error: any) {
      toast({
        title: shared.errorTitle,
        description: error.message || shared.invalidCredentials,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const signInErrors = signInForm.formState.errors;
  const signUpErrors = signUpForm.formState.errors;

  return (
    <AuthShell>
      <TabsPrimitive.Root
        value={mode}
        onValueChange={(value) => setMode(value as AuthMode)}
        className="w-full"
      >
        <AuthFormHeader copy={copy} />

        <div className="mt-7">
          <AuthModeTabs />
        </div>

        <div className="mt-5 rounded-[20px] p-5 sm:p-7" style={SURFACE}>
          <TabsPrimitive.Content value="signin" className="outline-none">
            <form onSubmit={signInForm.handleSubmit(onSignIn)} className="space-y-4">
              <AuthField
                id="signin-email"
                label={shared.labelEmail}
                placeholder={shared.placeholderEmail}
                error={signInErrors.email?.message}
                testId="input-email-signin"
                {...signInForm.register("email")}
              />
              <AuthField
                id="signin-password"
                label={shared.labelPassword}
                type="password"
                error={signInErrors.password?.message}
                testId="input-password-signin"
                action={
                  <Link href="/reset-password" className="bfa-link text-[13px]">
                    {shared.forgotPassword}
                  </Link>
                }
                {...signInForm.register("password")}
              />
              <button
                type="submit"
                className="bfa-submit"
                disabled={isLoading}
                aria-busy={isLoading}
                data-testid="button-signin"
              >
                {isLoading ? copy.loadingAction : copy.action}
              </button>
            </form>
          </TabsPrimitive.Content>

          <TabsPrimitive.Content value="signup" className="outline-none">
            <form onSubmit={signUpForm.handleSubmit(onSignUp)} className="space-y-4">
              <AuthField
                id="signup-name"
                label={shared.labelName}
                placeholder={shared.placeholderName}
                error={signUpErrors.fullName?.message}
                testId="input-name-signup"
                {...signUpForm.register("fullName")}
              />
              <AuthField
                id="signup-email"
                label={shared.labelEmail}
                placeholder={shared.placeholderEmail}
                error={signUpErrors.email?.message}
                testId="input-email-signup"
                {...signUpForm.register("email")}
              />
              <AuthField
                id="signup-phone"
                label={shared.labelPhone}
                placeholder={shared.placeholderPhone}
                error={signUpErrors.phoneNumber?.message}
                testId="input-phone-signup"
                {...signUpForm.register("phoneNumber")}
              />
              <AuthField
                id="signup-password"
                label={shared.labelPassword}
                type="password"
                placeholder={shared.placeholderPasswordNew}
                error={signUpErrors.password?.message}
                testId="input-password-signup"
                {...signUpForm.register("password")}
              />
              <button
                type="submit"
                className="bfa-submit"
                disabled={isLoading}
                aria-busy={isLoading}
                data-testid="button-signup"
              >
                {isLoading ? copy.loadingAction : copy.action}
              </button>
              <p className="m-0 text-[13px] leading-[1.6]" style={{ color: "rgba(0,0,0,0.7)" }}>
                {shared.termsPre}{" "}
                <Link href="/terms" className="bfa-link">{shared.termsLinkLabel}</Link>
                {" "}{shared.termsMid}{" "}
                <Link href="/privacy" className="bfa-link">{shared.privacyLinkLabel}</Link>
              </p>
            </form>
          </TabsPrimitive.Content>
        </div>

        <p className="mt-5 m-0 text-[14.5px]" style={{ color: "rgba(0,0,0,0.75)" }}>
          {copy.switchPrompt}{" "}
          <button
            type="button"
            className="bfa-link"
            onClick={() => setMode(copy.switchTo)}
            data-testid={`link-switch-to-${copy.switchTo}`}
          >
            {copy.switchAction}
          </button>
        </p>

        <AuthMobileReassurance />
      </TabsPrimitive.Root>
    </AuthShell>
  );
}
