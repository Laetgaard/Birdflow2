// Customers section of the manage dashboard. Identity rows are created
// by DB triggers whenever an order or booking comes in; the server
// aggregates paid-order spend and booking counts at read time, and the
// response carries the website's own currency so nothing here hardcodes
// a symbol.
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, CalendarCheck } from "lucide-react";
import type { SectionProps, Customer } from "./types";
import {
  authHeaders,
  formatCents,
  formatDateDa,
  LoadingState,
  EmptyState,
  ErrorState,
} from "./shared";

type CustomersResponse = {
  customers: Customer[];
  currency: string;
};

export function CustomersSection({ websiteId, accessToken }: SectionProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currency, setCurrency] = useState("DKK");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    if (!websiteId || !accessToken) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/customers`, {
        headers: authHeaders(accessToken),
      });
      if (!res.ok) throw new Error(`Kunne ikke hente kunder (${res.status})`);
      const data: CustomersResponse = await res.json();
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      setCurrency(data.currency || "DKK");
    } catch (error: any) {
      setLoadError(error.message || "Kunne ikke hente kunder");
    } finally {
      setIsLoading(false);
    }
  }, [websiteId, accessToken]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchCustomers} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kunder</CardTitle>
        <CardDescription>
          Alle der har bestilt eller booket på din hjemmeside
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState label="Indlæser kunder..." />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Users className="w-12 h-12" />}
            title="Ingen kunder endnu"
            description="Kundeprofiler oprettes automatisk, når nogen lægger en ordre eller booker en tid."
          />
        ) : (
          <div className="space-y-4">
            {customers.map(customer => (
              <div
                key={customer.id}
                className="flex items-center justify-between gap-4 p-4 border rounded-lg"
                data-testid={`row-customer-${customer.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar>
                    <AvatarFallback>{customer.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate" data-testid={`text-customer-name-${customer.id}`}>
                      {customer.name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{customer.email}</p>
                    {customer.lastActivityAt && (
                      <p className="text-xs text-muted-foreground/70">
                        Sidst aktiv {formatDateDa(customer.lastActivityAt)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-medium" data-testid={`text-customer-spent-${customer.id}`}>
                    {formatCents(customer.totalSpentCents, currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {customer.ordersCount === 1 ? "1 ordre" : `${customer.ordersCount} ordrer`}
                  </p>
                  {customer.bookingsCount > 0 && (
                    <Badge variant="secondary" className="mt-1 gap-1 text-xs font-normal">
                      <CalendarCheck className="w-3 h-3" />
                      {customer.bookingsCount === 1
                        ? "1 booking"
                        : `${customer.bookingsCount} bookinger`}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
