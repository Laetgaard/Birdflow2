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
import { Trash2, Plus, Move, GripVertical } from "lucide-react";
import { 
  componentRegistry, 
  type BuilderComponentData, 
  type ComponentProps, 
  type ComponentStyles,
  type FieldDefinition,
  type ComponentItem 
} from "@shared/componentRegistry";

type Props = {
  component: BuilderComponentData;
  onUpdate: (updates: { props?: Partial<ComponentProps>; styles?: Partial<ComponentStyles> }) => void;
  onDelete: () => void;
  onMove: (direction: 'up' | 'down') => void;
};

export default function PropertiesPanel({ component, onUpdate, onDelete, onMove }: Props) {
  const definition = componentRegistry[component.type];
  
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

      case 'color':
        return (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
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

      case 'image':
        return (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
            <Input
              value={value}
              onChange={(e) => setValue(field, e.target.value)}
              placeholder="https://..."
              data-testid={`input-${field.key}`}
            />
            {value && (
              <img src={value} alt="Preview" className="w-full h-24 object-cover rounded-md mt-1" />
            )}
          </div>
        );

      case 'image-array':
        const images = (value as string[]) || [];
        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-xs">{field.label}</Label>
            {images.map((img, i) => (
              <div key={i} className="flex gap-1">
                <Input
                  value={img}
                  onChange={(e) => {
                    const newImages = [...images];
                    newImages[i] = e.target.value;
                    setValue(field, newImages);
                  }}
                  placeholder="Image URL"
                  className="flex-1"
                />
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
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setValue(field, [...images, ''])}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Image
            </Button>
          </div>
        );

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
    </div>
  );
}
