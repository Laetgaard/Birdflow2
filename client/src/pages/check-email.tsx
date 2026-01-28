import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, ArrowLeft, RefreshCw, Send, Sparkles, CheckCircle2 } from "lucide-react";
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
        title: "Email sendt!",
        description: "Tjek din indbakke for bekræftelseslinket.",
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
        title: "Fejl",
        description: error.message || "Kunne ikke sende bekræftelsesemail.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20 p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-200/30 dark:bg-indigo-900/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200/30 dark:bg-purple-900/20 rounded-full blur-3xl" />
      </div>

      <Card className="relative z-10 max-w-md w-full p-8 text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 font-bold text-xl mb-8">
          <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          BirdFlow
        </div>

        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-lg">
          <Mail className="w-10 h-10 text-white" />
        </div>
        
        {/* Content */}
        <div className="space-y-3 mb-8">
          <h1 className="text-2xl font-bold" data-testid="text-check-email-title">
            Tjek din email
          </h1>
          <p className="text-muted-foreground">
            Vi har sendt et bekræftelseslink til{" "}
            {email ? (
              <span className="font-medium text-foreground">{email}</span>
            ) : (
              "din email adresse"
            )}
          </p>
        </div>

        {/* Steps */}
        <div className="bg-muted/50 rounded-xl p-4 mb-8 text-left">
          <h3 className="font-medium text-sm mb-3">Næste skridt:</h3>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <span>Åbn din email indbakke</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <span>Klik på bekræftelseslinket i emailen</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <span>Vælg dit abonnement og opret din hjemmeside</span>
            </li>
          </ul>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Kan du ikke finde emailen? Tjek din spam-mappe, eller klik nedenfor for at sende igen.
        </p>

        {/* Actions */}
        <div className="space-y-3">
          {email && (
            <Button 
              onClick={handleResendEmail} 
              disabled={isResending || resendCooldown > 0}
              className="gap-2 w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              data-testid="button-resend-email"
            >
              {isResending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {resendCooldown > 0 
                ? `Send igen om ${resendCooldown}s` 
                : "Send bekræftelsesemail igen"}
            </Button>
          )}
          
          <Link href="/auth?mode=signin">
            <Button variant="outline" className="gap-2 w-full" data-testid="button-back-to-login">
              <ArrowLeft className="w-4 h-4" />
              Tilbage til login
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
