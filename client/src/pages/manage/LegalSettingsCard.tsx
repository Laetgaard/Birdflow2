// Legal/company information card (Danish UI). Moved out of the old monolithic
// manage.tsx without behavior changes.
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings } from "lucide-react";
import type { LegalSettings } from "./types";
import { authHeaders, jsonAuthHeaders } from "./shared";

export function LegalSettingsCard({ websiteId, accessToken }: { websiteId: string; accessToken: string }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<LegalSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    websiteName: '',
    companyName: '',
    contactEmail: '',
    businessAddress: '',
  });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`/api/websites/${websiteId}/legal-settings`, {
        headers: authHeaders(accessToken),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setFormData({
          websiteName: data.websiteName || '',
          companyName: data.companyName || '',
          contactEmail: data.contactEmail || '',
          businessAddress: data.businessAddress || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch legal settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [websiteId, accessToken]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/websites/${websiteId}/legal-settings`, {
        method: 'PATCH',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        toast({ title: 'Juridiske oplysninger gemt', description: 'Dine firmaoplysninger er opdateret.' });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast({ title: 'Kunne ikke gemme de juridiske oplysninger', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Juridiske oplysninger
        </CardTitle>
        <CardDescription>
          Disse oplysninger bruges på dine sider med handelsbetingelser og privatlivspolitik
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="legal-website-name">Hjemmesidens navn</Label>
            <Input
              id="legal-website-name"
              value={formData.websiteName}
              onChange={(e) => setFormData(prev => ({ ...prev, websiteName: e.target.value }))}
              placeholder="Min fantastiske hjemmeside"
              data-testid="input-legal-website-name"
            />
            <p className="text-xs text-muted-foreground">Vises på juridiske sider og i sidefoden</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal-company-name">Firmanavn</Label>
            <Input
              id="legal-company-name"
              value={formData.companyName}
              onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
              placeholder="Mit Firma ApS"
              data-testid="input-legal-company-name"
            />
            <p className="text-xs text-muted-foreground">Dit officielle virksomheds- eller selskabsnavn</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="legal-contact-email">Kontakt-e-mail</Label>
          <Input
            id="legal-contact-email"
            type="email"
            value={formData.contactEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
            placeholder="jura@ditfirma.dk"
            data-testid="input-legal-contact-email"
          />
          <p className="text-xs text-muted-foreground">E-mailadresse til juridiske henvendelser og persondataanmodninger</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="legal-business-address">Firmaadresse</Label>
          <Textarea
            id="legal-business-address"
            value={formData.businessAddress}
            onChange={(e) => setFormData(prev => ({ ...prev, businessAddress: e.target.value }))}
            placeholder="Hovedgaden 1&#10;2. sal&#10;1234 By&#10;Danmark"
            rows={3}
            data-testid="input-legal-business-address"
          />
          <p className="text-xs text-muted-foreground">Fysisk adresse til juridisk korrespondance</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Om de juridiske sider</h4>
          <p className="text-sm text-blue-800">
            Din hjemmeside indeholder automatisk genererede sider med handelsbetingelser og privatlivspolitik.
            Oplysningerne, du indtaster ovenfor, vises på disse sider. Sørg for at holde dem korrekte og
            opdaterede, så du overholder lovgivningen.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} data-testid="btn-save-legal-settings">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Gem juridiske oplysninger
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
