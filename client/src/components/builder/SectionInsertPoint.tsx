import { useState, useRef } from "react";
import { Plus, Layout, Star, MousePointerClick, ShoppingBag, Play, Columns } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ComponentType } from "@shared/componentRegistry";

interface SectionInsertPointProps {
  index: number;
  onAddComponent: (type: ComponentType, index: number) => void;
  activeInsertIndex: number | null;
  onActivate: (index: number | null) => void;
}

type SectionEntry = {
  type: ComponentType;
  label: string;
};

type CategoryDefinition = {
  key: string;
  label: string;
  icon: React.ReactNode;
  sections: SectionEntry[];
};

const categories: CategoryDefinition[] = [
  {
    key: "hero",
    label: "Hero",
    icon: <Layout className="h-3.5 w-3.5" />,
    sections: [
      { type: "hero", label: "Hero Sektion" },
    ],
  },
  {
    key: "content",
    label: "Indhold",
    icon: <Columns className="h-3.5 w-3.5" />,
    sections: [
      { type: "features", label: "Funktioner" },
      { type: "text-image", label: "Tekst & Billede" },
      { type: "gallery", label: "Galleri" },
      { type: "team", label: "Team" },
      { type: "timeline", label: "Tidslinje" },
      { type: "services", label: "Services" },
      { type: "rich-text", label: "Tekst" },
      { type: "tabs", label: "Faner" },
      { type: "split-section", label: "Split Sektion" },
    ],
  },
  {
    key: "social-proof",
    label: "Social Proof",
    icon: <Star className="h-3.5 w-3.5" />,
    sections: [
      { type: "testimonials", label: "Anmeldelser" },
      { type: "stats-counter", label: "Statistik" },
      { type: "logo-cloud", label: "Logo Bar" },
    ],
  },
  {
    key: "conversion",
    label: "Konvertering",
    icon: <MousePointerClick className="h-3.5 w-3.5" />,
    sections: [
      { type: "cta", label: "Call to Action" },
      { type: "pricing-table", label: "Priser" },
      { type: "contact-form", label: "Kontakt" },
      { type: "faq", label: "FAQ" },
      { type: "newsletter", label: "Nyhedsbrev" },
    ],
  },
  {
    key: "ecommerce",
    label: "E-handel",
    icon: <ShoppingBag className="h-3.5 w-3.5" />,
    sections: [
      { type: "product-grid", label: "Produkter" },
      { type: "booking", label: "Booking" },
    ],
  },
  {
    key: "media",
    label: "Medier",
    icon: <Play className="h-3.5 w-3.5" />,
    sections: [
      { type: "image-slider", label: "Billedkarrusel" },
      { type: "video-embed", label: "Video" },
      { type: "before-after", label: "For & Efter" },
    ],
  },
  {
    key: "layout",
    label: "Layout",
    icon: <Layout className="h-3.5 w-3.5" />,
    sections: [
      { type: "divider", label: "Divider" },
      { type: "spacer", label: "Mellemrum" },
      { type: "marquee", label: "Marquee" },
      { type: "container", label: "Container" },
      { type: "header", label: "Header" },
      { type: "footer", label: "Footer" },
    ],
  },
];

export default function SectionInsertPoint({ index, onAddComponent, activeInsertIndex, onActivate }: SectionInsertPointProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isVisible = activeInsertIndex === index || isOpen;

  const handleSelect = (type: ComponentType) => {
    onAddComponent(type, index);
    setIsOpen(false);
    onActivate(null);
  };

  const handleLineClick = () => {
    // Clicking the line area opens the popover via the trigger
    triggerRef.current?.click();
  };

  return (
    <div
      className="relative w-full"
      style={{ height: 0, zIndex: 20 }}
      onMouseEnter={() => onActivate(index)}
      onMouseLeave={() => {
        if (!isOpen) onActivate(null);
      }}
    >
      {/* Invisible hover/click target spanning across sections */}
      <div
        className="absolute left-0 right-0 cursor-pointer"
        style={{
          height: "20px",
          top: "-10px",
          display: "flex",
          alignItems: "center",
        }}
        onClick={handleLineClick}
      >
        <div
          style={{
            width: "100%",
            height: "2px",
            backgroundColor: "#3b82f6",
            opacity: isVisible ? 1 : 0,
            transition: "opacity 150ms ease",
          }}
        />
      </div>

      {/* Plus button centered on the line */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: "-12px",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 150ms ease",
          zIndex: 10,
        }}
      >
        <Popover
          open={isOpen}
          onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) onActivate(null);
          }}
        >
          <PopoverTrigger asChild>
            <button
              ref={triggerRef}
              className={cn(
                "flex items-center justify-center rounded-full border shadow-sm transition-colors duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                isOpen
                  ? "bg-blue-500 border-blue-500 text-white shadow-md"
                  : "bg-white border-blue-400 text-blue-500 hover:bg-blue-500 hover:text-white hover:shadow-md"
              )}
              style={{ width: "24px", height: "24px" }}
              aria-label="Tilf\u00F8j sektion"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </PopoverTrigger>

          <PopoverContent
            className="w-[340px] p-0"
            side="bottom"
            align="center"
            sideOffset={8}
          >
            <div className="px-3 py-2 border-b">
              <p className="text-sm font-medium text-foreground">Tilf\u00F8j sektion</p>
            </div>
            <ScrollArea className="h-[380px]">
              <div className="p-2 space-y-3">
                {categories.map((category) => (
                  <div key={category.key}>
                    <div className="flex items-center gap-1.5 px-2 py-1">
                      <span className="text-muted-foreground">{category.icon}</span>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {category.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {category.sections.map((section) => (
                        <button
                          key={section.type}
                          onClick={() => handleSelect(section.type)}
                          className={cn(
                            "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left w-full",
                            "text-sm text-foreground",
                            "hover:bg-accent hover:text-accent-foreground",
                            "transition-colors duration-100",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          )}
                        >
                          <Layout className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{section.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
