import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Upload, X, Wand2 } from "lucide-react";
import { fontFamilyPresets } from "@shared/componentRegistry";
import type {
  BrandGuide,
  BrandGuideColors,
  BrandGuideImageryStyle,
  BrandGuideTypographyScale,
} from "@shared/customComponents";
import { uploadImage } from "@/lib/builderUpload";

type Props = {
  brandGuide: BrandGuide;
  onChange: (guide: BrandGuide) => void;
  onApplyToSite: (guide: BrandGuide) => void;
  websiteId: string;
  accessToken: string;
};

const COLOR_FIELDS: { key: keyof BrandGuideColors; label: string }[] = [
  { key: "primary", label: "Primær" },
  { key: "secondary", label: "Sekundær" },
  { key: "accent", label: "Accent" },
  { key: "background", label: "Baggrund" },
  { key: "surface", label: "Flade" },
  { key: "text", label: "Tekst" },
];

const SCALE_OPTIONS: { value: BrandGuideTypographyScale; label: string }[] = [
  { value: "modern", label: "Moderne" },
  { value: "editorial", label: "Redaktionel" },
  { value: "classic", label: "Klassisk" },
  { value: "bold", label: "Markant" },
];

const IMAGERY_OPTIONS: { value: BrandGuideImageryStyle; label: string }[] = [
  { value: "photo", label: "Fotografi" },
  { value: "illustration", label: "Illustration" },
  { value: "3d", label: "3D" },
  { value: "minimal", label: "Minimalistisk" },
  { value: "bold", label: "Markant" },
];

const SPACING_OPTIONS = [
  { value: "tight", label: "Kompakt" },
  { value: "normal", label: "Normal" },
  { value: "airy", label: "Luftig" },
] as const;

const RADIUS_OPTIONS = [
  { value: "none", label: "Skarpe hjørner" },
  { value: "soft", label: "Bløde hjørner" },
  { value: "rounded", label: "Runde hjørner" },
] as const;

const SHADOW_OPTIONS = [
  { value: "none", label: "Ingen" },
  { value: "subtle", label: "Diskret" },
  { value: "elevated", label: "Løftet" },
] as const;

const MOTION_OPTIONS = [
  { value: "none", label: "Ingen" },
  { value: "subtle", label: "Diskret" },
  { value: "expressive", label: "Udtryksfuld" },
] as const;

