import { useState, useRef, useMemo, useEffect } from "react";
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
import CustomComponentEditor from "./CustomComponentEditor";
import { uploadImage } from "@/lib/builderUpload";
import type { DesignTokens } from "@shared/schema";
import {
  resolveDesignTokens,
  tokenPathOf,
  isTokenRef,
  tokenRef,
  type ResolvedTokens,
  type TokenPath,
} from "@shared/designTokens";

/** Danish labels for the brand roles a value can point at, shown in badges. */
const TOKEN_ROLE_LABELS: Record<string, string> = {
  'color.primary': 'Primærfarve',
  'color.secondary': 'Sekundærfarve',
  'color.accent': 'Accentfarve',
  'color.background': 'Baggrund',
  'color.surface': 'Kortflade',
  'color.text': 'Tekstfarve',
  'font.heading': 'Overskriftsskrift',
  'font.body': 'Brødtekstskrift',
};

function tokenRoleLabel(path: string): string {
  return TOKEN_ROLE_LABELS[path] ?? path;
}

/** Small "Brand" badge naming the role a value follows. */
function BrandBadge({ path, testId }: { path: string; testId?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium"
      data-testid={testId}
    >
      Brand · {tokenRoleLabel(path)}
    </span>
  );
}

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
  /** The website's design tokens, so the panel can show brand vs. override state. */
  globalStyles?: DesignTokens;
  /** Node selection inside custom components (primitive node trees). */
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  /** Item clicked on the canvas: scroll to and highlight its card. */
  focusItemIndex?: number | null;
  onFocusItemHandled?: () => void;
  /** Stored SVG illustrations by id (svg_assets) — for asset-backed svg nodes. */
  svgAssets?: Record<string, import("@shared/schema").SvgAsset>;
  /** Called after the editor stores a new illustration, so the map refreshes. */
  onSvgAssetsChanged?: () => void;
};

type TabId = 'content' | 'design' | 'animation';


