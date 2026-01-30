import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Trash2, Plus, GripVertical, Upload, Crop, Loader2, Move } from "lucide-react";
import { 
  componentRegistry, 
  themeColors,
  spacingPresets,
  fontFamilyPresets,
  fontSizePresets,
  fontWeightPresets,
  animationPresets,
  type BuilderComponentData, 
  type ComponentProps, 
  type ComponentStyles,
  type FieldDefinition,
  type ComponentItem,
  type StyledText
} from "@shared/componentRegistry";
import ImageCropper from "./ImageCropper";

type CropData = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageValue = {
  url: string;
  mediaId?: string;
  crop?: CropData;
};

type Props = {
  component: BuilderComponentData;
  onUpdate: (updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => void;
  onDelete: () => void;
  onMove: (direction: 'up' | 'down') => void;
  websiteId: string;
  accessToken: string;
};

async function uploadImage(
  websiteId: string, 
  accessToken: string, 
  file: File
): Promise<{ url: string; mediaId: string }> {
  // Use optimized image upload endpoint for compression and WebP conversion
  const formData = new FormData();
  formData.append('image', file);
  
  const optimizedRes = await fetch('/api/uploads/optimized-image', {
    method: 'POST',
    body: formData,
  });
  
  if (!optimizedRes.ok) {
    throw new Error('Failed to upload and optimize image');
  }
  
  const { objectPath, optimizedSize } = await optimizedRes.json();

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

  const filename = objectPath.split('/').pop() || `${Date.now()}.webp`;

  const createRes = await fetch(`/api/websites/${websiteId}/media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      filename,
      originalFilename: file.name,
      storagePath: objectPath,
      mimeType: 'image/webp',
      size: optimizedSize,
      width,
      height,
    }),
  });

  if (!createRes.ok) throw new Error('Failed to create media record');
  const media = await createRes.json();

  const urlRes = await fetch(`/api/websites/${websiteId}/media/${media.id}/url`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!urlRes.ok) throw new Error('Failed to get media URL');
  const { url } = await urlRes.json();

  return { url, mediaId: media.id };
}

export default function PropertiesPanel({ component, onUpdate, onDelete, onMove, websiteId, accessToken }: Props) {
  const definition = componentRegistry[component.type];
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImage, setCropperImage] = useState<string>('');
  const [cropperField, setCropperField] = useState<{ field: FieldDefinition; index?: number } | null>(null);
  const [initialCrop, setInitialCrop] = useState<CropData | undefined>();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  
  if (!definition) {
    return <div className="p-4 text-muted-foreground">Unknown component type</div>;
  }

  const contentFields = definition.fields.filter(f => f.group === 'content');
  const styleFields = definition.fields.filter(f => f.group === 'style');

  const getValue = (field: FieldDefinition): any => {
    if (field.group === 'style') {
      return component.styles[field.key as keyof ComponentStyles] ?? '';
    }
    return component.props[field.key as keyof ComponentProps] ?? '';
  };

  const setValue = (field: FieldDefinition, value: any) => {
    if (field.group === 'style') {
      onUpdate({ styles: { [field.key]: value } });
    } else {
      onUpdate({ props: { [field.key]: value } });
    }
  };

  const parseImageValue = (value: any): ImageValue => {
    if (typeof value === 'string') {
      return { url: value };
    }
    if (value && typeof value === 'object' && 'url' in value) {
      return value as ImageValue;
    }
    return { url: '' };
  };

  const handleFileUpload = async (field: FieldDefinition, file: File, arrayIndex?: number) => {
    const fieldKey = arrayIndex !== undefined ? `${field.key}-${arrayIndex}` : field.key;
    setUploadingField(fieldKey);
    
    try {
      const { url, mediaId } = await uploadImage(websiteId, accessToken, file);
      
      if (arrayIndex !== undefined) {
        const currentValue = getValue(field);
        const images = Array.isArray(currentValue) ? [...currentValue] : [];
        images[arrayIndex] = { url, mediaId };
        setValue(field, images);
      } else {
        setValue(field, { url, mediaId });
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploadingField(null);
    }
  };

  const openCropper = (imageUrl: string, field: FieldDefinition, index?: number, existingCrop?: CropData) => {
    setCropperImage(imageUrl);
    setCropperField({ field, index });
    setInitialCrop(existingCrop);
    setCropperOpen(true);
  };

  const handleCropSave = (crop: CropData) => {
    if (!cropperField) return;
    
    const { field, index } = cropperField;
    
    if (index !== undefined) {
      const currentValue = getValue(field);
      const images = Array.isArray(currentValue) ? [...currentValue] : [];
      const current = parseImageValue(images[index]);
      images[index] = { ...current, crop };
      setValue(field, images);
    } else {
      const current = parseImageValue(getValue(field));
      setValue(field, { ...current, crop });
    }
    
    setCropperOpen(false);
    setCropperField(null);
  };

  const renderField = (field: FieldDefinition) => {
    const value = getValue(field);

    switch (field.type) {
      case 'text':
        return (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
            <Input
              value={value}
              onChange={(e) => setValue(field, e.target.value)}
              placeholder={field.placeholder}
              data-testid={`input-${field.key}`}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
            <textarea
              className="w-full min-h-[80px] p-2 text-sm border rounded-md resize-none bg-background"
              value={value}
              onChange={(e) => setValue(field, e.target.value)}
              placeholder={field.placeholder}
              data-testid={`textarea-${field.key}`}
            />
          </div>
        );

      case 'color': {
        const colorPresets = field.key === 'backgroundColor' ? themeColors.backgrounds : 
          field.key === 'buttonColor' ? themeColors.backgrounds : themeColors.text;
        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-xs">{field.label}</Label>
            <div className="flex flex-wrap gap-1">
              {colorPresets.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={`w-6 h-6 rounded border-2 transition-all ${value === color.value ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-muted-foreground/30'}`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setValue(field, color.value)}
                  title={color.name}
                  data-testid={`color-preset-${field.key}-${color.name.toLowerCase().replace(' ', '-')}`}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <Input
                type="color"
                value={value || '#ffffff'}
                onChange={(e) => setValue(field, e.target.value)}
                className="w-10 h-9 p-1 cursor-pointer"
                data-testid={`color-${field.key}`}
              />
              <Input
                value={value}
                onChange={(e) => setValue(field, e.target.value)}
                placeholder="#ffffff"
                className="flex-1"
              />
            </div>
          </div>
        );
      }

      case 'range': {
        const numValue = typeof value === 'number' ? value : (field.min ?? 0);
        const min = field.min ?? 0;
        const max = field.max ?? 100;
        const step = field.step ?? 1;
        const unit = field.unit ?? '';
        return (
          <div key={field.key} className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">{field.label}</Label>
              <span className="text-xs text-muted-foreground">{numValue}{unit}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={numValue}
              onChange={(e) => setValue(field, parseInt(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              data-testid={`range-${field.key}`}
            />
          </div>
        );
      }

      case 'select':
        return (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
            <Select value={value} onValueChange={(v) => setValue(field, v)}>
              <SelectTrigger data-testid={`select-${field.key}`}>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'image': {
        const imageValue = parseImageValue(value);
        const isUploading = uploadingField === field.key;
        
        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-xs">{field.label}</Label>
            <div className="flex gap-1">
              <Input
                value={imageValue.url}
                onChange={(e) => setValue(field, { ...imageValue, url: e.target.value })}
                placeholder="https://... or upload"
                className="flex-1"
                data-testid={`input-${field.key}`}
              />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={el => { fileInputRefs.current[field.key] = el; }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(field, file);
                  e.target.value = '';
                }}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => fileInputRefs.current[field.key]?.click()}
                disabled={isUploading}
                data-testid={`button-upload-${field.key}`}
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
              {imageValue.url && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => openCropper(imageValue.url, field, undefined, imageValue.crop)}
                  data-testid={`button-crop-${field.key}`}
                >
                  <Crop className="h-4 w-4" />
                </Button>
              )}
            </div>
            {imageValue.url && (
              <div className="relative">
                <img 
                  src={imageValue.url} 
                  alt="Preview" 
                  className="w-full h-24 object-cover rounded-md"
                  style={imageValue.crop ? {
                    objectFit: 'none',
                    objectPosition: `-${imageValue.crop.x}px -${imageValue.crop.y}px`,
                    width: imageValue.crop.width,
                    height: Math.min(imageValue.crop.height, 96),
                  } : undefined}
                />
                {imageValue.crop && (
                  <span className="absolute bottom-1 right-1 text-xs bg-black/50 text-white px-1 rounded">
                    Cropped
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'image-array': {
        const images = Array.isArray(value) ? value.map(parseImageValue) : [];
        
        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-xs">{field.label}</Label>
            {images.map((img, i) => {
              const fieldKey = `${field.key}-${i}`;
              const isUploading = uploadingField === fieldKey;
              
              return (
                <div key={i} className="space-y-1 p-2 border rounded-md bg-muted/30">
                  <div className="flex gap-1">
                    <Input
                      value={img.url}
                      onChange={(e) => {
                        const newImages = [...images];
                        newImages[i] = { ...img, url: e.target.value };
                        setValue(field, newImages);
                      }}
                      placeholder="Image URL"
                      className="flex-1"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={el => { fileInputRefs.current[fieldKey] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(field, file, i);
                        e.target.value = '';
                      }}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => fileInputRefs.current[fieldKey]?.click()}
                      disabled={isUploading}
                      data-testid={`button-upload-${fieldKey}`}
                    >
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    </Button>
                    {img.url && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => openCropper(img.url, field, i, img.crop)}
                        data-testid={`button-crop-${fieldKey}`}
                      >
                        <Crop className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 shrink-0"
                      onClick={() => {
                        const newImages = images.filter((_, idx) => idx !== i);
                        setValue(field, newImages);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {img.url && (
                    <div className="relative">
                      <img 
                        src={img.url} 
                        alt={`Image ${i + 1}`} 
                        className="w-full h-16 object-cover rounded"
                      />
                      {img.crop && (
                        <span className="absolute bottom-1 right-1 text-xs bg-black/50 text-white px-1 rounded">
                          Cropped
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setValue(field, [...images, { url: '' }])}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Image
            </Button>
          </div>
        );
      }

      case 'items':
        const items = (value as ComponentItem[]) || [];
        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-xs">{field.label}</Label>
            {items.map((item, i) => (
              <div key={item.id} className="border rounded-md p-2 space-y-2 bg-muted/50">
                <div className="flex items-center gap-1">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium flex-1">Item {i + 1}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => {
                      const newItems = items.filter((_, idx) => idx !== i);
                      setValue(field, newItems);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <Input
                  value={item.title}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[i] = { ...item, title: e.target.value };
                    setValue(field, newItems);
                  }}
                  placeholder="Title"
                  className="h-8 text-sm"
                />
                <Input
                  value={item.description}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[i] = { ...item, description: e.target.value };
                    setValue(field, newItems);
                  }}
                  placeholder="Description"
                  className="h-8 text-sm"
                />
                {item.icon !== undefined && (
                  <Input
                    value={item.icon || ''}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[i] = { ...item, icon: e.target.value };
                      setValue(field, newItems);
                    }}
                    placeholder="Icon (emoji)"
                    className="h-8 text-sm"
                  />
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                const newItem: ComponentItem = {
                  id: Math.random().toString(36).substring(2, 9),
                  title: 'New Item',
                  description: 'Description here',
                  icon: '✨',
                };
                setValue(field, [...items, newItem]);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>
          </div>
        );

      case 'styled-text': {
        const styledValue: StyledText = typeof value === 'object' && value !== null 
          ? value as StyledText 
          : { text: typeof value === 'string' ? value : '' };
        
        return (
          <div key={field.key} className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <Label className="text-xs font-medium">{field.label}</Label>
            
            <Input
              value={styledValue.text || ''}
              onChange={(e) => setValue(field, { ...styledValue, text: e.target.value })}
              placeholder={field.placeholder || 'Enter text...'}
              data-testid={`styled-text-${field.key}`}
            />
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Font</Label>
                <Select 
                  value={styledValue.fontFamily || ''} 
                  onValueChange={(v) => setValue(field, { ...styledValue, fontFamily: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Inherit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Inherit</SelectItem>
                    {fontFamilyPresets.map(font => (
                      <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                        {font.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Size</Label>
                <Select 
                  value={styledValue.fontSize || ''} 
                  onValueChange={(v) => setValue(field, { ...styledValue, fontSize: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Inherit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Inherit</SelectItem>
                    <SelectItem value="12px">12px</SelectItem>
                    <SelectItem value="14px">14px</SelectItem>
                    <SelectItem value="16px">16px</SelectItem>
                    <SelectItem value="18px">18px</SelectItem>
                    <SelectItem value="20px">20px</SelectItem>
                    <SelectItem value="24px">24px</SelectItem>
                    <SelectItem value="28px">28px</SelectItem>
                    <SelectItem value="32px">32px</SelectItem>
                    <SelectItem value="36px">36px</SelectItem>
                    <SelectItem value="42px">42px</SelectItem>
                    <SelectItem value="48px">48px</SelectItem>
                    <SelectItem value="56px">56px</SelectItem>
                    <SelectItem value="64px">64px</SelectItem>
                    <SelectItem value="72px">72px</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Weight</Label>
                <Select 
                  value={styledValue.fontWeight || ''} 
                  onValueChange={(v) => setValue(field, { ...styledValue, fontWeight: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Inherit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Inherit</SelectItem>
                    {fontWeightPresets.map(weight => (
                      <SelectItem key={weight.value} value={weight.value}>
                        {weight.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Transform</Label>
                <Select 
                  value={styledValue.textTransform || ''} 
                  onValueChange={(v) => setValue(field, { ...styledValue, textTransform: v as StyledText['textTransform'] })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="uppercase">UPPERCASE</SelectItem>
                    <SelectItem value="lowercase">lowercase</SelectItem>
                    <SelectItem value="capitalize">Capitalize</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Color</Label>
              <div className="flex gap-1">
                <Input
                  type="color"
                  value={styledValue.color || '#000000'}
                  onChange={(e) => setValue(field, { ...styledValue, color: e.target.value })}
                  className="w-10 h-8 p-1 cursor-pointer"
                />
                <Input
                  value={styledValue.color || ''}
                  onChange={(e) => setValue(field, { ...styledValue, color: e.target.value })}
                  placeholder="Inherit"
                  className="flex-1 h-8 text-xs"
                />
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{definition.name}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMove('up')} data-testid="button-move-up">
            <Move className="w-4 h-4 rotate-180" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onMove('down')} data-testid="button-move-down">
            <Move className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete} data-testid="button-delete">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {contentFields.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">Content</h4>
          {contentFields.map(renderField)}
        </div>
      )}

      {styleFields.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Styles</h4>
            {styleFields.map(renderField)}
          </div>
        </>
      )}

      <Separator />
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">Spacing</h4>
        <div className="space-y-2">
          <Label className="text-xs">Padding</Label>
          <div className="flex flex-wrap gap-1">
            {spacingPresets.padding.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`px-2 py-1 text-xs rounded border transition-all ${component.styles.padding === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                onClick={() => onUpdate({ styles: { padding: preset.value } })}
                data-testid={`spacing-padding-${preset.name.toLowerCase().replace(' ', '-')}`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Separator />
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">Typography</h4>
        
        <div className="space-y-2">
          <Label className="text-xs">Font Family</Label>
          <Select 
            value={component.styles.fontFamily || 'Inter, system-ui, sans-serif'} 
            onValueChange={(value) => onUpdate({ styles: { fontFamily: value } })}
          >
            <SelectTrigger className="h-8" data-testid="select-font-family">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] overflow-y-auto">
              {fontFamilyPresets.map((font) => (
                <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                  {font.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Heading Size</Label>
          <div className="flex flex-wrap gap-1">
            {fontSizePresets.heading.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`px-2 py-1 text-xs rounded border transition-all ${component.styles.titleFontSize === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                onClick={() => onUpdate({ styles: { titleFontSize: preset.value } })}
                data-testid={`font-heading-${preset.name.toLowerCase().replace(' ', '-')}`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Body Size</Label>
          <div className="flex flex-wrap gap-1">
            {fontSizePresets.body.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`px-2 py-1 text-xs rounded border transition-all ${component.styles.bodyFontSize === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                onClick={() => onUpdate({ styles: { bodyFontSize: preset.value } })}
                data-testid={`font-body-${preset.name.toLowerCase().replace(' ', '-')}`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Font Weight</Label>
          <div className="flex flex-wrap gap-1">
            {fontWeightPresets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`px-2 py-1 text-xs rounded border transition-all ${component.styles.fontWeight === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                onClick={() => onUpdate({ styles: { fontWeight: preset.value } })}
                style={{ fontWeight: parseInt(preset.value) }}
                data-testid={`font-weight-${preset.name.toLowerCase()}`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Separator />
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground">Animation</h4>
        
        <div className="space-y-2">
          <Label className="text-xs">Entrance Animation</Label>
          <Select 
            value={component.styles.animationType || 'none'} 
            onValueChange={(value) => onUpdate({ styles: { animationType: value as any } })}
          >
            <SelectTrigger className="h-8" data-testid="select-animation-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {animationPresets.entrance.map((anim) => (
                <SelectItem key={anim.value} value={anim.value}>
                  {anim.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Animation Trigger</Label>
          <div className="flex flex-wrap gap-1">
            {animationPresets.trigger.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`px-2 py-1 text-xs rounded border transition-all ${component.styles.animationTrigger === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                onClick={() => onUpdate({ styles: { animationTrigger: preset.value as any } })}
                data-testid={`animation-trigger-${preset.value}`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Duration</Label>
          <div className="flex flex-wrap gap-1">
            {animationPresets.duration.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`px-2 py-1 text-xs rounded border transition-all ${component.styles.animationDuration === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                onClick={() => onUpdate({ styles: { animationDuration: preset.value } })}
                data-testid={`animation-duration-${preset.name.toLowerCase()}`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Delay</Label>
          <div className="flex flex-wrap gap-1">
            {animationPresets.delay.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`px-2 py-1 text-xs rounded border transition-all ${component.styles.animationDelay === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                onClick={() => onUpdate({ styles: { animationDelay: preset.value } })}
                data-testid={`animation-delay-${preset.name.toLowerCase()}`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {cropperOpen && cropperImage && (
        <ImageCropper
          imageSrc={cropperImage}
          open={cropperOpen}
          onClose={() => {
            setCropperOpen(false);
            setCropperField(null);
          }}
          onSave={handleCropSave}
          initialCrop={initialCrop}
        />
      )}
    </div>
  );
}
