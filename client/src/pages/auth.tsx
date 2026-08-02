import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { BLUSH } from "@/components/bf2/theme";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthFormHeader } from "@/components/auth/AuthFormHeader";
import { AuthModeTabs } from "@/components/auth/AuthModeTabs";
import { AuthField } from "@/components/auth/AuthField";
import { AuthMobileReassurance } from "@/components/auth/AuthMobileReassurance";
import { AUTH_MODES, type AuthMode } from "@/components/auth/copy";

const signUpSchema = z.object({
  fullName: z.string().min(2, "Navn er påkrævet"),
  email: z.string().email("Ugyldig email adresse"),
  phoneNumber: z.string().min(8, "Telefonnummer er påkrævet"),
  password: z.string().min(8, "Adgangskode skal være mindst 8 tegn"),
});

const signInSchema = z.object({
  email: z.string().email("Ugyldig email adresse"),
  password: z.string().min(1, "Adgangskode er påkrævet"),
});

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
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>(defaultTab);
  const copy = AUTH_MODES[mode];

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
          title: "Konto oprettet!",
          description: "Velkommen til Birdflow.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message || "Noget gik galt. Prøv venligst igen.",
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
        title: "Velkommen tilbage!",
        description: "Du er nu logget ind.",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message || "Ugyldige loginoplysninger.",
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
                label="Email"
                placeholder="din@email.dk"
                error={signInErrors.email?.message}
                testId="input-email-signin"
                {...signInForm.register("email")}
              />
              <AuthField
                id="signin-password"
                label="Adgangskode"
                type="password"
                error={signInErrors.password?.message}
                testId="input-password-signin"
                action={
                  <Link href="/reset-password" className="bfa-link text-[13px]">
                    Glemt adgangskode?
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
                {isLoading ? AUTH_MODES.signin.loadingAction : AUTH_MODES.signin.action}
              </button>
            </form>
          </TabsPrimitive.Content>

          <TabsPrimitive.Content value="signup" className="outline-none">
            <form onSubmit={signUpForm.handleSubmit(onSignUp)} className="space-y-4">
              <AuthField
                id="signup-name"
                label="Fulde navn"
                placeholder="Dit navn"
                error={signUpErrors.fullName?.message}
                testId="input-name-signup"
                {...signUpForm.register("fullName")}
              />
              <AuthField
                id="signup-email"
                label="Email"
                placeholder="din@email.dk"
                error={signUpErrors.email?.message}
                testId="input-email-signup"
                {...signUpForm.register("email")}
              />
              <AuthField
                id="signup-phone"
                label="Telefonnummer"
                placeholder="+45 12 34 56 78"
                error={signUpErrors.phoneNumber?.message}
                testId="input-phone-signup"
                {...signUpForm.register("phoneNumber")}
              />
              <AuthField
                id="signup-password"
                label="Adgangskode"
                type="password"
                placeholder="Mindst 8 tegn"
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
                {isLoading ? AUTH_MODES.signup.loadingAction : AUTH_MODES.signup.action}
              </button>
              <p className="m-0 text-[13px] leading-[1.6]" style={{ color: "rgba(0,0,0,0.7)" }}>
                Ved at oprette en konto accepterer du vores{" "}
                <Link href="/terms" className="bfa-link">vilkår</Link>
                {" "}og{" "}
                <Link href="/privacy" className="bfa-link">privatlivspolitik</Link>
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
