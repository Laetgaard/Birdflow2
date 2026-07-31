// Shared UI helpers for the manage dashboard sections: Danish status badges,
// currency/date formatting, auth headers and consistent empty/loading states.
import { activeAdminSessionHeaders } from "@/lib/adminSession";
import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2, Upload, CheckCircle, Clock, AlertCircle, XCircle,
} from "lucide-react";
import { useUpload } from "@/hooks/use-upload";

export function formatCurrency(amount: number, currency: string = 'DKK'): string {
  // Intl handles every ISO code (symbol, placement, decimals); DKK keeps
  // the "123 kr." style owners expect. Fall back for junk codes.
  try {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'DKK' && Number.isInteger(amount) ? 0 : undefined,
      maximumFractionDigits: currency === 'DKK' && Number.isInteger(amount) ? 0 : undefined,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Ører/cents -> displayed amount. */
export function formatCents(amountCents: number, currency: string = 'DKK'): string {
  return formatCurrency(amountCents / 100, currency);
}

export function formatDateDa(iso: string | Date, withTime = false): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(date.getTime())) return String(iso);
  const opts: Intl.DateTimeFormatOptions = withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat('da-DK', opts).format(date);
}

export function authHeaders(accessToken: string): Record<string, string> {
  // activeAdminSessionHeaders() is {} for owners; for administrators it tags
  // requests with the editing-session id so audit entries can be grouped.
  return { Authorization: `Bearer ${accessToken}`, ...activeAdminSessionHeaders() };
}

export function jsonAuthHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...activeAdminSessionHeaders(),
  };
}

const STATUS_LABELS_DA: Record<string, string> = {
  completed: 'Gennemført',
  confirmed: 'Bekræftet',
  pending: 'Afventer',
  processing: 'Behandles',
  cancelled: 'Annulleret',
  paid: 'Betalt',
  unpaid: 'Ubetalt',
  refunded: 'Refunderet',
  active: 'Aktiv',
  draft: 'Kladde',
  archived: 'Arkiveret',
  published: 'Udgivet',
};

export function statusLabelDa(status: string): string {
  return STATUS_LABELS_DA[status] || status;
}

/** Danish status badge used across orders, bookings and products. */
export function StatusBadge({ status }: { status: string }) {
  const label = statusLabelDa(status);
  switch (status) {
    case 'completed':
    case 'confirmed':
    case 'paid':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" />{label}</Badge>;
    case 'pending':
    case 'unpaid':
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><Clock className="w-3 h-3 mr-1" />{label}</Badge>;
    case 'processing':
      return <Badge className="bg-primary/10 text-primary hover:bg-primary/10"><AlertCircle className="w-3 h-3 mr-1" />{label}</Badge>;
    case 'cancelled':
    case 'refunded':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><XCircle className="w-3 h-3 mr-1" />{label}</Badge>;
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}

export function ImageUploadButton({ onUpload, "data-testid": testId }: { onUpload: (url: string) => void; "data-testid"?: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      const fullUrl = window.location.origin + response.objectPath;
      onUpload(fullUrl);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        data-testid={testId ? `${testId}-input` : undefined}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        data-testid={testId}
      >
        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
      </Button>
    </>
  );
}

/** Consistent loading state for a section body. */
export function LoadingState({ label = "Indlæser..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground" data-testid="loading-state">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Consistent empty state for lists/tables. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-state">
      {icon && <div className="mb-3 text-muted-foreground/60">{icon}</div>}
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Card wrapper for a failed section load, with retry. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card>
      <CardContent className="py-10">
        <div className="flex flex-col items-center text-center gap-2">
          <AlertCircle className="w-6 h-6 text-destructive" />
          <p className="text-sm text-muted-foreground">{message}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} data-testid="button-retry">
              Prøv igen
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
