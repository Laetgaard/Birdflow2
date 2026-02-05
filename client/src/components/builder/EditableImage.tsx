import { useState, useRef, useCallback } from 'react';
import { Image, Upload, X, Crop, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface EditableImageProps {
  src: string;
  alt?: string;
  onImageChange: (newUrl: string) => void;
  isPreview?: boolean;
  className?: string;
  style?: React.CSSProperties;
  aspectRatio?: 'auto' | '1:1' | '16:9' | '4:3' | '3:2';
}

export default function EditableImage({
  src,
  alt = '',
  onImageChange,
  isPreview = false,
  className = '',
  style = {},
  aspectRatio = 'auto',
}: EditableImageProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Fejl', description: 'Vælg venligst en billedfil', variant: 'destructive' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Fejl', description: 'Billedet må max være 10MB', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      onImageChange(data.url);
      toast({ title: 'Billede uploadet' });
    } catch (error) {
      toast({ title: 'Fejl', description: 'Kunne ikke uploade billede', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  }, [onImageChange, toast]);

  const handleUrlSubmit = useCallback(() => {
    if (urlValue.trim()) {
      onImageChange(urlValue.trim());
      setShowUrlInput(false);
      setUrlValue('');
    }
  }, [urlValue, onImageChange]);

  if (isPreview) {
    return (
      <img
        src={src || '/placeholder-image.svg'}
        alt={alt}
        className={className}
        style={style}
      />
    );
  }

  const aspectRatioStyle = aspectRatio !== 'auto' ? {
    aspectRatio: aspectRatio.replace(':', '/'),
  } : {};

  return (
    <div
      className={`relative group ${className}`}
      style={{ ...style, ...aspectRatioStyle }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid="editable-image"
    >
      <img
        src={src || '/placeholder-image.svg'}
        alt={alt}
        className="w-full h-full object-cover"
        style={{ borderRadius: 'inherit' }}
      />

      {/* Hover overlay */}
      {isHovered && !showUrlInput && (
        <div
          className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 transition-opacity duration-200"
          style={{ borderRadius: 'inherit' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="gap-1"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? 'Uploader...' : 'Upload'}
          </Button>
          
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowUrlInput(true)}
          >
            URL
          </Button>
        </div>
      )}

      {/* URL input overlay */}
      {showUrlInput && (
        <div
          className="absolute inset-0 bg-black/70 flex items-center justify-center p-4"
          style={{ borderRadius: 'inherit' }}
        >
          <div className="bg-white rounded-lg p-4 w-full max-w-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Indsæt billede-URL</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowUrlInput(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <input
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border rounded-md text-sm mb-3"
              onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
              autoFocus
            />
            <Button
              size="sm"
              className="w-full"
              onClick={handleUrlSubmit}
              disabled={!urlValue.trim()}
            >
              Anvend
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!src && !isHovered && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50"
          style={{ borderRadius: 'inherit' }}
        >
          <Image className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">Klik for at tilføje billede</span>
        </div>
      )}
    </div>
  );
}
