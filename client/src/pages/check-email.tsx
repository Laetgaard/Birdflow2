import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft, RefreshCw, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getSupabase } from "@/lib/supabaseClient";

export default function CheckEmail() {
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const email = new URLSearchParams(window.location.search).get('email') || '';

  const handleResendEmail = async () => {
    if (resendCooldown > 0 || !email) return;
    
    setIsResending(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8 max-w-md">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold" data-testid="text-check-email-title">Check your email</h1>
          <p className="text-muted-foreground">
            We've sent a confirmation link to{" "}
            {email && <span className="font-medium text-foreground">{email}</span>}
            {!email && "your email address"}. 
            Please check your inbox and click the link to verify your account.
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
          <p>
            Can't find the email? Check your spam folder, or click below to resend.
          </p>
        </div>

        <div className="pt-4 space-y-3">
          {email && (
            <Button 
              onClick={handleResendEmail} 
              disabled={isResending || resendCooldown > 0}
              className="gap-2 w-full"
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
          )}
          
          <Link href="/auth?mode=signin">
            <Button variant="outline" className="gap-2 w-full">
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
