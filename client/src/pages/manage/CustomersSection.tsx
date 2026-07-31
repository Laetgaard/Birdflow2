// Customers section of the manage dashboard. Moved out of the old monolithic
// manage.tsx and translated to Danish.
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import type { SectionProps, Customer } from "./types";
import {
  authHeaders,
  LoadingState,
  EmptyState,
  ErrorState,
} from "./shared";

export function CustomersSection({ websiteId, accessToken }: SectionProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
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
      setCustomers(await res.json());
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
        <CardDescription>Se og håndtér din kundebase</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState label="Indlæser kunder..." />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Users className="w-12 h-12" />}
            title="Ingen kunder endnu"
            description="Kundeprofiler vises her, efterhånden som de bruger din hjemmeside."
          />
        ) : (
          <div className="space-y-4">
            {customers.map(customer => (
              <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-muted-foreground">{customer.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">${customer.totalSpent.toFixed(2)} brugt</p>
                  <p className="text-sm text-muted-foreground">{customer.totalOrders} ordrer</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
