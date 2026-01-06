import { useState } from 'react';
import { useBuilderSelection } from '@/contexts/BuilderSelectionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { X, ChevronDown, ChevronRight, Home, Layers } from 'lucide-react';

const COMPONENT_LABELS: Record<string, string> = {
  'hero': 'Hero Section',
  'header': 'Header',
  'footer': 'Footer',
  'cta': 'Call to Action',
  'features': 'Features',
  'testimonials': 'Testimonials',
  'text-image': 'Text & Image',
  'image-slider': 'Image Slider',
  'product-grid': 'Products',
  'booking': 'Booking',
  'gallery': 'Gallery',
  'pricing-table': 'Pricing',
  'faq': 'FAQ',
  'stats-counter': 'Stats',
  'contact-form': 'Contact Form',
  'video-embed': 'Video',
  'divider': 'Divider',
  'spacer': 'Spacer',
};

type CollapsibleSectionProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  testId?: string;
};

function CollapsibleSection({ title, defaultOpen = true, children, testId }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button 
          className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded transition-colors"
          data-testid={testId}
        >
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </h4>
          {isOpen ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

type BreadcrumbProps = {
  pageName: string;
  componentType: string;
  onPageClick: () => void;
};

function Breadcrumb({ pageName, componentType, onPageClick }: BreadcrumbProps) {
  const componentLabel = COMPONENT_LABELS[componentType] || componentType;
  
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-hidden">
      <button 
        onClick={onPageClick}
        className="flex items-center gap-1 hover:text-foreground transition-colors shrink-0"
        data-testid="breadcrumb-page"
      >
        <Home className="h-3 w-3" />
        <span className="max-w-[60px] truncate">{pageName}</span>
      </button>
      <ChevronRight className="h-3 w-3 shrink-0" />
      <div className="flex items-center gap-1 text-foreground">
        <Layers className="h-3 w-3 shrink-0" />
        <span className="truncate">{componentLabel}</span>
      </div>
    </div>
  );
}

export default function InspectorSidebar() {
  const { 
    selectedId, 
    selectedInfo, 
    setSelectedId,
    onUpdateComponent,
    pages,
    activePage,
  } = useBuilderSelection();

  if (!selectedId || !selectedInfo) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-4 text-center">
        <div className="space-y-2">
          <Layers className="h-8 w-8 mx-auto opacity-50" />
          <p className="text-sm">Select an element to edit its properties</p>
        </div>
      </div>
    );
  }

  const component = selectedInfo.component;
  const definition = componentRegistry[component.type as ComponentType];
  const currentPage = pages?.find(p => p.id === activePage);
  const pageName = currentPage?.name || 'Page';

  const handlePropChange = (key: string, value: any) => {
    onUpdateComponent(selectedId, { props: { [key]: value } });
  };

  const handleStyleChange = (key: string, value: any) => {
    onUpdateComponent(selectedId, { styles: { [key]: value } });
  };

  const handleDeselectToPage = () => {
    setSelectedId(null);
  };

  return (
    <div className="h-full flex flex-col" data-testid="inspector-sidebar">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{definition?.name || component.type}</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 w-7 p-0"
            onClick={() => setSelectedId(null)}
            data-testid="inspector-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Breadcrumb 
          pageName={pageName} 
          componentType={component.type} 
          onPageClick={handleDeselectToPage}
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          <CollapsibleSection title="Layout" testId="section-layout">
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
          </CollapsibleSection>

          <CollapsibleSection title="Colors" testId="section-colors">
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
                      transition: 'transform 0.1s ease',
                    }}
                    className="hover:scale-110"
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
                      transition: 'transform 0.1s ease',
                    }}
                    className="hover:scale-110"
                    title={color.name}
                    data-testid={`inspector-text-${color.name.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Typography" defaultOpen={false} testId="section-typography">
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
          </CollapsibleSection>

          <CollapsibleSection title="Content" testId="section-content">
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
                  className="w-full h-20 px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
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

            {component.props.title === undefined && 
             component.props.subtitle === undefined && 
             component.props.description === undefined && 
             component.props.buttonText === undefined && (
              <p className="text-xs text-muted-foreground italic">
                No editable content properties for this component.
              </p>
            )}
          </CollapsibleSection>
        </div>
      </ScrollArea>
    </div>
  );
}
