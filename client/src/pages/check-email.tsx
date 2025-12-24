import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft } from "lucide-react";

export default function CheckEmail() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8 max-w-md">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-muted-foreground">
            We've sent you a confirmation link. Please check your email and click the link to verify your account.
          </p>
        </div>

        <div className="pt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Didn't receive the email? Check your spam folder or try signing up again.
          </p>
          
          <Link href="/auth?mode=signin">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
