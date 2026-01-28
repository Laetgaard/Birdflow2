import { useState } from "react";
import { useLocation, Link } from "wouter";
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
import { Sparkles, Loader2, Check, Zap, Building2, Crown } from "lucide-react";

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

const features = [
  "Professionelle hjemmeside-skabeloner",
  "AI-drevet website builder",
  "Eget domæne inkluderet",
  "Booking- og webshop funktioner",
  "Sikker betaling via Stripe",
];

export default function AuthPage() {
  const [, setLocation] = useLocation();
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
          description: "Velkommen til BirdFlow.",
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

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Panel: Form */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <Link href="/">
            <div className="flex items-center gap-2 font-bold text-xl mb-8 cursor-pointer">
              <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              BirdFlow
            </div>
          </Link>

          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="signin">Log ind</TabsTrigger>
              <TabsTrigger value="signup">Opret konto</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <Card className="border-none shadow-none">
                <CardHeader className="px-0">
                  <CardTitle className="text-2xl">Velkommen tilbage</CardTitle>
                  <CardDescription>Indtast din email for at logge ind</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <form onSubmit={signInForm.handleSubmit(onSignIn)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input 
                        id="signin-email" 
                        placeholder="din@email.dk" 
                        {...signInForm.register("email")}
                        data-testid="input-email-signin"
                      />
                      {signInForm.formState.errors.email && (
                        <p className="text-xs text-destructive">{signInForm.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signin-password">Adgangskode</Label>
                        <Link href="/reset-password" className="text-xs text-primary hover:underline">
                          Glemt adgangskode?
                        </Link>
                      </div>
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
                      Log ind
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="signup">
              <Card className="border-none shadow-none">
                <CardHeader className="px-0">
                  <CardTitle className="text-2xl">Opret din konto</CardTitle>
                  <CardDescription>Udfyld dine oplysninger for at komme i gang</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <form onSubmit={signUpForm.handleSubmit(onSignUp)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Fulde navn</Label>
                      <Input 
                        id="signup-name" 
                        placeholder="Dit navn" 
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
                        placeholder="din@email.dk" 
                        {...signUpForm.register("email")}
                        data-testid="input-email-signup"
                      />
                      {signUpForm.formState.errors.email && (
                        <p className="text-xs text-destructive">{signUpForm.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone">Telefonnummer</Label>
                      <Input 
                        id="signup-phone" 
                        placeholder="+45 12 34 56 78" 
                        {...signUpForm.register("phoneNumber")}
                        data-testid="input-phone-signup"
                      />
                      {signUpForm.formState.errors.phoneNumber && (
                        <p className="text-xs text-destructive">{signUpForm.formState.errors.phoneNumber.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Adgangskode</Label>
                      <Input 
                        id="signup-password" 
                        type="password"
                        placeholder="Mindst 8 tegn"
                        {...signUpForm.register("password")}
                        data-testid="input-password-signup"
                      />
                      {signUpForm.formState.errors.password && (
                        <p className="text-xs text-destructive">{signUpForm.formState.errors.password.message}</p>
                      )}
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700" 
                      disabled={isLoading} 
                      data-testid="button-signup"
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Opret konto
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      Ved at oprette en konto accepterer du vores{" "}
                      <Link href="/terms" className="text-primary hover:underline">vilkår</Link>
                      {" "}og{" "}
                      <Link href="/privacy" className="text-primary hover:underline">privatlivspolitik</Link>
                    </p>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right Panel: Visual */}
      <div className="hidden lg:flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white p-12 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        
        <div className="relative z-10 max-w-lg space-y-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Byg din professionelle hjemmeside på få minutter
            </h2>
            <p className="text-lg text-white/80">
              BirdFlow gør det nemt at oprette en flot hjemmeside med booking, webshop og meget mere.
            </p>
          </div>
          
          <ul className="space-y-4">
            {features.map((feature, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
                <span className="text-white/90">{feature}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4 pt-4">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <Zap className="w-5 h-5 text-yellow-300" />
              <span className="text-sm font-medium">Fra 69 kr/md</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <Crown className="w-5 h-5 text-yellow-300" />
              <span className="text-sm font-medium">14 dages gratis prøve</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
