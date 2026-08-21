import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireOnboarding?: boolean;
  /** Which auth mode to land on when the user isn't signed in. Defaults to
   *  "signin" so existing users get the sign-in form; pass "signup" for routes
   *  that new (not-yet-registered) users are most likely to hit first. */
  authMode?: "signin" | "signup";
}

export default function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  requireOnboarding = true,
  authMode = "signin",
}: ProtectedRouteProps) {
  const { user, profile, isLoading, isEmailVerified } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      setLocation(`/auth?mode=${authMode}`);
      return;
    }

    if (!isEmailVerified) {
      setLocation("/verify-email");
      return;
    }

    if (requireOnboarding && profile && !profile.onboardingCompleted) {
      setLocation("/onboarding");
      return;
    }

    if (requireAdmin && profile && !profile.isAdmin) {
      setLocation("/dashboard");
      return;
    }
  }, [user, profile, isLoading, isEmailVerified, setLocation, requireAdmin, requireOnboarding]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isEmailVerified) {
    return null;
  }

  if (requireOnboarding && profile && !profile.onboardingCompleted) {
    return null;
  }

  if (requireAdmin && profile && !profile.isAdmin) {
    return null;
  }

  return <>{children}</>;
}
