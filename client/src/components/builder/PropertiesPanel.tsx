import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Trash2, Plus, GripVertical, Upload, Crop, Loader2, Move, Type, Paintbrush, Sparkles, ChevronDown, ChevronUp, Square, Circle } from "lucide-react";
import {
  componentRegistry,
  themeColors,
  spacingPresets,
  fontFamilyPresets,
  fontSizePresets,
  fontWeightPresets,
  animationPresets,
  shadowPresets,
  borderRadiusPresets,
  buttonStylePresets,
  cardStylePresets,
  gradientPresets,
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

type TabId = 'content' | 'design' | 'animation';

async function uploadImage(
  websiteId: string,
  accessToken: string,
  file: File
): Promise<{ url: string; mediaId: string }> {
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
  const [activeTab, setActiveTab] = useState<TabId>('content');
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImage, setCropperImage] = useState<string>('');
  const [cropperField, setCropperField] = useState<{ field: FieldDefinition; index?: number } | null>(null);
  const [initialCrop, setInitialCrop] = useState<CropData | undefined>();
  const [showAdvancedSpacing, setShowAdvancedSpacing] = useState(false);
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

  // Parse padding into 4 values
  const parsePadding = (padding: string | undefined): { top: string; right: string; bottom: string; left: string } => {
    if (!padding) return { top: '60', right: '24', bottom: '60', left: '24' };
    const parts = padding.replace(/px/g, '').trim().split(/\s+/);
    if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
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
                {item.role !== undefined && (
                  <Input
                    value={item.role || ''}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[i] = { ...item, role: e.target.value };
                      setValue(field, newItems);
                    }}
                    placeholder="Role"
                    className="h-8 text-sm"
                  />
                )}
                {item.price !== undefined && (
                  <Input
                    value={String(item.price ?? '')}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[i] = { ...item, price: e.target.value };
                      setValue(field, newItems);
                    }}
                    placeholder="Price"
                    className="h-8 text-sm"
                  />
                )}
                {item.period !== undefined && (
                  <Input
                    value={item.period || ''}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[i] = { ...item, period: e.target.value };
                      setValue(field, newItems);
                    }}
                    placeholder="Period (e.g. /md)"
                    className="h-8 text-sm"
                  />
                )}
                {item.features !== undefined && (
                  <Textarea
                    value={(item.features || []).join('\n')}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[i] = {
                        ...item,
                        features: e.target.value.split('\n').map((f) => f.trim()).filter(Boolean),
                      };
                      setValue(field, newItems);
                    }}
                    placeholder="One feature per line"
                    className="text-sm min-h-[80px]"
                  />
                )}
                {item.ctaText !== undefined && (
                  <Input
                    value={item.ctaText || ''}
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[i] = { ...item, ctaText: e.target.value };
                      setValue(field, newItems);
                    }}
                    placeholder="Button text"
                    className="h-8 text-sm"
                  />
                )}
                {item.highlighted !== undefined && (
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Highlighted</Label>
                    <Switch
                      checked={!!item.highlighted}
                      onCheckedChange={(checked) => {
                        const newItems = [...items];
                        newItems[i] = { ...item, highlighted: checked };
                        setValue(field, newItems);
                      }}
                    />
                  </div>
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
                  value={styledValue.fontFamily || 'inherit'}
                  onValueChange={(v) => setValue(field, { ...styledValue, fontFamily: v === 'inherit' ? '' : v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Inherit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Inherit</SelectItem>
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
                  value={styledValue.fontSize || 'inherit'}
                  onValueChange={(v) => setValue(field, { ...styledValue, fontSize: v === 'inherit' ? '' : v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Inherit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Inherit</SelectItem>
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
                  value={styledValue.fontWeight || 'inherit'}
                  onValueChange={(v) => setValue(field, { ...styledValue, fontWeight: v === 'inherit' ? '' : v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Inherit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Inherit</SelectItem>
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

  // ---- TAB: Content ----
  const renderContentTab = () => (
    <div className="space-y-3">
      {contentFields.length > 0 && contentFields.map(renderField)}
      {styleFields.length > 0 && (
        <>
          <Separator className="my-3" />
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stil-felter</h4>
          {styleFields.map(renderField)}
        </>
      )}
    </div>
  );

  // ---- TAB: Design ----
  const renderDesignTab = () => {
    const padding = parsePadding(component.styles.padding);

    return (
      <div className="space-y-4">
        {/* Typography Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Type className="h-3 w-3" />
            Typografi
          </h4>

          <div className="space-y-2">
            <Label className="text-xs">Skrifttype</Label>
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

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Overskrift</Label>
              <Select
                value={component.styles.titleFontSize || '36px'}
                onValueChange={(value) => onUpdate({ styles: { titleFontSize: value } })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fontSizePresets.heading.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>{preset.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Brødtekst</Label>
              <Select
                value={component.styles.bodyFontSize || '16px'}
                onValueChange={(value) => onUpdate({ styles: { bodyFontSize: value } })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fontSizePresets.body.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>{preset.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Vægt</Label>
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

          {/* Letter Spacing */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Bogstavafstand</Label>
              <span className="text-xs text-muted-foreground">{component.styles.letterSpacing || '0px'}</span>
            </div>
            <input
              type="range"
              min={-2}
              max={10}
              step={0.5}
              value={parseFloat(component.styles.letterSpacing || '0') || 0}
              onChange={(e) => onUpdate({ styles: { letterSpacing: `${e.target.value}px` } })}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* Line Height */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Linjehøjde</Label>
              <span className="text-xs text-muted-foreground">{component.styles.lineHeight || '1.6'}</span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={parseFloat(component.styles.lineHeight || '1.6') || 1.6}
              onChange={(e) => onUpdate({ styles: { lineHeight: e.target.value } })}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* Text Transform */}
          <div className="space-y-2">
            <Label className="text-xs">Teksttransform</Label>
            <div className="flex flex-wrap gap-1">
              {[
                { label: 'Normal', value: 'none' },
                { label: 'STORE', value: 'uppercase' },
                { label: 'små', value: 'lowercase' },
                { label: 'Start', value: 'capitalize' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`px-2 py-1 text-xs rounded border transition-all ${(component.styles.textTransform || 'none') === opt.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                  onClick={() => onUpdate({ styles: { textTransform: opt.value as any } })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        {/* Spacing Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            Afstand
          </h4>

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

          {/* Advanced 4-value spacing */}
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowAdvancedSpacing(!showAdvancedSpacing)}
          >
            {showAdvancedSpacing ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Avanceret afstand
          </button>

          {showAdvancedSpacing && (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Top (px)</Label>
                  <Input
                    type="number"
                    value={padding.top}
                    onChange={(e) => {
                      const v = e.target.value;
                      onUpdate({ styles: { padding: `${v}px ${padding.right}px ${padding.bottom}px ${padding.left}px` } });
                    }}
                    className="h-8 text-xs"
                    min={0}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Højre (px)</Label>
                  <Input
                    type="number"
                    value={padding.right}
                    onChange={(e) => {
                      const v = e.target.value;
                      onUpdate({ styles: { padding: `${padding.top}px ${v}px ${padding.bottom}px ${padding.left}px` } });
                    }}
                    className="h-8 text-xs"
                    min={0}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Bund (px)</Label>
                  <Input
                    type="number"
                    value={padding.bottom}
                    onChange={(e) => {
                      const v = e.target.value;
                      onUpdate({ styles: { padding: `${padding.top}px ${padding.right}px ${v}px ${padding.left}px` } });
                    }}
                    className="h-8 text-xs"
                    min={0}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Venstre (px)</Label>
                  <Input
                    type="number"
                    value={padding.left}
                    onChange={(e) => {
                      const v = e.target.value;
                      onUpdate({ styles: { padding: `${padding.top}px ${padding.right}px ${padding.bottom}px ${v}px` } });
                    }}
                    className="h-8 text-xs"
                    min={0}
                  />
                </div>
              </div>
              {/* Visual padding preview */}
              <div className="flex items-center justify-center py-2">
                <div className="relative w-24 h-20 border border-dashed border-muted-foreground/30 rounded">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="bg-primary/10 border border-primary/30 rounded-sm"
                      style={{
                        width: `${Math.max(20, 80 - parseInt(padding.left || '0') - parseInt(padding.right || '0'))}%`,
                        height: `${Math.max(20, 80 - parseInt(padding.top || '0') / 2 - parseInt(padding.bottom || '0') / 2)}%`,
                      }}
                    />
                  </div>
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground">{padding.top}</span>
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground">{padding.bottom}</span>
                  <span className="absolute left-0.5 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground">{padding.left}</span>
                  <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground">{padding.right}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Border & Radius Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Square className="h-3 w-3" />
            Kant & Afrunding
          </h4>

          <div className="space-y-2">
            <Label className="text-xs">Kantafrunding</Label>
            <div className="flex flex-wrap gap-1">
              {borderRadiusPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`px-2 py-1 text-xs rounded border transition-all ${component.styles.borderRadius === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                  onClick={() => onUpdate({ styles: { borderRadius: preset.value } })}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Kantstil</Label>
            <div className="flex flex-wrap gap-1">
              {[
                { label: 'Ingen', value: 'none' },
                { label: 'Solid', value: 'solid' },
                { label: 'Stiplet', value: 'dashed' },
                { label: 'Prikket', value: 'dotted' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`px-2 py-1 text-xs rounded border transition-all ${(component.styles.borderStyle || 'none') === opt.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                  onClick={() => onUpdate({ styles: { borderStyle: opt.value as any } })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {component.styles.borderStyle && component.styles.borderStyle !== 'none' && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">Kanttykkelse</Label>
                  <span className="text-xs text-muted-foreground">{component.styles.borderWidth || '1px'}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={1}
                  value={parseInt(component.styles.borderWidth || '1') || 1}
                  onChange={(e) => onUpdate({ styles: { borderWidth: `${e.target.value}px` } })}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Kantfarve</Label>
                <div className="flex gap-1">
                  <Input
                    type="color"
                    value={component.styles.borderColor || '#e5e7eb'}
                    onChange={(e) => onUpdate({ styles: { borderColor: e.target.value } })}
                    className="w-10 h-8 p-1 cursor-pointer"
                  />
                  <Input
                    value={component.styles.borderColor || ''}
                    onChange={(e) => onUpdate({ styles: { borderColor: e.target.value } })}
                    placeholder="#e5e7eb"
                    className="flex-1 h-8 text-xs"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* Shadow Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            Skygge
          </h4>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {shadowPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`px-2 py-1 text-xs rounded border transition-all ${component.styles.boxShadow === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                  onClick={() => onUpdate({ styles: { boxShadow: preset.value } })}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        {/* Background Gradient Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            Baggrundsgradient
          </h4>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {gradientPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`px-2 py-1 text-xs rounded border transition-all ${component.styles.backgroundGradient === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                  onClick={() => onUpdate({ styles: { backgroundGradient: preset.value } })}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            {component.styles.backgroundGradient && component.styles.backgroundGradient !== 'none' && (
              <div
                className="h-8 rounded-md border"
                style={{ background: component.styles.backgroundGradient }}
              />
            )}
          </div>
        </div>

        <Separator />

        {/* Button & Card Styles */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Circle className="h-3 w-3" />
            Knap & Kort
          </h4>

          <div className="space-y-2">
            <Label className="text-xs">Knapstil</Label>
            <div className="flex flex-wrap gap-1">
              {buttonStylePresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`px-2 py-1 text-xs rounded border transition-all ${component.styles.buttonStyle === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                  onClick={() => onUpdate({ styles: { buttonStyle: preset.value as any } })}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Knapfarve</Label>
            <div className="flex gap-1">
              <Input
                type="color"
                value={component.styles.buttonColor || component.styles.accentColor || '#3b82f6'}
                onChange={(e) => onUpdate({ styles: { buttonColor: e.target.value } })}
                className="w-10 h-8 p-1 cursor-pointer"
              />
              <Input
                value={component.styles.buttonColor || ''}
                onChange={(e) => onUpdate({ styles: { buttonColor: e.target.value } })}
                placeholder="Accent farve"
                className="flex-1 h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Kortstil</Label>
            <div className="flex flex-wrap gap-1">
              {cardStylePresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`px-2 py-1 text-xs rounded border transition-all ${component.styles.cardStyle === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                  onClick={() => onUpdate({ styles: { cardStyle: preset.value as any } })}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---- TAB: Animation ----
  const renderAnimationTab = () => (
    <div className="space-y-4">
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Indgangsanimation
        </h4>

        <div className="space-y-2">
          <Label className="text-xs">Type</Label>
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
          <Label className="text-xs">Trigger</Label>
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
          <Label className="text-xs">Varighed</Label>
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
          <Label className="text-xs">Forsinkelse</Label>
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

      {/* Animation preview hint */}
      {component.styles.animationType && component.styles.animationType !== 'none' && (
        <div className="p-3 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/20">
          <p className="text-xs text-muted-foreground">
            Animationen afspilles ved {component.styles.animationTrigger === 'scroll' ? 'scroll' : 'sideindlæsning'}.
          </p>
        </div>
      )}
    </div>
  );

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'content', label: 'Indhold', icon: <Type className="h-3.5 w-3.5" /> },
    { id: 'design', label: 'Design', icon: <Paintbrush className="h-3.5 w-3.5" /> },
    { id: 'animation', label: 'Animation', icon: <Sparkles className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">{definition.name}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove('up')} data-testid="button-move-up" title="Flyt op">
            <Move className="w-3.5 h-3.5 rotate-180" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove('down')} data-testid="button-move-down" title="Flyt ned">
            <Move className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} data-testid="button-delete" title="Slet">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'content' && renderContentTab()}
        {activeTab === 'design' && renderDesignTab()}
        {activeTab === 'animation' && renderAnimationTab()}
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
