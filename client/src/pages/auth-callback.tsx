import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getSupabase } from "@/lib/supabaseClient";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Bekræfter din email...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = getSupabase();
        
        // Get the hash fragment from URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        // Helper function to verify and ensure profile exists
        const verifyAndEnsureProfile = async (
          userId: string, 
          accessToken: string, 
          refreshToken: string
        ): Promise<{ profile: any; onboardingCompleted: boolean }> => {
          // Call verify endpoint which creates the profile
          const verifyResponse = await fetch("/api/auth/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken, refreshToken }),
          });
          
          if (verifyResponse.ok) {
            const data = await verifyResponse.json();
            if (data.profile) {
              return { profile: data.profile, onboardingCompleted: data.profile.onboardingCompleted || false };
            }
          }
          
          // If verify didn't return profile, retry fetching profile with retries
          for (let attempt = 0; attempt < 3; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            
            try {
              const profileResponse = await fetch(`/api/profile/${userId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              });
              if (profileResponse.ok) {
                const profile = await profileResponse.json();
                return { profile, onboardingCompleted: profile?.onboardingCompleted || false };
              }
            } catch (e) {
              console.error(`Profile fetch attempt ${attempt + 1} failed:`, e);
            }
          }
          
          // Profile creation failed - throw error instead of proceeding without profile
          throw new Error("Kunne ikke oprette din profil. Prøv at logge ind igen.");
        };

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
              // Verify with backend and ensure profile exists
              const { onboardingCompleted } = await verifyAndEnsureProfile(
                data.user.id, 
                accessToken, 
                refreshToken
              );
              const redirectPath = onboardingCompleted ? "/dashboard" : "/onboarding";
              
              setStatus("success");
              setMessage(redirectPath === "/onboarding" 
                ? "Email bekræftet! Sender dig videre til opsætning..." 
                : "Email bekræftet! Sender dig videre...");
              
              setTimeout(() => {
                setLocation(redirectPath);
              }, 1500);
              return;
            }
          }
        }

        // If we get here without proper tokens, try getting current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.email_confirmed_at) {
          const { onboardingCompleted } = await verifyAndEnsureProfile(
            session.user.id,
            session.access_token, 
            session.refresh_token
          );
          const redirectPath = onboardingCompleted ? "/dashboard" : "/onboarding";
          setStatus("success");
          setMessage("Allerede bekræftet! Sender dig videre...");
          setTimeout(() => {
            setLocation(redirectPath);
          }, 1000);
        } else {
          throw new Error("Kunne ikke bekræfte email. Prøv venligst igen.");
        }
      } catch (error: any) {
        console.error("Callback error:", error);
        setStatus("error");
        setMessage(error.message || "Bekræftelse fejlede. Prøv venligst igen.");
        
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
            <p className="text-muted-foreground text-sm">Sender dig til login...</p>
          </>
        )}
      </div>
    </div>
  );
}
