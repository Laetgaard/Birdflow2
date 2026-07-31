// Custom domain management card (Danish UI). Moved out of the old monolithic
// manage.tsx without behavior changes.
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Loader2, Settings, Clock, CheckCircle, XCircle, AlertCircle,
  Plus, Trash2, ExternalLink, Copy, RefreshCw, Link2,
} from "lucide-react";
import type { CustomDomain } from "./types";
import { authHeaders, jsonAuthHeaders } from "./shared";

export function DomainsCard({ websiteId, accessToken, isPublished }: { websiteId: string; accessToken: string; isPublished: boolean }) {
  const { toast } = useToast();
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const [autoPolling, setAutoPolling] = useState(false);

  const fetchDomains = useCallback(async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/domains`, {
        headers: authHeaders(accessToken),
      });
      if (res.ok) {
        const data = await res.json();
        setDomains(data);
        const hasPendingDomains = data.some((d: CustomDomain) => d.status === 'pending' || d.status === 'verifying');
        setAutoPolling(hasPendingDomains);
      }
    } catch (error) {
      console.error('Failed to fetch domains:', error);
    } finally {
      setIsLoading(false);
    }
  }, [websiteId, accessToken]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  // Refresh domain list when a domain is purchased in DomainPurchaseCard
  useEffect(() => {
    const handler = () => fetchDomains();
    window.addEventListener('domain-purchased', handler);
    return () => window.removeEventListener('domain-purchased', handler);
  }, [fetchDomains]);

  useEffect(() => {
    if (!autoPolling) return;
    const interval = setInterval(async () => {
      const pendingDomains = domains.filter(d => d.status === 'pending' || d.status === 'verifying');
      for (const domain of pendingDomains) {
        try {
          const res = await fetch(`/api/websites/${websiteId}/domains/${domain.id}/verify`, {
            method: 'POST',
            headers: authHeaders(accessToken),
          });
          const data = await res.json();
          if (data.verified) {
            setDomains(prev => prev.map(d =>
              d.id === domain.id ? { ...d, status: 'active' as const } : d
            ));
            setAutoPolling(false);
            toast({
              title: "Domæne forbundet!",
              description: `Dit domæne ${domain.domain} er nu live!`,
            });
          }
        } catch (error) {
          console.error('Auto-poll error:', error);
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [autoPolling, domains, websiteId, accessToken, toast]);

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;

    setIsAddingDomain(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/domains`, {
        method: 'POST',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({ domain: newDomain.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Kunne ikke tilføje domænet');
      }

      setDomains(prev => [...prev, data]);
      setNewDomain('');
      toast({
        title: "Domæne tilføjet",
        description: "Tilføj DNS-posten nedenfor for at forbinde dit domæne.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fejl",
        description: error.message,
      });
    } finally {
      setIsAddingDomain(false);
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    setVerifyingDomainId(domainId);
    try {
      const res = await fetch(`/api/websites/${websiteId}/domains/${domainId}/verify`, {
        method: 'POST',
        headers: authHeaders(accessToken),
      });

      const data = await res.json();

      if (data.verified) {
        setDomains(prev => prev.map(d =>
          d.id === domainId ? { ...d, status: data.status as CustomDomain['status'] } : d
        ));
        toast({
          title: "Domæne forbundet",
          description: data.message || "Dit domæne er nu live!",
        });
      } else {
        setDomains(prev => prev.map(d =>
          d.id === domainId ? { ...d, status: data.status as CustomDomain['status'] } : d
        ));
        toast({
          title: "Venter stadig",
          description: data.message || "DNS-ændringerne er stadig undervejs. Prøv igen om et par minutter.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fejl",
        description: error.message,
      });
    } finally {
      setVerifyingDomainId(null);
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/domains/${domainId}`, {
        method: 'DELETE',
        headers: authHeaders(accessToken),
      });

      if (res.ok) {
        setDomains(prev => prev.filter(d => d.id !== domainId));
        toast({
          title: "Domæne fjernet",
          description: "Domænet er fjernet fra din hjemmeside.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fejl",
        description: error.message,
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Kopieret!",
      description: "Værdien er kopieret til udklipsholderen.",
    });
  };

  const getStatusBadge = (status: CustomDomain['status']) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Forbundet
          </Badge>
        );
      case 'verifying':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Tjekker DNS
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            DNS-opsætning kræves
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Fejl
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStepNumber = (status: CustomDomain['status']) => {
    switch (status) {
      case 'pending': return 1;
      case 'verifying': return 2;
      case 'active': return 3;
      case 'error': return 0;
      default: return 0;
    }
  };

  const StepIndicator = ({ domain }: { domain: CustomDomain }) => {
    const currentStep = getStepNumber(domain.status);
    const steps = [
      { num: 1, label: 'Tilføj DNS-post' },
      { num: 2, label: 'Verificerer' },
      { num: 3, label: 'Forbundet' },
    ];

    return (
      <div className="flex items-center gap-2 py-3">
        {steps.map((step, idx) => (
          <div key={step.num} className="flex items-center">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
              currentStep >= step.num
                ? currentStep === step.num && step.num < 3
                  ? 'bg-blue-500 text-white'
                  : step.num === 3 && currentStep === 3
                    ? 'bg-green-500 text-white'
                    : 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}>
              {currentStep > step.num || (step.num === 3 && currentStep === 3) ? (
                <CheckCircle className="w-4 h-4" />
              ) : step.num === 2 && currentStep === 2 ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                step.num
              )}
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${currentStep > step.num ? 'bg-blue-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  if (!isPublished) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Egne domæner
          </CardTitle>
          <CardDescription>Forbind dit eget domæne til din hjemmeside</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h4 className="font-medium text-amber-900 mb-1">Udgiv din hjemmeside først</h4>
            <p className="text-sm text-amber-700">
              Før du kan tilføje et eget domæne, skal du udgive din hjemmeside. Når den er udgivet, kan du forbinde dit eget domæne.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          Egne domæner
          {autoPolling && (
            <span className="flex items-center text-xs font-normal text-blue-600 ml-2">
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
              Tjekker automatisk hvert 30. sekund
            </span>
          )}
        </CardTitle>
        <CardDescription>Forbind dit eget domæne til din hjemmeside</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex gap-2">
            <Input
              placeholder="dit-domæne.dk eller www.dit-domæne.dk"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              disabled={isAddingDomain}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
              data-testid="input-new-domain"
            />
            <Button
              onClick={handleAddDomain}
              disabled={isAddingDomain || !newDomain.trim()}
              data-testid="btn-add-domain"
            >
              {isAddingDomain ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Tilføj domæne
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : domains.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Ingen egne domæner endnu</p>
              <p className="text-sm mt-1">Tilføj et domæne ovenfor for at forbinde din egen webadresse.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {domains.map((domain) => (
                <div
                  key={domain.id}
                  className={`border rounded-lg p-4 space-y-3 ${
                    domain.status === 'active'
                      ? 'border-green-200 bg-green-50/30'
                      : domain.status === 'error'
                        ? 'border-red-200 bg-red-50/30'
                        : 'border-blue-200 bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        domain.status === 'active' ? 'bg-green-100' :
                        domain.status === 'error' ? 'bg-red-100' : 'bg-blue-100'
                      }`}>
                        <Globe className={`w-4 h-4 ${
                          domain.status === 'active' ? 'text-green-600' :
                          domain.status === 'error' ? 'text-red-600' : 'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <span className="font-medium text-lg">{domain.domain}</span>
                        <div className="mt-0.5">{getStatusBadge(domain.status)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {domain.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-white"
                          onClick={() => window.open(`https://${domain.domain}`, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Besøg side
                        </Button>
                      )}
                      {(domain.status === 'pending' || domain.status === 'verifying') && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleVerifyDomain(domain.id)}
                          disabled={verifyingDomainId === domain.id}
                          data-testid={`btn-verify-domain-${domain.id}`}
                        >
                          {verifyingDomainId === domain.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-1" />
                          )}
                          Tjek nu
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50 bg-white"
                        onClick={() => handleDeleteDomain(domain.id)}
                        data-testid={`btn-delete-domain-${domain.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {domain.status !== 'error' && <StepIndicator domain={domain} />}

                  {domain.status === 'active' && (
                    <div className="bg-green-100 border border-green-300 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-green-800">Dit domæne er live!</span>
                      </div>
                      <p className="text-sm text-green-700 mt-1">
                        Besøgende kan nu tilgå din side på <span className="font-medium">https://{domain.domain}</span>
                      </p>
                    </div>
                  )}

                  {(domain.status === 'pending' || domain.status === 'verifying') && domain.dnsType && (
                    <div className="bg-white border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="bg-blue-100 p-1.5 rounded-full">
                          <Settings className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-blue-900">Tilføj denne DNS-post hos din domæneudbyder</h4>
                          <p className="text-sm text-blue-700 mt-0.5">
                            Gå til din domæneudbyder (GoDaddy, Namecheap, Cloudflare, One.com osv.) og tilføj følgende post:
                          </p>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100 border-b">
                            <tr>
                              <th className="text-left px-4 py-2 font-medium text-slate-600">Type</th>
                              <th className="text-left px-4 py-2 font-medium text-slate-600">Navn</th>
                              <th className="text-left px-4 py-2 font-medium text-slate-600">Værdi</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="px-4 py-3">
                                <span className="font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                                  {domain.dnsType}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <code className="font-mono bg-slate-200 px-2 py-1 rounded text-xs">
                                    {domain.dnsName}
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 hover:bg-blue-100"
                                    onClick={() => copyToClipboard(domain.dnsName || '')}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <code className="font-mono bg-slate-200 px-2 py-1 rounded text-xs break-all">
                                    {domain.dnsValue}
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 hover:bg-blue-100 flex-shrink-0"
                                    onClick={() => copyToClipboard(domain.dnsValue || '')}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 flex items-start gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
                        <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium">DNS-opdateringer tager tid.</span> Det virker som regel inden for 5-10 minutter, men kan i sjældne tilfælde tage op til 48 timer.
                          Vi tjekker automatisk hvert 30. sekund.
                        </div>
                      </div>
                    </div>
                  )}

                  {domain.status === 'error' && domain.errorMessage && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-red-800">Forbindelsen mislykkedes</h4>
                          <p className="text-sm text-red-700 mt-1">{domain.errorMessage}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => handleVerifyDomain(domain.id)}
                            disabled={verifyingDomainId === domain.id}
                          >
                            {verifyingDomainId === domain.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            ) : (
                              <RefreshCw className="w-4 h-4 mr-1" />
                            )}
                            Prøv igen
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
