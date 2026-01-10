import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Zap, Crown, Lock, AlertTriangle, Clock, CreditCard } from "lucide-react";
import { Link } from "wouter";

interface UpgradePromptProps {
  title?: string;
  description?: string;
  featureName?: string;
  onUpgrade?: () => void;
  variant?: "card" | "alert" | "inline";
}

export function UpgradePrompt({
  title = "Upgrade Required",
  description = "This feature requires an active subscription.",
  featureName,
  onUpgrade,
  variant = "card",
}: UpgradePromptProps) {
  const message = featureName
    ? `"${featureName}" requires an active subscription.`
    : description;

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      window.location.href = "/pricing";
    }
  };

  if (variant === "alert") {
    return (
      <Alert className="border-indigo-500/50 bg-indigo-500/10" data-testid="alert-upgrade-required">
        <Lock className="h-4 w-4 text-indigo-500" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="flex items-center gap-4">
          {message}
          <Button size="sm" onClick={handleUpgrade} data-testid="button-upgrade">
            <Zap className="h-4 w-4 mr-2" />
            Upgrade
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50" data-testid="inline-upgrade-prompt">
        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground flex-1">{message}</span>
        <Button size="sm" variant="outline" onClick={handleUpgrade} data-testid="button-upgrade">
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-indigo-500/20" data-testid="card-upgrade-prompt">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4">
          <Crown className="h-6 w-6 text-indigo-500" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="text-center text-sm text-muted-foreground">
        <p>Upgrade to unlock this feature and get access to all premium capabilities.</p>
      </CardContent>
      <CardFooter className="justify-center">
        <Button onClick={handleUpgrade} data-testid="button-upgrade">
          <Zap className="h-4 w-4 mr-2" />
          View Plans
        </Button>
      </CardFooter>
    </Card>
  );
}

interface TrialWarningProps {
  daysRemaining: number;
  onAddPayment?: () => void;
}

export function TrialWarning({ daysRemaining, onAddPayment }: TrialWarningProps) {
  const isUrgent = daysRemaining <= 7;
  const variant = isUrgent ? "destructive" : "default";
  const Icon = isUrgent ? AlertTriangle : Clock;

  return (
    <Alert 
      variant={isUrgent ? "destructive" : undefined} 
      className={!isUrgent ? "border-amber-500/50 bg-amber-500/10" : undefined}
      data-testid="alert-trial-warning"
    >
      <Icon className={`h-4 w-4 ${!isUrgent ? "text-amber-500" : ""}`} />
      <AlertTitle className={!isUrgent ? "text-amber-600" : ""}>
        {isUrgent ? "Trial Ending Soon!" : "Trial Period Active"}
      </AlertTitle>
      <AlertDescription className="flex items-center gap-4">
        {daysRemaining === 0 ? (
          "Your trial ends today. Add a payment method to continue."
        ) : daysRemaining === 1 ? (
          "Your trial ends tomorrow. Add a payment method to continue."
        ) : (
          `${daysRemaining} days remaining in your trial. Add a payment method to ensure uninterrupted access.`
        )}
        {onAddPayment && (
          <Button 
            size="sm" 
            variant={isUrgent ? "destructive" : "outline"}
            onClick={onAddPayment}
            data-testid="button-add-payment"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Add Payment
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

interface PaymentFailedAlertProps {
  onUpdatePayment?: () => void;
}

export function PaymentFailedAlert({ onUpdatePayment }: PaymentFailedAlertProps) {
  return (
    <Alert variant="destructive" data-testid="alert-payment-failed">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Payment Failed</AlertTitle>
      <AlertDescription className="flex items-center gap-4">
        Your last payment was unsuccessful. Please update your payment method to avoid service interruption.
        {onUpdatePayment && (
          <Button 
            size="sm" 
            variant="destructive"
            onClick={onUpdatePayment}
            data-testid="button-update-payment"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Update Payment
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

interface SubscriptionBadgeProps {
  plan: string;
  status: string | null;
}

export function SubscriptionBadge({ plan, status }: SubscriptionBadgeProps) {
  const planLabels: Record<string, string> = {
    free: "Free",
    starter: "Starter",
    business: "Business",
    enterprise: "Enterprise",
  };

  const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    active: "default",
    trialing: "secondary",
    past_due: "destructive",
    canceled: "outline",
  };

  return (
    <div className="flex items-center gap-2" data-testid="subscription-badge">
      <Badge variant="secondary">{planLabels[plan] || plan}</Badge>
      {status && status !== "active" && (
        <Badge variant={statusVariants[status] || "outline"}>
          {status === "trialing" ? "Trial" : status.replace("_", " ")}
        </Badge>
      )}
    </div>
  );
}
