import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  themeColors, 
  spacingPresets, 
  fontSizePresets,
  fontFamilyPresets,
  fontWeightPresets,
  alignmentPresets,
  componentRegistry,
  type ComponentType 
} from '@shared/componentRegistry';
import { X } from 'lucide-react';

export default function InspectorSidebar() {
  const { 
    selectedId, 
    selectedInfo, 
    setSelectedId,
    onUpdateComponent,
  } = useBuilderSelection();

  if (!selectedId || !selectedInfo) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-4 text-center">
        <p>Select an element to edit its properties</p>
      </div>
    );
  }

  const component = selectedInfo.component;
  const definition = componentRegistry[component.type as ComponentType];

  const handlePropChange = (key: string, value: any) => {
    onUpdateComponent(selectedId, { props: { [key]: value } });
  };

  const handleStyleChange = (key: string, value: any) => {
    onUpdateComponent(selectedId, { styles: { [key]: value } });
  };

  return (
    <div className="h-full flex flex-col" data-testid="inspector-sidebar">
      <div className="flex items-center justify-between p-3 border-b">
        <div>
          <h3 className="font-semibold text-sm capitalize">{component.type.replace('-', ' ')}</h3>
          <p className="text-xs text-muted-foreground">{definition?.name || component.type}</p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0"
          onClick={() => setSelectedId(null)}
          data-testid="inspector-close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Layout</h4>
            
            <div className="space-y-2">
              <Label className="text-xs">Alignment</Label>
              <div className="flex gap-1">
                {alignmentPresets.map(preset => (
                  <Button
                    key={preset.value}
                    variant={component.props.alignment === preset.value ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 h-8"
                    onClick={() => handlePropChange('alignment', preset.value)}
                    data-testid={`inspector-align-${preset.value}`}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Padding</Label>
              <div className="grid grid-cols-2 gap-1">
                {spacingPresets.padding.map(preset => (
                  <Button
                    key={preset.value}
                    variant={component.styles.padding === preset.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => handleStyleChange('padding', preset.value)}
                    data-testid={`inspector-padding-${preset.name.toLowerCase()}`}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colors</h4>
            
            <div className="space-y-2">
              <Label className="text-xs">Background</Label>
              <div className="grid grid-cols-5 gap-1">
                {themeColors.backgrounds.map(color => (
                  <button
                    key={color.value}
                    onClick={() => handleStyleChange('backgroundColor', color.value)}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: '4px',
                      backgroundColor: color.value,
                      border: component.styles.backgroundColor === color.value 
                        ? '2px solid #3b82f6' 
                        : '1px solid #e2e8f0',
                      cursor: 'pointer',
                    }}
                    title={color.name}
                    data-testid={`inspector-bg-${color.name.toLowerCase().replace(' ', '-')}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Text Color</Label>
              <div className="grid grid-cols-6 gap-1">
                {themeColors.text.map(color => (
                  <button
                    key={color.value}
                    onClick={() => handleStyleChange('textColor', color.value)}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: '4px',
                      backgroundColor: color.value,
                      border: component.styles.textColor === color.value 
                        ? '2px solid #3b82f6' 
                        : '1px solid #e2e8f0',
                      cursor: 'pointer',
                    }}
                    title={color.name}
                    data-testid={`inspector-text-${color.name.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Typography</h4>
            
            <div className="space-y-2">
              <Label className="text-xs">Font Family</Label>
              <div className="space-y-1">
                {fontFamilyPresets.map(preset => (
                  <Button
                    key={preset.value}
                    variant={component.styles.fontFamily === preset.value ? 'default' : 'outline'}
                    size="sm"
                    className="w-full h-8 justify-start text-xs"
                    style={{ fontFamily: preset.value }}
                    onClick={() => handleStyleChange('fontFamily', preset.value)}
                    data-testid={`inspector-font-${preset.name.toLowerCase()}`}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Heading Size</Label>
              <div className="grid grid-cols-2 gap-1">
                {fontSizePresets.heading.map(preset => (
                  <Button
                    key={preset.value}
                    variant={component.styles.titleFontSize === preset.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => handleStyleChange('titleFontSize', preset.value)}
                    data-testid={`inspector-heading-${preset.name.toLowerCase()}`}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Body Size</Label>
              <div className="grid grid-cols-2 gap-1">
                {fontSizePresets.body.map(preset => (
                  <Button
                    key={preset.value}
                    variant={component.styles.bodyFontSize === preset.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => handleStyleChange('bodyFontSize', preset.value)}
                    data-testid={`inspector-body-${preset.name.toLowerCase()}`}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Font Weight</Label>
              <div className="grid grid-cols-3 gap-1">
                {fontWeightPresets.map(preset => (
                  <Button
                    key={preset.value}
                    variant={component.styles.fontWeight === preset.value ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs"
                    style={{ fontWeight: parseInt(preset.value) }}
                    onClick={() => handleStyleChange('fontWeight', preset.value)}
                    data-testid={`inspector-weight-${preset.name.toLowerCase()}`}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</h4>
            
            {component.props.title !== undefined && (
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input
                  value={component.props.title || ''}
                  onChange={(e) => handlePropChange('title', e.target.value)}
                  className="h-8 text-sm"
                  data-testid="inspector-title"
                />
              </div>
            )}

            {component.props.subtitle !== undefined && (
              <div className="space-y-1">
                <Label className="text-xs">Subtitle</Label>
                <Input
                  value={component.props.subtitle || ''}
                  onChange={(e) => handlePropChange('subtitle', e.target.value)}
                  className="h-8 text-sm"
                  data-testid="inspector-subtitle"
                />
              </div>
            )}

            {component.props.description !== undefined && (
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <textarea
                  value={component.props.description || ''}
                  onChange={(e) => handlePropChange('description', e.target.value)}
                  className="w-full h-20 px-3 py-2 text-sm border rounded-md resize-none"
                  data-testid="inspector-description"
                />
              </div>
            )}

            {component.props.buttonText !== undefined && (
              <div className="space-y-1">
                <Label className="text-xs">Button Text</Label>
                <Input
                  value={component.props.buttonText || ''}
                  onChange={(e) => handlePropChange('buttonText', e.target.value)}
                  className="h-8 text-sm"
                  data-testid="inspector-button-text"
                />
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
