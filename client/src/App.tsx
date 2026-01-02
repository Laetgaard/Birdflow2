import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth";
import AuthCallback from "@/pages/auth-callback";
import CheckEmail from "@/pages/check-email";
import Dashboard from "@/pages/dashboard";
import SetupPage from "@/pages/setup";
import BuilderPage from "@/pages/builder";
import ManagePage from "@/pages/manage";
import ProductDetailPage from "@/pages/product";
import CheckoutSuccessPage from "@/pages/checkout-success";
import CheckoutCancelPage from "@/pages/checkout-cancel";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/check-email" component={CheckEmail} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/setup/:id" component={SetupPage} />
      <Route path="/builder/:id" component={BuilderPage} />
      <Route path="/manage/:id" component={ManagePage} />
      <Route path="/product/:id" component={ProductDetailPage} />
      <Route path="/checkout/success" component={CheckoutSuccessPage} />
      <Route path="/checkout/cancel" component={CheckoutCancelPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
