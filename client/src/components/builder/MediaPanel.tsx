import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Trash2, Crop, Image as ImageIcon } from 'lucide-react';
import ImageCropper from './ImageCropper';
import { useAuth } from '@/lib/auth';

type MediaAsset = {
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
  onSelectImage?: (url: string, mediaId: string) => void;
  selectionMode?: boolean;
};

async function fetchMedia(websiteId: string, token: string): Promise<MediaAsset[]> {
  const res = await fetch(`/api/websites/${websiteId}/media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch media');
  return res.json();
}

async function getMediaUrl(websiteId: string, mediaId: string, token: string): Promise<{ url: string }> {
  const res = await fetch(`/api/websites/${websiteId}/media/${mediaId}/url`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to get media URL');
  return res.json();
}

export default function MediaPanel({ websiteId, onSelectImage, selectionMode = false }: Props) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const accessToken = session?.access_token || '';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<MediaAsset | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['media', websiteId],
    queryFn: () => fetchMedia(websiteId, accessToken),
    enabled: !!websiteId && !!accessToken,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!accessToken) throw new Error('Not authenticated');
      
      const signedUrlRes = await fetch(`/api/websites/${websiteId}/media/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      
      if (!signedUrlRes.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, storagePath, filename } = await signedUrlRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      
      if (!uploadRes.ok) throw new Error('Upload failed');

      let width: number | undefined;
      let height: number | undefined;
      if (file.type.startsWith('image/')) {
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => {
            width = img.naturalWidth;
            height = img.naturalHeight;
            resolve();
          };
          img.src = URL.createObjectURL(file);
        });
      }

      const createRes = await fetch(`/api/websites/${websiteId}/media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          filename,
          originalFilename: file.name,
          storagePath,
          mimeType: file.type,
          size: file.size,
          width,
          height,
        }),
      });

      if (!createRes.ok) throw new Error('Failed to create media record');
      return createRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', websiteId] });
      setUploading(false);
    },
    onError: () => {
      setUploading(false);
    },
  });

  const updateCropMutation = useMutation({
    mutationFn: async ({ mediaId, crop }: { mediaId: string; crop: any }) => {
      if (!accessToken) throw new Error('Not authenticated');
      const res = await fetch(`/api/websites/${websiteId}/media/${mediaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ crop }),
      });
      if (!res.ok) throw new Error('Failed to update crop');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', websiteId] });
      setCropDialogOpen(false);
      setSelectedAsset(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (mediaId: string) => {
      if (!accessToken) throw new Error('Not authenticated');
      const res = await fetch(`/api/websites/${websiteId}/media/${mediaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media', websiteId] });
      setDeleteDialogOpen(false);
      setAssetToDelete(null);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        await uploadMutation.mutateAsync(file);
      }
    }
    e.target.value = '';
  };

  const handleCropClick = async (asset: MediaAsset) => {
    if (!accessToken) return;
    const urlData = await getMediaUrl(websiteId, asset.id, accessToken);
    setPreviewUrl(urlData.url);
    setSelectedAsset(asset);
    setCropDialogOpen(true);
  };

  const handleSelectImage = async (asset: MediaAsset) => {
    if (!onSelectImage || !accessToken) return;
    
    let url = mediaUrls[asset.id];
    if (!url) {
      const urlData = await getMediaUrl(websiteId, asset.id, accessToken);
      url = urlData.url;
      setMediaUrls(prev => ({ ...prev, [asset.id]: url }));
    }
    onSelectImage(url, asset.id);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full"
          data-testid="button-upload-media"
        >
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? 'Uploading...' : 'Upload Images'}
        </Button>
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
          <div className="p-4 text-center text-gray-500">Loading media...</div>
        ) : assets.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No images uploaded yet</p>
            <p className="text-sm">Click upload to add images</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="relative group rounded-lg overflow-hidden border bg-gray-50 cursor-pointer hover:ring-2 hover:ring-blue-500"
                onClick={() => selectionMode && handleSelectImage(asset)}
                data-testid={`media-item-${asset.id}`}
              >
                <div className="aspect-square flex items-center justify-center bg-gray-100">
                  <img
                    src={mediaUrls[asset.id] || `/api/websites/${websiteId}/media/${asset.id}/url`}
                    alt={asset.altText || asset.originalFilename}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      if (accessToken) {
                        getMediaUrl(websiteId, asset.id, accessToken).then(data => {
                          setMediaUrls(prev => ({ ...prev, [asset.id]: data.url }));
                          (e.target as HTMLImageElement).src = data.url;
                        });
                      }
                    }}
                  />
                </div>
                
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!selectionMode && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCropClick(asset);
                        }}
                        data-testid={`button-crop-${asset.id}`}
                      >
                        <Crop className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssetToDelete(asset);
                          setDeleteDialogOpen(true);
                        }}
                        data-testid={`button-delete-${asset.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>

                <div className="p-2">
                  <p className="text-xs truncate font-medium">{asset.originalFilename}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(asset.size)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {cropDialogOpen && selectedAsset && previewUrl && (
        <ImageCropper
          imageSrc={previewUrl}
          open={cropDialogOpen}
          onClose={() => {
            setCropDialogOpen(false);
            setSelectedAsset(null);
          }}
          onSave={(crop) => {
            updateCropMutation.mutate({ mediaId: selectedAsset.id, crop });
          }}
          initialCrop={selectedAsset.crop || undefined}
        />
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Image?</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete "{assetToDelete?.originalFilename}"? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => assetToDelete && deleteMutation.mutate(assetToDelete.id)}
              data-testid="button-confirm-delete"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