export default function BrandGuidePanel({ brandGuide, onChange, onApplyToSite, websiteId, accessToken }: Props) {
  const [draft, setDraft] = useState<BrandGuide>(brandGuide);
  const [keywordsText, setKeywordsText] = useState((brandGuide.keywords ?? []).join(", "));
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const lastSyncedRef = useRef(JSON.stringify(brandGuide));

  // Sync from parent only on genuine external changes (undo/redo, load)
  useEffect(() => {
    const json = JSON.stringify(brandGuide);
    if (json !== lastSyncedRef.current) {
      lastSyncedRef.current = json;
      setDraft(brandGuide);
      setKeywordsText((brandGuide.keywords ?? []).join(", "));
    }
  }, [brandGuide]);

  const commit = (next: BrandGuide) => {
    const stamped: BrandGuide = { ...next, updatedAt: new Date().toISOString() };
    setDraft(stamped);
    lastSyncedRef.current = JSON.stringify(stamped);
    onChange(stamped);
  };

  const updateDraft = (patch: Partial<BrandGuide>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const commitDraft = () => commit(draft);

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const { url, mediaId } = await uploadImage(websiteId, accessToken, file);
      commit({ ...draft, logoUrl: url, logoMediaId: mediaId });
    } catch {
      // Upload errors are non-fatal; keep the previous logo
    } finally {
      setUploadingLogo(false);
    }
  };

  const commitKeywords = () => {
    const keywords = keywordsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 12);
    commit({ ...draft, keywords });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-sm mb-1">Brand guide</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Definér virksomhedens visuelle identitet. AI'en og nye sektioner bruger den som udgangspunkt.
        </p>
      </div>

      {/* Palette preview */}
      <div className="flex rounded-lg overflow-hidden border h-8">
        {COLOR_FIELDS.map(({ key }) => (
          <div key={key} className="flex-1" style={{ backgroundColor: draft.colors[key] }} title={key} />
        ))}
      </div>

      {/* Colors */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Farver</h4>
        <div className="grid grid-cols-2 gap-2">
          {COLOR_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <div className="flex gap-1">
                <Input
                  type="color"
                  value={draft.colors[key]}
                  onChange={(e) => updateDraft({ colors: { ...draft.colors, [key]: e.target.value } })}
                  onBlur={commitDraft}
                  className="w-9 h-8 p-1 cursor-pointer shrink-0"
                  data-testid={`brand-color-${key}`}
                />
                <Input
                  value={draft.colors[key]}
                  onChange={(e) => updateDraft({ colors: { ...draft.colors, [key]: e.target.value } })}
                  onBlur={commitDraft}
                  className="flex-1 h-8 text-xs min-w-0"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Typography */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Typografi</h4>
        <div className="space-y-1">
          <Label className="text-xs">Overskrifter</Label>
          <Select
            value={draft.typography.headingFont}
            onValueChange={(v) => commit({ ...draft, typography: { ...draft.typography, headingFont: v } })}
          >
            <SelectTrigger className="h-8 text-xs" data-testid="brand-heading-font">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {fontFamilyPresets.map((font) => (
                <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                  {font.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Brødtekst</Label>
          <Select
            value={draft.typography.bodyFont}
            onValueChange={(v) => commit({ ...draft, typography: { ...draft.typography, bodyFont: v } })}
          >
            <SelectTrigger className="h-8 text-xs" data-testid="brand-body-font">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {fontFamilyPresets.map((font) => (
                <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                  {font.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Udtryk</Label>
          <Select
            value={draft.typography.scale}
            onValueChange={(v) => commit({ ...draft, typography: { ...draft.typography, scale: v as BrandGuideTypographyScale } })}
          >
            <SelectTrigger className="h-8 text-xs" data-testid="brand-scale">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCALE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Logo */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Logo</h4>
        {draft.logoUrl ? (
          <div className="flex items-center gap-2">
            <div className="h-14 flex-1 border rounded-md bg-muted/30 flex items-center justify-center p-2">
              <img src={draft.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive shrink-0"
              onClick={() => commit({ ...draft, logoUrl: undefined, logoMediaId: undefined })}
              title="Fjern logo"
              data-testid="brand-remove-logo"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : null}
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleLogoUpload(file);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          disabled={uploadingLogo}
          onClick={() => logoInputRef.current?.click()}
          data-testid="brand-upload-logo"
        >
          {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploadingLogo ? "Uploader..." : draft.logoUrl ? "Skift logo" : "Upload logo"}
        </Button>
      </div>

      <Separator />

      {/* Imagery */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Billedstil</h4>
        <Select
          value={draft.imageryStyle ?? "photo"}
          onValueChange={(v) => commit({ ...draft, imageryStyle: v as BrandGuideImageryStyle })}
        >
          <SelectTrigger className="h-8 text-xs" data-testid="brand-imagery-style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {IMAGERY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <textarea
          className="w-full min-h-[60px] p-2 text-xs border rounded-md resize-none bg-background"
          value={draft.imageryNotes ?? ""}
          onChange={(e) => updateDraft({ imageryNotes: e.target.value })}
          onBlur={commitDraft}
          placeholder="Fx: Varme toner, naturligt lys, ingen stockfotos med jakkesæt..."
          data-testid="brand-imagery-notes"
        />
      </div>

      <Separator />

      {/* Tone of voice */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tone of voice</h4>
        <textarea
          className="w-full min-h-[70px] p-2 text-xs border rounded-md resize-none bg-background"
          value={draft.toneOfVoice ?? ""}
          onChange={(e) => updateDraft({ toneOfVoice: e.target.value })}
          onBlur={commitDraft}
          placeholder="Fx: Varm og imødekommende. Vi skriver 'du', aldrig 'De'. Korte sætninger."
          data-testid="brand-tone"
        />
        <div className="space-y-1">
          <Label className="text-xs">Nøgleord (adskil med komma)</Label>
          <Input
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            onBlur={commitKeywords}
            placeholder="troværdig, lokal, professionel"
            className="h-8 text-xs"
            data-testid="brand-keywords"
          />
        </div>
      </div>

      <Separator />

      {/* Expression */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Udtryk</h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Luft</Label>
            <Select value={draft.spacing} onValueChange={(v) => commit({ ...draft, spacing: v as BrandGuide["spacing"] })}>
              <SelectTrigger className="h-8 text-xs" data-testid="brand-spacing">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPACING_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hjørner</Label>
            <Select value={draft.radius} onValueChange={(v) => commit({ ...draft, radius: v as BrandGuide["radius"] })}>
              <SelectTrigger className="h-8 text-xs" data-testid="brand-radius">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RADIUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Skygger</Label>
            <Select value={draft.shadow} onValueChange={(v) => commit({ ...draft, shadow: v as BrandGuide["shadow"] })}>
              <SelectTrigger className="h-8 text-xs" data-testid="brand-shadow">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHADOW_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bevægelse</Label>
            <Select value={draft.motion} onValueChange={(v) => commit({ ...draft, motion: v as BrandGuide["motion"] })}>
              <SelectTrigger className="h-8 text-xs" data-testid="brand-motion">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      <Button className="w-full gap-2" onClick={() => onApplyToSite(draft)} data-testid="brand-apply">
        <Wand2 className="w-4 h-4" />
        Anvend på hjemmesiden
      </Button>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Opdaterer globale farver, skrifttyper og hjørner ud fra brand guiden.
      </p>
    </div>
  );
}
