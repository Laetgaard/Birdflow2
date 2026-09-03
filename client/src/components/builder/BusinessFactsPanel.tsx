import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, ShieldCheck, X } from "lucide-react";
import type { BusinessContext, BusinessFact } from "@shared/businessContext";

type Props = {
  value: BusinessContext | undefined;
  onChange: (ctx: BusinessContext) => void;
};

const EMPTY: BusinessContext = {
  services: [],
  conversionGoals: [],
  facts: [],
  forbiddenClaims: [],
};

function newFactId(): string {
  return `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * "Forretningsfakta" — the customer-owned facts the AI is allowed to build
 * claims from. The AI cannot write this panel's data; the server refuses AI
 * copy with claims (priser, udtalelser, tal, uddannelser, resultater) that
 * these facts do not back.
 */
export default function BusinessFactsPanel({ value, onChange }: Props) {
  const [draft, setDraft] = useState<BusinessContext>(value ?? EMPTY);
  const [servicesText, setServicesText] = useState((value?.services ?? []).join(", "));
  const [goalsText, setGoalsText] = useState((value?.conversionGoals ?? []).join(", "));
  const [newFact, setNewFact] = useState("");
  const [newForbidden, setNewForbidden] = useState("");
  const lastSyncedRef = useRef(JSON.stringify(value ?? EMPTY));

  // Sync from parent only on genuine external changes (undo/redo, load)
  useEffect(() => {
    const next = value ?? EMPTY;
    const json = JSON.stringify(next);
    if (json !== lastSyncedRef.current) {
      lastSyncedRef.current = json;
      setDraft(next);
      setServicesText((next.services ?? []).join(", "));
      setGoalsText((next.conversionGoals ?? []).join(", "));
    }
  }, [value]);

  const commit = (next: BusinessContext) => {
    const stamped: BusinessContext = { ...next, updatedAt: new Date().toISOString() };
    setDraft(stamped);
    lastSyncedRef.current = JSON.stringify(stamped);
    onChange(stamped);
  };

  const updateDraft = (patch: Partial<BusinessContext>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const commitDraft = () => commit(draft);

  const commitList = (key: "services" | "conversionGoals", text: string) => {
    const list = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, key === "services" ? 50 : 20);
    commit({ ...draft, [key]: list });
  };

  const addFact = () => {
    const text = newFact.trim();
    if (!text) return;
    const fact: BusinessFact = { id: newFactId(), text };
    commit({ ...draft, facts: [...(draft.facts ?? []), fact] });
    setNewFact("");
  };

  const updateFact = (id: string, patch: Partial<BusinessFact>) => {
    commit({
      ...draft,
      facts: (draft.facts ?? []).map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  };

  const removeFact = (id: string) => {
    commit({ ...draft, facts: (draft.facts ?? []).filter((f) => f.id !== id) });
  };

  const addForbidden = () => {
    const text = newForbidden.trim();
    if (!text) return;
    commit({ ...draft, forbiddenClaims: [...(draft.forbiddenClaims ?? []), text] });
    setNewForbidden("");
  };

  const removeForbidden = (index: number) => {
    commit({
      ...draft,
      forbiddenClaims: (draft.forbiddenClaims ?? []).filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-5" data-testid="panel-business-facts">
      <div>
        <h3 className="font-semibold text-sm mb-1">Forretningsfakta</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Det eneste AI'en ved — og må påstå — om din virksomhed. Priser, udtalelser, tal og
          uddannelser, der ikke står her, bliver afvist i AI-tekster. AI'en kan ikke selv ændre
          disse oplysninger.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Virksomhedsnavn</Label>
          <Input
            value={draft.businessName ?? ""}
            onChange={(e) => updateDraft({ businessName: e.target.value })}
            onBlur={commitDraft}
            placeholder="Fx Klinik for Trivsel"
            data-testid="input-business-name"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Branche</Label>
          <Input
            value={draft.industry ?? ""}
            onChange={(e) => updateDraft({ industry: e.target.value })}
            onBlur={commitDraft}
            placeholder="Fx psykologpraksis"
            data-testid="input-business-industry"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Beskrivelse</Label>
          <Textarea
            value={draft.description ?? ""}
            onChange={(e) => updateDraft({ description: e.target.value })}
            onBlur={commitDraft}
            placeholder="Hvad laver virksomheden — med dine egne ord?"
            rows={3}
            data-testid="input-business-description"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Målgruppe</Label>
          <Input
            value={draft.audience ?? ""}
            onChange={(e) => updateDraft({ audience: e.target.value })}
            onBlur={commitDraft}
            placeholder="Hvem skal hjemmesiden tale til?"
            data-testid="input-business-audience"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Sted</Label>
          <Input
            value={draft.location ?? ""}
            onChange={(e) => updateDraft({ location: e.target.value })}
            onBlur={commitDraft}
            placeholder="Fx Århus C"
            data-testid="input-business-location"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Ydelser (adskilt med komma)</Label>
          <Input
            value={servicesText}
            onChange={(e) => setServicesText(e.target.value)}
            onBlur={() => commitList("services", servicesText)}
            placeholder="Fx individuel terapi, parterapi"
            data-testid="input-business-services"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Mål med hjemmesiden (adskilt med komma)</Label>
          <Input
            value={goalsText}
            onChange={(e) => setGoalsText(e.target.value)}
            onBlur={() => commitList("conversionGoals", goalsText)}
            placeholder="Fx flere bookinger, kontakthenvendelser"
            data-testid="input-business-goals"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <Label className="text-xs">Fakta AI'en må bruge</Label>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
            Fx "Autoriseret psykolog", "En session koster 950 kr." eller en rigtig kundeudtalelse.
            Beskyttede fakta skal bruges ordret og må ikke omformuleres.
          </p>
        </div>

        {(draft.facts ?? []).map((fact) => (
          <div key={fact.id} className="rounded-md border p-2 space-y-2" data-testid={`fact-row-${fact.id}`}>
            <Textarea
              value={fact.text}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  facts: (prev.facts ?? []).map((f) =>
                    f.id === fact.id ? { ...f, text: e.target.value } : f
                  ),
                }))
              }
              onBlur={commitDraft}
              rows={2}
              className="text-sm"
              data-testid={`input-fact-text-${fact.id}`}
            />
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <Switch
                  checked={fact.protected === true}
                  onCheckedChange={(checked) => updateFact(fact.id, { protected: checked })}
                  data-testid={`switch-fact-protected-${fact.id}`}
                />
                <ShieldCheck className="h-3.5 w-3.5" />
                Beskyttet (bruges ordret)
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => removeFact(fact.id)}
                data-testid={`button-remove-fact-${fact.id}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        <div className="flex gap-2">
          <Input
            value={newFact}
            onChange={(e) => setNewFact(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFact()}
            placeholder="Tilføj et faktum…"
            data-testid="input-new-fact"
          />
          <Button variant="outline" size="icon" onClick={addFact} data-testid="button-add-fact">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <Label className="text-xs">Må ikke påstås</Label>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
            Påstande der aldrig må stå på sitet — heller ikke hvis de er sande.
          </p>
        </div>

        {(draft.forbiddenClaims ?? []).map((claim, index) => (
          <div key={`${claim}-${index}`} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
            <span className="text-sm flex-1 min-w-0 break-words">{claim}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground"
              onClick={() => removeForbidden(index)}
              data-testid={`button-remove-forbidden-${index}`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        <div className="flex gap-2">
          <Input
            value={newForbidden}
            onChange={(e) => setNewForbidden(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addForbidden()}
            placeholder="Fx garanteret symptomfri…"
            data-testid="input-new-forbidden"
          />
          <Button variant="outline" size="icon" onClick={addForbidden} data-testid="button-add-forbidden">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
