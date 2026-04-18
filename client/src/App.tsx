import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import DIYPage from "@/pages/diy";
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
import ProfilePage from "@/pages/profile";
import OnboardingPage from "@/pages/onboarding";
import AdminPage from "@/pages/admin";
import PricingPage from "@/pages/pricing";
import BillingPage from "@/pages/billing";
import VerifyEmailPage from "@/pages/verify-email";
import ResetPasswordPage from "@/pages/reset-password";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={LandingPage} />
      <Route path="/diy" component={DIYPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/check-email" component={CheckEmail} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      
      {/* Protected routes - require auth + verified email + onboarding */}
      <Route path="/dashboard">
        {() => <ProtectedRoute><Dashboard /></ProtectedRoute>}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute><ProfilePage /></ProtectedRoute>}
      </Route>
      <Route path="/setup/:id">
        {() => <ProtectedRoute><SetupPage /></ProtectedRoute>}
      </Route>
      <Route path="/builder/:id">
        {() => <ProtectedRoute><BuilderPage /></ProtectedRoute>}
      </Route>
      <Route path="/manage/:id">
        {() => <ProtectedRoute><ManagePage /></ProtectedRoute>}
      </Route>
      <Route path="/billing">
        {() => <ProtectedRoute><BillingPage /></ProtectedRoute>}
      </Route>
      
      {/* Admin route - requires admin role */}
      <Route path="/admin">
        {() => <ProtectedRoute requireAdmin><AdminPage /></ProtectedRoute>}
      </Route>
      
      {/* Onboarding - requires auth + verified email but NOT onboarding */}
      <Route path="/onboarding">
        {() => <ProtectedRoute requireOnboarding={false}><OnboardingPage /></ProtectedRoute>}
      </Route>
      
      {/* Public product/checkout routes */}
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
