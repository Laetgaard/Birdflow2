/**
 * Choosing an image, in one place.
 *
 * Before this, every image field was a URL box with an upload button beside
 * it: no way to reach what was already uploaded, no alt text, no way to say
 * which part of a photo matters. This dialog offers the four real sources —
 * a new file, the site's media library, the brand's own photos, an external
 * URL — and then the details that decide how the picture is drawn: alt text,
 * focal point, fit and crop.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Crop, ImageIcon, Loader2, Upload } from 'lucide-react';
import MediaPanel from './MediaPanel';
import ImageCropper from './ImageCropper';
import { uploadImage, validateImageFile } from '@/lib/builderUpload';
import { normalizeImageValue } from '@shared/rendering/imageRender';
import type { ImageValue } from '@shared/rendering/imageValue';
import type { BrandGuide } from '@shared/schema';

type Props = {
  open: boolean;
  onClose: () => void;
  websiteId: string;
  accessToken: string;
  brandGuide?: BrandGuide | null;
  /** What is chosen now, so the dialog opens on it. */
  value?: ImageValue | null;
  /** What the image is for, shown in the title. */
  subject?: string;
  onSelect: (value: ImageValue) => void;
};

export default function ImagePicker({ open, onClose, websiteId, accessToken, brandGuide, value, subject, onSelect }: Props) {
  const [draft, setDraft] = useState<ImageValue>(() => normalizeImageValue(value ?? null));
  const [tab, setTab] = useState('upload');
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLImageElement>(null);

  // Re-opening on a different field must not show the previous one's choice.
  useEffect(() => {
    if (!open) return;
    const initial = normalizeImageValue(value ?? null);
    setDraft(initial);
    setUrlInput(initial.url && !initial.mediaId ? initial.url : '');
    setError(null);
    setTab(initial.url ? 'bibliotek' : 'upload');
  }, [open, value]);

  const brandImages = useMemo(() => {
    const photos = (brandGuide?.brandPhotos ?? []).filter((p) => p.url);
    const logo = brandGuide?.logoUrl ? [{ url: brandGuide.logoUrl, caption: 'Logo' }] : [];
    return [...logo, ...photos];
  }, [brandGuide]);

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const uploaded = await uploadImage(websiteId, accessToken, file);
      setDraft((prev) => ({ ...uploaded, alt: prev.alt, focal: prev.focal, fit: prev.fit }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Billedet kunne ikke uploades.');
    } finally {
      setUploading(false);
    }
  };

  // Clicking the preview says which part of the picture must stay visible when
  // a slot crops it — the same point both renderers turn into object-position.
  const setFocalFromClick = (event: React.MouseEvent<HTMLImageElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setDraft((prev) => ({
      ...prev,
      focal: {
        x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      },
    }));
  };

  const commit = () => {
    if (!draft.url) {
      setError('Vælg et billede først.');
      return;
    }
    onSelect(draft);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-3xl" data-testid="image-picker">
        <DialogHeader>
          <DialogTitle>{subject ? `Vælg billede — ${subject}` : 'Vælg billede'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-4 w-full h-9">
              <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
              <TabsTrigger value="bibliotek" className="text-xs">Bibliotek</TabsTrigger>
              <TabsTrigger value="brand" className="text-xs">Brandfotos</TabsTrigger>
              <TabsTrigger value="url" className="text-xs">URL</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-3">
              <div
                className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground cursor-pointer"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); void chooseFile(e.dataTransfer.files?.[0]); }}
                data-testid="image-picker-dropzone"
              >
                {uploading ? <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" /> : <Upload className="h-6 w-6 mx-auto mb-2" />}
                <p>{uploading ? 'Uploader …' : 'Træk et billede hertil, eller klik for at vælge'}</p>
                <p className="text-xs mt-1">JPG, PNG, WebP, AVIF, GIF eller SVG — op til 15 MB</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; void chooseFile(file); }}
              />
            </TabsContent>

            <TabsContent value="bibliotek" className="mt-3">
              <div className="h-80 border rounded-lg overflow-hidden">
                <MediaPanel
                  websiteId={websiteId}
                  selectionMode
                  onSelectImage={(picked) => setDraft((prev) => ({ ...picked, alt: picked.alt ?? prev.alt, focal: prev.focal, fit: prev.fit }))}
                />
              </div>
            </TabsContent>

            <TabsContent value="brand" className="mt-3">
              {brandImages.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6 text-center">
                  Der er ingen brandfotos endnu. Tilføj dem under Brand.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                  {brandImages.map((photo, index) => (
                    <button
                      key={`${photo.url}-${index}`}
                      type="button"
                      className="rounded-md overflow-hidden border hover:ring-2 hover:ring-primary"
                      onClick={() => setDraft((prev) => ({ ...prev, url: photo.url, mediaId: undefined, width: undefined, height: undefined, crop: undefined }))}
                      data-testid={`brand-photo-${index}`}
                    >
                      <img src={photo.url} alt={photo.caption ?? ''} loading="lazy" decoding="async" className="w-full h-24 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="url" className="mt-3 space-y-2">
              <Label className="text-xs">Billedets adresse</Label>
              <div className="flex gap-2">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://…"
                  data-testid="input-image-url"
                />
                <Button
                  variant="outline"
                  onClick={() => setDraft((prev) => ({ ...prev, url: urlInput.trim(), mediaId: undefined, width: undefined, height: undefined, crop: undefined }))}
                >
                  Brug
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Et eksternt billede kan ikke beskæres i størrelser, og det forsvinder hvis kilden fjerner det.
              </p>
            </TabsContent>
          </Tabs>

          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 overflow-hidden">
              {draft.url ? (
                <img
                  ref={previewRef}
                  src={draft.url}
                  alt={draft.alt ?? ''}
                  onClick={setFocalFromClick}
                  className="w-full h-40 object-cover cursor-crosshair"
                  style={{ objectPosition: draft.focal ? `${draft.focal.x * 100}% ${draft.focal.y * 100}%` : 'center' }}
                  data-testid="image-picker-preview"
                />
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
                  <ImageIcon className="h-6 w-6 opacity-50" />
                  Intet billede valgt
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Klik på billedet for at vælge det punkt, der altid skal være synligt.
            </p>

            <div className="space-y-1">
              <Label className="text-xs">Alt-tekst</Label>
              <Input
                value={draft.alt ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, alt: e.target.value }))}
                placeholder="Hvad viser billedet?"
                data-testid="input-image-alt"
              />
              <p className="text-[11px] text-muted-foreground">Lad feltet stå tomt, hvis billedet kun er pynt.</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tilpasning</Label>
              <Select value={draft.fit ?? 'cover'} onValueChange={(fit) => setDraft((prev) => ({ ...prev, fit: fit as 'cover' | 'contain' }))}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-image-fit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">Udfyld feltet (beskær)</SelectItem>
                  <SelectItem value="contain">Vis hele billedet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={!draft.url}
              onClick={() => setCropOpen(true)}
              data-testid="button-open-cropper"
            >
              <Crop className="h-4 w-4 mr-1" />
              {draft.crop ? 'Redigér beskæring' : 'Beskær'}
            </Button>
            {draft.crop && !draft.width && (
              <p className="text-[11px] text-muted-foreground">
                Billedets oprindelige størrelse kendes ikke, så beskæringen vises som et midterudsnit. Upload billedet igen for en nøjagtig beskæring.
              </p>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annullér</Button>
          <Button onClick={commit} disabled={!draft.url} data-testid="button-use-image">Brug billedet</Button>
        </DialogFooter>

        {cropOpen && draft.url && (
          <ImageCropper
            imageSrc={draft.url}
            open={cropOpen}
            onClose={() => setCropOpen(false)}
            onSave={(crop) => {
              // The cropper reports natural pixels; storing the natural size
              // beside them is what lets both renderers lay the crop out exactly.
              const natural = previewRef.current;
              setDraft((prev) => ({
                ...prev,
                crop,
                ...(prev.width || !natural?.naturalWidth ? {} : { width: natural.naturalWidth, height: natural.naturalHeight }),
              }));
              setCropOpen(false);
            }}
            initialCrop={draft.crop}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
