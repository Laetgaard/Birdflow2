import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, X, Wand2, Image, Palette, Zap } from "lucide-react";
import { fontFamilyPresets } from "@shared/componentRegistry";
import type {
  BrandGuide,
  BrandGuideColors,
  BrandGuideImageryStyle,
  BrandGuideTypographyScale,
} from "@shared/customComponents";
import { getContrastRatio, brandGuideCompleteness } from "@shared/customComponents";
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

const MOTION_PRESET_OPTIONS: { value: NonNullable<BrandGuide["motionPreset"]>; label: string; description: string }[] = [
  { value: "subtle", label: "Diskret", description: "Blide fades og løft — næsten usynlige" },
  { value: "standard", label: "Standard", description: "Balancerede slide-ins og fades" },
  { value: "bold", label: "Markant", description: "Tydelige entranser og stærke bevægelser" },
  { value: "playful", label: "Legende", description: "Spring, elastik og forskudte animationer" },
];

const MAX_BRAND_PHOTOS = 10;

export default function BrandGuidePanel({ brandGuide, onChange, onApplyToSite, websiteId, accessToken }: Props) {
  const [draft, setDraft] = useState<BrandGuide>(brandGuide);
  const [keywordsText, setKeywordsText] = useState((brandGuide.keywords ?? []).join(", "));
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPhotoIdx, setUploadingPhotoIdx] = useState<number | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
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

  // ── Logo ──────────────────────────────────────────────────────────────────

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

  // ── Brand photos ──────────────────────────────────────────────────────────

  const handlePhotoUpload = async (file: File) => {
    const photos = draft.brandPhotos ?? [];
    if (photos.length >= MAX_BRAND_PHOTOS) return;
    const idx = photos.length;
    setUploadingPhotoIdx(idx);
    try {
      const { url, mediaId } = await uploadImage(websiteId, accessToken, file);
      commit({ ...draft, brandPhotos: [...photos, { url, mediaId }] });
    } catch {
      // non-fatal
    } finally {
      setUploadingPhotoIdx(null);
    }
  };

  const removePhoto = (idx: number) => {
    const photos = (draft.brandPhotos ?? []).filter((_, i) => i !== idx);
    commit({ ...draft, brandPhotos: photos });
  };

  const updatePhotoCaption = (idx: number, caption: string) => {
    const photos = (draft.brandPhotos ?? []).map((p, i) => (i === idx ? { ...p, caption } : p));
    commit({ ...draft, brandPhotos: photos });
  };

  // ── Keywords ──────────────────────────────────────────────────────────────

  const commitKeywords = () => {
    const keywords = keywordsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 12);
    commit({ ...draft, keywords });
  };

  // ── Completeness ──────────────────────────────────────────────────────────

  const { count, total } = brandGuideCompleteness(draft);
  const completePct = Math.round((count / total) * 100);

  return (
    <div className="space-y-4">
      {/* Header + completeness badge */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm mb-0.5">Brand guide</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Definér visuel identitet. AI'en bruger den som udgangspunkt for plan og bygning.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
              {count}/{total}
            </span>
            <div className="h-1.5 w-16 rounded-full bg-muted mt-1 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${completePct}%`,
                  backgroundColor: completePct === 100 ? "#22c55e" : completePct >= 50 ? "#f59e0b" : "#e5e7eb",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Palette preview strip */}
      <div className="flex rounded-lg overflow-hidden border h-7">
        {COLOR_FIELDS.map(({ key }) => (
          <div key={key} className="flex-1" style={{ backgroundColor: draft.colors[key] }} title={key} />
        ))}
      </div>

      <Tabs defaultValue="identitet" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-8">
          <TabsTrigger value="identitet" className="text-xs gap-1">
            <Palette className="w-3 h-3" />
            Identitet
          </TabsTrigger>
          <TabsTrigger value="assetter" className="text-xs gap-1">
            <Image className="w-3 h-3" />
            Assetter
          </TabsTrigger>
          <TabsTrigger value="bevægelse" className="text-xs gap-1">
            <Zap className="w-3 h-3" />
            Bevægelse
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: Identitet ─────────────────────────────────────────────── */}
        <TabsContent value="identitet" className="space-y-5 mt-4">

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
            <ContrastChecks colors={draft.colors} />
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

          {/* Shape & spacing */}
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
            </div>
          </div>

          <Separator />
          <ApplyButton draft={draft} onApplyToSite={onApplyToSite} />
        </TabsContent>

        {/* ── TAB: Assetter ──────────────────────────────────────────────── */}
        <TabsContent value="assetter" className="space-y-5 mt-4">

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
              accept="image/*,.svg"
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
              {uploadingLogo ? "Uploader..." : draft.logoUrl ? "Skift logo" : "Upload logo (SVG, PNG)"}
            </Button>
          </div>

          <Separator />

          {/* Brand photos */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Brandfotos</h4>
              <span className="text-[11px] text-muted-foreground">
                {(draft.brandPhotos ?? []).length}/{MAX_BRAND_PHOTOS}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Disse fotos bruges i stedet for AI-genererede billeder, når hjemmesiden bygges.
            </p>

            {/* Photo grid */}
            {(draft.brandPhotos ?? []).length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {(draft.brandPhotos ?? []).map((photo, idx) => (
                  <div key={photo.url} className="relative group aspect-square rounded border overflow-hidden bg-muted/30">
                    <img
                      src={photo.url}
                      alt={photo.caption ?? `Brandfoto ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 text-white hidden group-hover:flex items-center justify-center"
                      onClick={() => removePhoto(idx)}
                      title="Fjern"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                    <input
                      type="text"
                      value={photo.caption ?? ""}
                      onChange={(e) => updatePhotoCaption(idx, e.target.value)}
                      placeholder={`Foto ${idx + 1}`}
                      className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/60 text-white px-1 py-0.5 border-none outline-none hidden group-hover:block"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                ))}
                {/* Uploading placeholder */}
                {uploadingPhotoIdx !== null && (
                  <div className="aspect-square rounded border bg-muted/30 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            )}

            {(draft.brandPhotos ?? []).length < MAX_BRAND_PHOTOS && (
              <>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  disabled={uploadingPhotoIdx !== null}
                  onClick={() => photoInputRef.current?.click()}
                  data-testid="brand-upload-photo"
                >
                  {uploadingPhotoIdx !== null ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  {uploadingPhotoIdx !== null ? "Uploader..." : "Tilføj brandfoto"}
                </Button>
              </>
            )}
          </div>

          <Separator />

          {/* Illustration style */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Illustrationsstil</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Beskriv din illustrationsstil. Bruges til AI-genererede billeder og grafik.
            </p>
            <textarea
              className="w-full min-h-[60px] p-2 text-xs border rounded-md resize-none bg-background"
              value={draft.illustrationStyle ?? ""}
              onChange={(e) => updateDraft({ illustrationStyle: e.target.value })}
              onBlur={commitDraft}
              placeholder="Fx: Flad 2D-tegning i varme jordtoner. Enkel linjeføring, ingen gradienter."
              data-testid="brand-illustration-style"
            />
            <div className="space-y-1">
              <Label className="text-xs">Reference-URL (valgfri)</Label>
              <Input
                type="url"
                value={draft.illustrationReferenceUrl ?? ""}
                onChange={(e) => updateDraft({ illustrationReferenceUrl: e.target.value })}
                onBlur={commitDraft}
                placeholder="https://eksempel.com/illustration-stil.png"
                className="h-8 text-xs"
                data-testid="brand-illustration-ref"
              />
            </div>
          </div>

          <Separator />

          {/* Imagery style */}
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
          <ApplyButton draft={draft} onApplyToSite={onApplyToSite} />
        </TabsContent>

        {/* ── TAB: Bevægelse ─────────────────────────────────────────────── */}
        <TabsContent value="bevægelse" className="space-y-5 mt-4">

          {/* Motion preset */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bevægelsesprofil</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Sætter animationspersonlighed for hele sitet. AI'en anvender den på nye sektioner under bygning.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {MOTION_PRESET_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => commit({ ...draft, motionPreset: opt.value })}
                  className={`text-left p-2.5 rounded-md border text-xs transition-colors ${
                    draft.motionPreset === opt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-muted-foreground/40"
                  }`}
                  data-testid={`brand-motion-preset-${opt.value}`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{opt.description}</div>
                </button>
              ))}
            </div>
            {draft.motionPreset && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-muted-foreground"
                onClick={() => commit({ ...draft, motionPreset: undefined })}
              >
                <X className="w-3 h-3 mr-1" />
                Fjern profil
              </Button>
            )}
          </div>

          <Separator />

          {/* Motion description */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bevægelsesbeskrivelse</h4>
            <textarea
              className="w-full min-h-[60px] p-2 text-xs border rounded-md resize-none bg-background"
              value={draft.motionDescription ?? ""}
              onChange={(e) => updateDraft({ motionDescription: e.target.value })}
              onBlur={commitDraft}
              placeholder="Fx: Blide fades — ingen spring eller hop. Animationerne skal understøtte, ikke distrahere."
              data-testid="brand-motion-description"
            />
          </div>

          <Separator />

          {/* Motion level + speed (existing settings) */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Animationsniveau</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Niveau</Label>
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
              <div className="space-y-1">
                <Label className="text-xs">Tempo</Label>
                <Select
                  value={draft.motionSpeed ?? "normal"}
                  onValueChange={(v) => commit({ ...draft, motionSpeed: v as BrandGuide["motionSpeed"] })}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="brand-motion-speed">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slow">Langsomt</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="fast">Hurtigt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />
          <ApplyButton draft={draft} onApplyToSite={onApplyToSite} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ApplyButton({ draft, onApplyToSite }: { draft: BrandGuide; onApplyToSite: (guide: BrandGuide) => void }) {
  return (
    <>
      <Button className="w-full gap-2" onClick={() => onApplyToSite(draft)} data-testid="brand-apply">
        <Wand2 className="w-4 h-4" />
        Anvend på hjemmesiden
      </Button>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Opdaterer globale farver, skrifttyper og hjørner ud fra brand guiden.
      </p>
    </>
  );
}

/**
 * WCAG AA contrast checks for the pairs that actually meet on the site:
 * text/background, text/surface and white-on-primary (buttons). 4.5:1 is
 * the AA threshold for normal text; 0 means a color could not be parsed
 * and the pair is skipped.
 */
function ContrastChecks({ colors }: { colors: BrandGuideColors }) {
  const pairs: { label: string; a: string; b: string }[] = [
    { label: "Tekst på baggrund", a: colors.text, b: colors.background },
    { label: "Tekst på flade", a: colors.text, b: colors.surface },
    { label: "Hvid på primær (knapper)", a: "#ffffff", b: colors.primary },
  ];

  const checks = pairs
    .map((pair) => ({ ...pair, ratio: getContrastRatio(pair.a, pair.b) }))
    .filter((c) => c.ratio > 0);

  if (checks.length === 0) return null;

  return (
    <div className="space-y-1" data-testid="brand-contrast-checks">
      {checks.map((check) => {
        const passes = check.ratio >= 4.5;
        return (
          <div
            key={check.label}
            className="flex items-center justify-between rounded border px-2 py-1 text-[11px]"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="inline-flex h-4 w-7 shrink-0 items-center justify-center rounded-sm border text-[9px] font-bold"
                style={{ backgroundColor: check.b, color: check.a }}
              >
                Aa
              </span>
              <span className="truncate text-muted-foreground">{check.label}</span>
            </span>
            <span className={passes ? "font-medium text-green-600" : "font-medium text-amber-600"}>
              {check.ratio.toFixed(1)}:1 {passes ? "OK" : "Lav kontrast"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