export default function PropertiesPanel({ component, onUpdate, onDelete, onMove, websiteId, accessToken, globalStyles, selectedNodeId, onNodeSelect, focusItemIndex, onFocusItemHandled, svgAssets, onSvgAssetsChanged }: Props) {
  const definition = componentRegistry[component.type];
  const resolvedTokens = useMemo<ResolvedTokens>(() => resolveDesignTokens(globalStyles), [globalStyles]);
  const [activeTab, setActiveTab] = useState<TabId>('content');
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImage, setCropperImage] = useState<string>('');
  const [cropperField, setCropperField] = useState<{ field: FieldDefinition; index?: number } | null>(null);
  const [initialCrop, setInitialCrop] = useState<CropData | undefined>();
  const [showAdvancedSpacing, setShowAdvancedSpacing] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const focusItemCardRef = useRef<HTMLDivElement | null>(null);

  // An item clicked on the canvas: bring its card into view, hold the
  // highlight long enough to register, then release.
  useEffect(() => {
    if (focusItemIndex === null || focusItemIndex === undefined) return;
    setActiveTab('content');
    const raf = requestAnimationFrame(() => {
      focusItemCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    const timer = setTimeout(() => onFocusItemHandled?.(), 1600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusItemIndex, component.id]);

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

  /** The brand role a colour field with this key should reset to. */
  const colorRoleForKey = (key: string): TokenPath => {
    if (key === 'backgroundColor') return 'color.background';
    if (key === 'textColor') return 'color.text';
    if (key === 'buttonColor' || key === 'accentColor') return 'color.primary';
    return 'color.primary';
  };

  /**
   * Renders the shared brand/override affordance for a colour value: a "Brand"
   * badge when it follows the brand, or a "Tilpasset" hint plus a reset button
   * when it deliberately overrides one. Returns the resolved hex to preview.
   */
  const colorTokenState = (rawValue: string, role: TokenPath) => {
    const path = tokenPathOf(rawValue);
    if (path) {
      return {
        isToken: true as const,
        path,
        resolved: resolvedTokens[path] ?? rawValue,
      };
    }
    const brandValue = resolvedTokens[role];
    const literal = typeof rawValue === 'string' ? rawValue.trim() : '';
    const isCustom = !!literal && !!brandValue &&
      literal.toLowerCase() !== brandValue.trim().toLowerCase();
    return {
      isToken: false as const,
      path: null,
      resolved: rawValue,
      isCustom,
    };
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
        const role = colorRoleForKey(field.key);
        const state = colorTokenState(value, role);
        return (
          <div key={field.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs">{field.label}</Label>
              {state.isToken ? (
                <BrandBadge path={state.path} testId={`token-badge-${field.key}`} />
              ) : state.isCustom && (
                <span className="text-[10px] text-muted-foreground" data-testid={`custom-hint-${field.key}`}>Tilpasset</span>
              )}
              {!state.isToken && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] ml-auto"
                  onClick={() => setValue(field, tokenRef(role))}
                  data-testid={`reset-token-${field.key}`}
                >
                  Nulstil til brand
                </Button>
              )}
            </div>
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
                value={state.resolved || '#ffffff'}
                onChange={(e) => setValue(field, e.target.value)}
                className="w-10 h-9 p-1 cursor-pointer"
                data-testid={`color-${field.key}`}
              />
              <Input
                value={state.isToken ? tokenRoleLabel(state.path) : value}
                readOnly={state.isToken}
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
              <div
                key={item.id}
                ref={focusItemIndex === i ? focusItemCardRef : undefined}
                className={`border rounded-md p-2 space-y-2 bg-muted/50 ${focusItemIndex === i ? 'ring-2 ring-primary border-primary/60' : ''}`}
                data-testid={`item-card-${i}`}
              >
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

        const colorState = colorTokenState(styledValue.color || '', 'color.text');
        // Descriptions/body copy resolve to the body font; titles to the heading font.
        const fontRole: TokenPath = /description|body|text/i.test(field.key) ? 'font.body' : 'font.heading';
        const fontTokenPath = tokenPathOf(styledValue.fontFamily);

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
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground">Font</Label>
                  {fontTokenPath && (
                    <BrandBadge path={fontTokenPath} testId={`token-badge-${field.key}-font`} />
                  )}
                </div>
                <Select
                  value={fontTokenPath ? '__brand__' : (styledValue.fontFamily || 'inherit')}
                  onValueChange={(v) => setValue(field, {
                    ...styledValue,
                    fontFamily: v === 'inherit' ? '' : v === '__brand__' ? tokenRef(fontRole) : v,
                  })}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid={`select-font-${field.key}`}>
                    <SelectValue placeholder="Inherit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__brand__">Brand ({tokenRoleLabel(fontRole)})</SelectItem>
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
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-muted-foreground">Color</Label>
                {colorState.isToken ? (
                  <BrandBadge path={colorState.path} testId={`token-badge-${field.key}-color`} />
                ) : colorState.isCustom && (
                  <span className="text-[10px] text-muted-foreground" data-testid={`custom-hint-${field.key}-color`}>Tilpasset</span>
                )}
                {!colorState.isToken && styledValue.color && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] ml-auto"
                    onClick={() => setValue(field, { ...styledValue, color: tokenRef('color.text') })}
                    data-testid={`reset-token-${field.key}-color`}
                  >
                    Nulstil til brand
                  </Button>
                )}
              </div>
              <div className="flex gap-1">
                <Input
                  type="color"
                  value={colorState.resolved || '#000000'}
                  onChange={(e) => setValue(field, { ...styledValue, color: e.target.value })}
                  className="w-10 h-8 p-1 cursor-pointer"
                />
                <Input
                  value={colorState.isToken ? tokenRoleLabel(colorState.path) : (styledValue.color || '')}
                  readOnly={colorState.isToken}
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
            <div className="flex items-center gap-2">
              <Label className="text-xs">Skrifttype</Label>
              {(() => {
                const fontPath = tokenPathOf(component.styles.fontFamily);
                return fontPath ? <BrandBadge path={fontPath} testId="token-badge-fontFamily" /> : null;
              })()}
            </div>
            <Select
              value={tokenPathOf(component.styles.fontFamily) ? '__brand__' : (component.styles.fontFamily || 'Inter, system-ui, sans-serif')}
              onValueChange={(value) => onUpdate({ styles: { fontFamily: value === '__brand__' ? tokenRef('font.body') : value } })}
            >
              <SelectTrigger className="h-8" data-testid="select-font-family">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                <SelectItem value="__brand__">Brand ({tokenRoleLabel('font.body')})</SelectItem>
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
            <div className="flex items-center gap-2">
              <Label className="text-xs">Knapfarve</Label>
              {(() => {
                const btnState = colorTokenState(component.styles.buttonColor || '', 'color.primary');
                return btnState.isToken ? (
                  <BrandBadge path={btnState.path} testId="token-badge-buttonColor" />
                ) : btnState.isCustom ? (
                  <span className="text-[10px] text-muted-foreground" data-testid="custom-hint-buttonColor">Tilpasset</span>
                ) : null;
              })()}
              {!isTokenRef(component.styles.buttonColor) && component.styles.buttonColor && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px] ml-auto"
                  onClick={() => onUpdate({ styles: { buttonColor: tokenRef('color.primary') } })}
                  data-testid="reset-token-buttonColor"
                >
                  Nulstil til brand
                </Button>
              )}
            </div>
            <div className="flex gap-1">
              <Input
                type="color"
                value={colorTokenState(component.styles.buttonColor || component.styles.accentColor || '#3b82f6', 'color.primary').resolved || '#3b82f6'}
                onChange={(e) => onUpdate({ styles: { buttonColor: e.target.value } })}
                className="w-10 h-8 p-1 cursor-pointer"
              />
              <Input
                value={isTokenRef(component.styles.buttonColor) ? tokenRoleLabel(tokenPathOf(component.styles.buttonColor)!) : (component.styles.buttonColor || '')}
                readOnly={isTokenRef(component.styles.buttonColor)}
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
  const renderAnimationTab = () => {
    // When styles.motion is present (set directly or after the save-time migration
    // converts legacy animationType/* fields), the legacy fields may be absent.
    // Derive effective display values from styles.motion so the panel stays accurate
    // after migration and writes to BOTH paths so legacy-only stored components
    // also work until their next save upgrades them.
    const motionObj = component.styles.motion as Record<string, unknown> | undefined;

    // Effect and trigger share the same vocabulary in both systems.
    const effectiveEffect =
      (motionObj?.effect as string | undefined) ?? component.styles.animationType ?? 'none';
    const effectiveTrigger =
      (motionObj?.trigger as string | undefined) ?? component.styles.animationTrigger ?? 'load';

    // Duration / delay: motion uses named presets; legacy uses time strings.
    // Reverse-map for the button selected-state comparison.
    const MOTION_DUR_TO_LEGACY: Record<string, string> = {
      fast: '0.3s', normal: '0.5s', slow: '0.8s', 'very-slow': '1.2s',
    };
    const MOTION_DEL_TO_LEGACY: Record<string, string> = {
      short: '0.1s', medium: '0.3s', long: '0.5s',
    };
    const effectiveDuration =
      component.styles.animationDuration ??
      (motionObj?.duration ? MOTION_DUR_TO_LEGACY[motionObj.duration as string] : undefined);
    const effectiveDelay =
      component.styles.animationDelay ??
      (motionObj?.delay && motionObj.delay !== 'none'
        ? MOTION_DEL_TO_LEGACY[motionObj.delay as string]
        : '0s');

    // Build a combined update that writes to both legacy fields (for components not
    // yet migrated) and styles.motion (authoritative after the save-time migration).
    const LEGACY_DUR_TO_MOTION: Record<string, string> = {
      '0.3s': 'fast', '0.5s': 'normal', '0.8s': 'slow', '1.2s': 'very-slow',
    };
    const LEGACY_DEL_TO_MOTION: Record<string, string> = {
      '0s': 'none', '0.1s': 'short', '0.3s': 'medium', '0.5s': 'long',
    };
    const updateAnim = (patch: {
      effect?: string;
      trigger?: string;
      duration?: string;
      delay?: string;
    }) => {
      const newMotion: Record<string, unknown> = { ...(component.styles.motion ?? {}) };
      const legacyPatch: Record<string, unknown> = {};
      if ('effect' in patch) {
        legacyPatch.animationType = patch.effect;
        newMotion.effect = patch.effect;
      }
      if ('trigger' in patch) {
        legacyPatch.animationTrigger = patch.trigger;
        newMotion.trigger = patch.trigger;
      }
      if ('duration' in patch) {
        legacyPatch.animationDuration = patch.duration;
        newMotion.duration = patch.duration ? LEGACY_DUR_TO_MOTION[patch.duration] : undefined;
      }
      if ('delay' in patch) {
        legacyPatch.animationDelay = patch.delay;
        newMotion.delay = patch.delay ? LEGACY_DEL_TO_MOTION[patch.delay] : 'none';
      }
      onUpdate({ styles: { ...legacyPatch, motion: newMotion as any } });
    };

    return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Indgangsanimation
        </h4>

        <div className="space-y-2">
          <Label className="text-xs">Type</Label>
          <Select
            value={effectiveEffect}
            onValueChange={(value) => updateAnim({ effect: value })}
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
                className={`px-2 py-1 text-xs rounded border transition-all ${effectiveTrigger === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                onClick={() => updateAnim({ trigger: preset.value })}
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
                className={`px-2 py-1 text-xs rounded border transition-all ${effectiveDuration === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                onClick={() => updateAnim({ duration: preset.value })}
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
                className={`px-2 py-1 text-xs rounded border transition-all ${effectiveDelay === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                onClick={() => updateAnim({ delay: preset.value })}
                data-testid={`animation-delay-${preset.name.toLowerCase()}`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Newer controlled properties — stored as preset names in
            styles.motion and overlaid on the four legacy fields. */}
        <div className="space-y-2">
          <Label className="text-xs">Kurve</Label>
          <Select
            value={motionObj?.easing as string || 'soft'}
            onValueChange={(value) =>
              onUpdate({ styles: { motion: { ...(component.styles.motion ?? {}), easing: value as any } } })
            }
          >
            <SelectTrigger className="h-8" data-testid="select-animation-easing">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {animationPresets.easing.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Afstand</Label>
          <div className="flex flex-wrap gap-1">
            {animationPresets.distance.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`px-2 py-1 text-xs rounded border transition-all ${(motionObj?.distance as string || 'medium') === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                onClick={() =>
                  onUpdate({ styles: { motion: { ...(component.styles.motion ?? {}), distance: preset.value as any } } })
                }
                data-testid={`animation-distance-${preset.value}`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Gentagelse</Label>
          <div className="flex flex-wrap gap-1">
            {animationPresets.repeat.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`px-2 py-1 text-xs rounded border transition-all ${(motionObj?.repeat as string || 'once') === preset.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/80 border-transparent'}`}
                onClick={() =>
                  onUpdate({ styles: { motion: { ...(component.styles.motion ?? {}), repeat: preset.value as any } } })
                }
                data-testid={`animation-repeat-${preset.value}`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Animation preview hint — shows when any non-none effect is active */}
      {effectiveEffect && effectiveEffect !== 'none' && (
        <div className="p-3 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/20">
          <p className="text-xs text-muted-foreground">
            Animationen afspilles ved {effectiveTrigger === 'scroll' ? 'scroll' : 'sideindlæsning'}.
          </p>
        </div>
      )}
    </div>
    );
  };

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
        {activeTab === 'content' && (
          component.type === 'custom' ? (
            <CustomComponentEditor
              component={component}
              onUpdate={onUpdate}
              websiteId={websiteId}
              accessToken={accessToken}
              selectedNodeId={selectedNodeId}
              onNodeSelect={onNodeSelect}
              globalStyles={globalStyles}
              svgAssets={svgAssets}
              onSvgAssetsChanged={onSvgAssetsChanged}
            />
          ) : (
            renderContentTab()
          )
        )}
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
