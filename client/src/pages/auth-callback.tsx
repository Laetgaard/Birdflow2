import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getSupabase } from "@/lib/supabaseClient";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = getSupabase();
        
        // Get the hash fragment from URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        if (type === "signup" || type === "email") {
          if (accessToken && refreshToken) {
            // Set the session from the tokens
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              throw error;
            }

            if (data.user) {
              // Verify with backend and create/update profile
              await fetch("/api/auth/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accessToken, refreshToken }),
              });

              setStatus("success");
              setMessage("Email verified! Redirecting to dashboard...");
              
              setTimeout(() => {
                setLocation("/dashboard");
              }, 1500);
              return;
            }
          }
        }

        // If we get here without proper tokens, try getting current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.email_confirmed_at) {
          setStatus("success");
          setMessage("Already verified! Redirecting...");
          setTimeout(() => {
            setLocation("/dashboard");
          }, 1000);
        } else {
          throw new Error("Unable to verify email. Please try again.");
        }
      } catch (error: any) {
        console.error("Callback error:", error);
        setStatus("error");
        setMessage(error.message || "Verification failed. Please try again.");
        
        setTimeout(() => {
          setLocation("/auth?mode=signin");
        }, 3000);
      }
    };

    handleCallback();
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8 max-w-md">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
            <h2 className="text-xl font-semibold">{message}</h2>
          </>
        )}
        
        {status === "success" && (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
            <h2 className="text-xl font-semibold text-green-600">{message}</h2>
          </>
        )}
        
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold text-destructive">{message}</h2>
            <p className="text-muted-foreground text-sm">Redirecting to sign in...</p>
          </>
        )}
      </div>
    </div>
  );
}
