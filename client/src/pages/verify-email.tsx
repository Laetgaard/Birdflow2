import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft, RefreshCw, Send, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { getSupabase } from "@/lib/supabaseClient";

export default function VerifyEmail() {
  const { user, refreshSession, isEmailVerified } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    
    setIsResending(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user?.email || '',
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Email sent!",
        description: "Please check your inbox for the verification link.",
      });

      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resend verification email.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      await refreshSession();
      
      const supabase = getSupabase();
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      
      if (freshUser?.email_confirmed_at) {
        toast({
          title: "Email verified!",
          description: "Redirecting to your dashboard...",
        });
        setTimeout(() => setLocation("/dashboard"), 1000);
      } else {
        toast({
          title: "Not yet verified",
          description: "Please check your email and click the verification link.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to check verification status.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isEmailVerified) {
      setLocation("/dashboard");
    }
  }, [isEmailVerified, setLocation]);

  if (isEmailVerified) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8 max-w-md">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
          <Mail className="w-8 h-8 text-amber-500" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold" data-testid="text-verify-title">Verify your email</h1>
          <p className="text-muted-foreground">
            We've sent a verification link to{" "}
            <span className="font-medium text-foreground">{user?.email || "your email"}</span>.
            Please click the link to verify your account.
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
          <p>
            Can't find the email? Check your spam folder, or click below to resend.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <Button 
            onClick={handleResendEmail} 
            disabled={isResending || resendCooldown > 0}
            className="gap-2"
            data-testid="button-resend-email"
          >
            {isResending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {resendCooldown > 0 
              ? `Resend in ${resendCooldown}s` 
              : "Resend verification email"}
          </Button>

          <Button 
            variant="outline" 
            onClick={handleRefreshStatus}
            disabled={isRefreshing}
            className="gap-2"
            data-testid="button-refresh-status"
          >
            {isRefreshing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            I've verified - check status
          </Button>

          <Link href="/auth?mode=signin">
            <Button variant="ghost" className="gap-2 w-full">
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
