import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Globe, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { getSupabase } from "@/lib/supabaseClient";

const requestResetSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setHasToken(true);
    }
  }, []);

  const requestForm = useForm({
    resolver: zodResolver(requestResetSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onRequestReset = async (data: z.infer<typeof requestResetSchema>) => {
    setIsLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setEmailSent(true);
      toast({
        title: "Email sent",
        description: "Check your inbox for the password reset link.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onResetPassword = async (data: z.infer<typeof resetPasswordSchema>) => {
    setIsLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) throw error;

      setResetComplete(true);
      toast({
        title: "Password updated",
        description: "Your password has been reset successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (resetComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6 p-8 max-w-md">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Password reset successful!</h1>
            <p className="text-muted-foreground">
              Your password has been updated. You can now sign in with your new password.
            </p>
          </div>
          <Link href="/auth?mode=signin">
            <Button className="gap-2" data-testid="button-back-signin">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (hasToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 font-bold text-xl mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
                <Globe className="w-5 h-5" />
              </div>
              BirdFlow
            </div>
            <CardTitle className="text-2xl">Set new password</CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={resetForm.handleSubmit(onResetPassword)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...resetForm.register("password")}
                  data-testid="input-new-password"
                />
                {resetForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{resetForm.formState.errors.password.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...resetForm.register("confirmPassword")}
                  data-testid="input-confirm-password"
                />
                {resetForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-destructive">{resetForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-reset-password">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6 p-8 max-w-md">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="text-muted-foreground">
              We've sent you a password reset link. Please check your inbox and click the link to reset your password.
            </p>
          </div>
          <Link href="/auth?mode=signin">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 font-bold text-xl mb-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              <Globe className="w-5 h-5" />
            </div>
            BirdFlow
          </div>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>Enter your email and we'll send you a reset link</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={requestForm.handleSubmit(onRequestReset)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                placeholder="m@example.com"
                {...requestForm.register("email")}
                data-testid="input-reset-email"
              />
              {requestForm.formState.errors.email && (
                <p className="text-xs text-destructive">{requestForm.formState.errors.email.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-send-reset">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Reset Link
            </Button>
            <Link href="/auth?mode=signin">
              <Button variant="ghost" className="w-full gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Button>
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
