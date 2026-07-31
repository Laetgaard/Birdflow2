// Form submissions section of the manage dashboard. Moved out of the old
// monolithic manage.tsx and translated to Danish.
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";
import type { SectionProps, FormSubmission } from "./types";
import {
  formatDateDa,
  authHeaders,
  LoadingState,
  EmptyState,
  ErrorState,
} from "./shared";

export function SubmissionsSection({ websiteId, accessToken }: SectionProps) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    if (!websiteId || !accessToken) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/submissions`, {
        headers: authHeaders(accessToken),
      });
      if (!res.ok) throw new Error(`Kunne ikke hente formular-indsendelser (${res.status})`);
      setSubmissions(await res.json());
    } catch (error: any) {
      setLoadError(error.message || "Kunne ikke hente formular-indsendelser");
    } finally {
      setIsLoading(false);
    }
  }, [websiteId, accessToken]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchSubmissions} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formular-indsendelser</CardTitle>
        <CardDescription>Se beskeder fra kontaktformularer og andre indsendelser</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState label="Indlæser formular-indsendelser..." />
        ) : submissions.length === 0 ? (
          <EmptyState
            icon={<Mail className="w-12 h-12" />}
            title="Ingen formular-indsendelser endnu"
            description="Indsendelser vises her, når besøgende udfylder formularer på din hjemmeside."
          />
        ) : (
          <div className="space-y-4">
            {submissions.map(submission => {
              const data = (submission.data ?? {}) as Record<string, any>;
              const formattedDate = formatDateDa(submission.createdAt, true);
              const dataEntries = Object.entries(data);

              return (
                <div
                  key={submission.id}
                  data-testid={`card-submission-${submission.id}`}
                  className={`p-5 border rounded-lg transition-colors ${
                    !submission.read ? 'bg-accent/60 border-primary/30' : 'bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {!submission.read && (
                        <span
                          className="w-2 h-2 rounded-full bg-primary"
                          title="Ulæst"
                          data-testid={`badge-unread-${submission.id}`}
                        />
                      )}
                      <div>
                        <p
                          className="font-semibold text-base capitalize"
                          data-testid={`text-form-name-${submission.id}`}
                        >
                          {submission.formName?.replace(/_/g, ' ') || 'Kontaktformular'}
                        </p>
                        <p
                          className="text-sm text-muted-foreground"
                          data-testid={`text-form-date-${submission.id}`}
                        >
                          {formattedDate}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {dataEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Ingen data indsendt</p>
                    ) : (
                      dataEntries.map(([key, value]) => (
                        <div
                          key={key}
                          className="grid grid-cols-[120px_1fr] gap-2"
                          data-testid={`row-field-${submission.id}-${key}`}
                        >
                          <span className="text-sm font-medium text-muted-foreground capitalize">
                            {key.replace(/_/g, ' ')}:
                          </span>
                          <span className="text-sm text-foreground whitespace-pre-wrap break-words">
                            {typeof value === 'object' && value !== null
                              ? JSON.stringify(value, null, 2)
                              : String(value ?? '-')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
