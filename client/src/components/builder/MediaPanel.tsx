/**
 * The website's media library.
 *
 * Every uploaded image for this site, with its real thumbnail, its size and
 * its alt text. It is the "Bibliotek" tab of the image picker and can also
 * stand alone as a manager. Uploads go through the shared helper, so the
 * same validation, the same authorisation header and the same server-measured
 * dimensions apply here as everywhere else.
 */

import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Trash2, Crop, Image as ImageIcon, Loader2 } from 'lucide-react';
import ImageCropper from './ImageCropper';
import { useAuth } from '@/lib/auth';
import { adminSessionHeaders } from '@/lib/adminSession';
import { uploadImage, validateImageFile } from '@/lib/builderUpload';
import type { ImageValue } from '@shared/rendering/imageValue';

export type MediaAsset = {
  id: string;
  websiteId: string;
  filename: string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  crop?: { x: number; y: number; width: number; height: number };
  altText?: string;
  createdAt: string;
};

type Props = {
  websiteId: string;
  /** Picking an asset hands back everything stored about it, not just a URL. */
  onSelectImage?: (value: ImageValue) => void;
  selectionMode?: boolean;
};

async function fetchMedia(websiteId: string, token: string): Promise<MediaAsset[]> {
  const res = await fetch(`/api/websites/${websiteId}/media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Mediebiblioteket kunne ikke hentes');
  return res.json();
}

async function getMediaUrl(websiteId: string, mediaId: string, token: string): Promise<string> {
  const res = await fetch(`/api/websites/${websiteId}/media/${mediaId}/url`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Billedets adresse kunne ikke hentes');
  const { url } = await res.json();
  return url as string;
}

export function mediaAssetToImageValue(asset: MediaAsset, url: string): ImageValue {
  return {
    url,
    mediaId: asset.id,
    ...(asset.altText ? { alt: asset.altText } : {}),
    ...(asset.width && asset.height ? { width: asset.width, height: asset.height } : {}),
    ...(asset.crop ? { crop: asset.crop } : {}),
  };
}

export default function MediaPanel({ websiteId, onSelectImage, selectionMode = false }: Props) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const accessToken = session?.access_token || '';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<MediaAsset | null>(null);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['media', websiteId],
    queryFn: () => fetchMedia(websiteId, accessToken),
    enabled: !!websiteId && !!accessToken,
  });

  // The list endpoint returns storage paths; the browser needs signed URLs.
  // One query for all of them, so a thumbnail never points at a JSON endpoint.
  const { data: urls = {} } = useQuery({
    queryKey: ['media-urls', websiteId, assets.map((a) => a.id).join(',')],
    queryFn: async () => {
      const entries = await Promise.all(
        assets.map(async (asset) => {
          try {
            return [asset.id, await getMediaUrl(websiteId, asset.id, accessToken)] as const;
          } catch {
            return [asset.id, ''] as const;
          }
        })
      );
      return Object.fromEntries(entries) as Record<string, string>;
    },
    enabled: assets.length > 0 && !!accessToken,
  });

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return assets;
    return assets.filter((asset) =>
      `${asset.originalFilename} ${asset.altText ?? ''}`.toLowerCase().includes(needle)
    );
  }, [assets, search]);

  const patchMutation = useMutation({
    mutationFn: async ({ mediaId, patch }: { mediaId: string; patch: { altText?: string; crop?: unknown } }) => {
      if (!accessToken) throw new Error('Ikke logget ind');
      const res = await fetch(`/api/websites/${websiteId}/media/${mediaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...adminSessionHeaders(websiteId),
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Ændringen kunne ikke gemmes');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', websiteId] });
      setCropDialogOpen(false);
    },
    onError: () => setError('Ændringen kunne ikke gemmes.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (mediaId: string) => {
      if (!accessToken) throw new Error('Ikke logget ind');
      const res = await fetch(`/api/websites/${websiteId}/media/${mediaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}`, ...adminSessionHeaders(websiteId) },
      });
      if (!res.ok) throw new Error('Billedet kunne ikke slettes');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', websiteId] });
      setDeleteDialogOpen(false);
      setAssetToDelete(null);
    },
    onError: () => setError('Billedet kunne ikke slettes.'),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const invalid = validateImageFile(file);
        if (invalid) {
          setError(invalid);
          continue;
        }
        await uploadImage(websiteId, accessToken, file);
      }
      queryClient.invalidateQueries({ queryKey: ['media', websiteId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Billedet kunne ikke uploades.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="flex flex-col h-full" data-testid="media-panel">
      <div className="p-4 border-b space-y-2">
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full"
          data-testid="button-upload-media"
        >
          {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {uploading ? 'Uploader …' : 'Upload billeder'}
        </Button>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søg efter filnavn eller alt-tekst"
          className="h-8 text-xs"
          data-testid="input-media-search"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Henter billeder …</div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{assets.length === 0 ? 'Ingen billeder endnu' : 'Ingen billeder matcher søgningen'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-4">
            {visible.map((asset) => (
              <div
                key={asset.id}
                className="relative group rounded-lg overflow-hidden border bg-muted/40 cursor-pointer hover:ring-2 hover:ring-primary"
                onClick={() => {
                  if (!selectionMode || !onSelectImage) return;
                  const url = urls[asset.id];
                  if (url) onSelectImage(mediaAssetToImageValue(asset, url));
                }}
                data-testid={`media-item-${asset.id}`}
              >
                <div className="aspect-square flex items-center justify-center bg-muted">
                  {urls[asset.id] ? (
                    <img
                      src={urls[asset.id]}
                      alt={asset.altText || asset.originalFilename}
                      width={asset.width}
                      height={asset.height}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-6 h-6 opacity-40" />
                  )}
                </div>

                {!selectionMode && (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => { e.stopPropagation(); setSelectedAsset(asset); setCropDialogOpen(true); }}
                      data-testid={`button-crop-${asset.id}`}
                    >
                      <Crop className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => { e.stopPropagation(); setAssetToDelete(asset); setDeleteDialogOpen(true); }}
                      data-testid={`button-delete-${asset.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <div className="p-2 space-y-1">
                  <p className="text-xs truncate font-medium">{asset.originalFilename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(asset.size)}
                    {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
                  </p>
                  <Input
                    defaultValue={asset.altText ?? ''}
                    placeholder="Alt-tekst"
                    className="h-7 text-[11px]"
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      const altText = e.target.value;
                      if (altText !== (asset.altText ?? '')) patchMutation.mutate({ mediaId: asset.id, patch: { altText } });
                    }}
                    data-testid={`input-alt-${asset.id}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {cropDialogOpen && selectedAsset && urls[selectedAsset.id] && (
        <ImageCropper
          imageSrc={urls[selectedAsset.id]}
          open={cropDialogOpen}
          onClose={() => { setCropDialogOpen(false); setSelectedAsset(null); }}
          onSave={(crop) => patchMutation.mutate({ mediaId: selectedAsset.id, patch: { crop } })}
          initialCrop={selectedAsset.crop || undefined}
        />
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Slet billede?</DialogTitle>
          </DialogHeader>
          <p className="text-sm">Vil du slette "{assetToDelete?.originalFilename}"? Det kan ikke fortrydes.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Annullér</Button>
            <Button
              variant="destructive"
              onClick={() => assetToDelete && deleteMutation.mutate(assetToDelete.id)}
              data-testid="button-confirm-delete"
            >
              Slet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
