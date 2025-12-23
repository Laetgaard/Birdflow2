import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Globe, Loader2 } from "lucide-react";

const signUpSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  phoneNumber: z.string().min(8, "Phone number is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const defaultTab = searchParams.get("mode") === "signup" ? "signup" : "signin";
  
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

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
      await signUp({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
      });
      toast({
        title: "Account created!",
        description: "Welcome to your new dashboard.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
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
        title: "Welcome back!",
        description: "Successfully signed in.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Invalid credentials.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Panel: Form */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center gap-2 font-bold text-xl mb-8">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              <Globe className="w-5 h-5" />
            </div>
            SaaSify
          </div>

          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <Card className="border-none shadow-none">
                <CardHeader className="px-0">
                  <CardTitle className="text-2xl">Welcome back</CardTitle>
                  <CardDescription>Enter your email to sign in to your account</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <form onSubmit={signInForm.handleSubmit(onSignIn)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input 
                        id="signin-email" 
                        placeholder="m@example.com" 
                        {...signInForm.register("email")}
                        data-testid="input-email-signin"
                      />
                      {signInForm.formState.errors.email && (
                        <p className="text-xs text-destructive">{signInForm.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <Input 
                        id="signin-password" 
                        type="password"
                        {...signInForm.register("password")}
                        data-testid="input-password-signin"
                      />
                      {signInForm.formState.errors.password && (
                        <p className="text-xs text-destructive">{signInForm.formState.errors.password.message}</p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-signin">
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="signup">
              <Card className="border-none shadow-none">
                <CardHeader className="px-0">
                  <CardTitle className="text-2xl">Create an account</CardTitle>
                  <CardDescription>Enter your details below to create your account</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <form onSubmit={signUpForm.handleSubmit(onSignUp)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name</Label>
                      <Input 
                        id="signup-name" 
                        placeholder="John Doe" 
                        {...signUpForm.register("fullName")}
                        data-testid="input-name-signup"
                      />
                      {signUpForm.formState.errors.fullName && (
                        <p className="text-xs text-destructive">{signUpForm.formState.errors.fullName.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input 
                        id="signup-email" 
                        placeholder="m@example.com" 
                        {...signUpForm.register("email")}
                        data-testid="input-email-signup"
                      />
                      {signUpForm.formState.errors.email && (
                        <p className="text-xs text-destructive">{signUpForm.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone">Phone Number</Label>
                      <Input 
                        id="signup-phone" 
                        placeholder="+1 (555) 000-0000" 
                        {...signUpForm.register("phoneNumber")}
                        data-testid="input-phone-signup"
                      />
                      {signUpForm.formState.errors.phoneNumber && (
                        <p className="text-xs text-destructive">{signUpForm.formState.errors.phoneNumber.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input 
                        id="signup-password" 
                        type="password"
                        {...signUpForm.register("password")}
                        data-testid="input-password-signup"
                      />
                      {signUpForm.formState.errors.password && (
                        <p className="text-xs text-destructive">{signUpForm.formState.errors.password.message}</p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-signup">
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Account
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right Panel: Visual */}
      <div className="hidden lg:flex flex-col items-center justify-center bg-zinc-900 text-zinc-50 p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80')] opacity-20 bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/50 to-transparent" />
        
        <div className="relative z-10 max-w-lg text-center space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">"This platform revolutionized how we build and deploy. Simply incredible."</h2>
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-zinc-800 border-2 border-zinc-700" />
            <div className="font-semibold">Sofia Davis</div>
            <div className="text-sm text-zinc-400">CEO at TechFlow</div>
          </div>
        </div>
      </div>
    </div>
  );
}
