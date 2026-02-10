import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, Search, Loader2, Link } from "lucide-react";

interface InlineImagePickerProps {
  currentUrl: string;
  onImageChange: (url: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
  websiteId?: string;
  accessToken?: string;
}

export default function InlineImagePicker({
  currentUrl,
  onImageChange,
  onClose,
  position,
  websiteId,
  accessToken,
}: InlineImagePickerProps) {
  const [urlInput, setUrlInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/uploads/optimized-image", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { objectPath } = await res.json();
      const url = `/api/uploads/serve/${objectPath}`;
      onImageChange(url);
      onClose();
    } catch (e) {
      console.error("Image upload failed:", e);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleUrlApply = () => {
    const trimmed = urlInput.trim();
    if (trimmed) {
      onImageChange(trimmed);
      onClose();
    }
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleUrlApply();
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (term.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    const seeds = [
      `${term}-1`,
      `${term}-2`,
      `${term}-3`,
      `${term}-4`,
      `${term}-5`,
      `${term}-6`,
    ];
    setSearchResults(
      seeds.map((seed) => `https://picsum.photos/seed/${seed}/800/600`)
    );
  };

  const handleThumbnailClick = (url: string) => {
    onImageChange(url);
    onClose();
  };

  return (
    <div
      className="absolute z-50 w-[280px] rounded-xl border bg-white shadow-2xl backdrop-blur"
      style={{ top: position.top, left: position.left }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold text-gray-900">
          Skift billede
        </span>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 p-4">
        {/* Upload button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isUploading ? "Uploader..." : "Upload billede"}
          </Button>
        </div>

        {/* URL input */}
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleUrlKeyDown}
            placeholder="Inds\u00E6t billed-URL..."
            className="text-sm"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleUrlApply}
            disabled={!urlInput.trim()}
          >
            <Link className="h-4 w-4" />
          </Button>
        </div>

        {/* Stock photo search */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="S\u00F8g efter billeder..."
              className="pl-8 text-sm"
            />
          </div>

          {searchResults.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5">
              {searchResults.map((url, i) => (
                <button
                  key={i}
                  onClick={() => handleThumbnailClick(url)}
                  className="overflow-hidden rounded-md border border-gray-200 hover:border-primary hover:ring-1 hover:ring-primary transition-all"
                >
                  <img
                    src={url}
                    alt={`${searchTerm} ${i + 1}`}
                    className="h-[60px] w-[80px] object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
