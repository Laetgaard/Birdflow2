import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import type { WebsiteAdminContext } from "@shared/schema";

type Props = {
  adminContext: WebsiteAdminContext;
};

/**
 * Persistent, non-dismissible banner shown whenever an administrator is
 * editing a client's website. Purely presentational: the server decides
 * admin access on every request - this only makes the state obvious.
 */
export default function AdminEditingBanner({ adminContext }: Props) {
  const [, setLocation] = useLocation();

  return (
    <div
      className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-amber-950 shrink-0"
      role="alert"
      data-testid="admin-editing-banner"
    >
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <p className="text-sm font-medium truncate">
          Du redigerer {adminContext.ownerDisplayName}s hjemmeside som
          administrator. Dine ændringer logges.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 border-amber-700 bg-amber-100 text-amber-950 hover:bg-amber-200"
        onClick={() => setLocation("/admin")}
        data-testid="button-back-to-admin"
      >
        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
        Til admin
      </Button>
    </div>
  );
}
