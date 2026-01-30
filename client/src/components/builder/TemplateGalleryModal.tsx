import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { websiteTemplates, type WebsiteTemplate } from "@shared/websiteTemplates";
import { Layers, ShoppingBag, Calendar, FileText, Check } from "lucide-react";

const categoryIcons: Record<string, React.ElementType> = {
  ecommerce: ShoppingBag,
  services: Calendar,
  business: Layers,
  landing: FileText,
  portfolio: Layers,
  blog: FileText,
};

const categoryLabels: Record<string, string> = {
  ecommerce: "Webshop",
  services: "Services",
  business: "Erhverv",
  landing: "Landing Page",
  portfolio: "Portfolio",
  blog: "Blog",
};

interface TemplateGalleryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: WebsiteTemplate) => void;
  currentTemplateName?: string;
}

export default function TemplateGalleryModal({
  open,
  onOpenChange,
  onSelectTemplate,
  currentTemplateName,
}: TemplateGalleryModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<WebsiteTemplate | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const filteredTemplates = websiteTemplates.filter(t => t.id !== 'blank');

  const handleTemplateClick = (template: WebsiteTemplate) => {
    setSelectedTemplate(template);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate);
      setConfirmOpen(false);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">Vælg Skabelon</DialogTitle>
            <DialogDescription>
              Vælg en professionel skabelon til din hjemmeside. Dette vil erstatte dit nuværende indhold.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => {
                const CategoryIcon = categoryIcons[template.category] || Layers;
                const isCurrentTemplate = template.name === currentTemplateName;
                
                return (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateClick(template)}
                    className={`group relative rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg hover:border-primary/50 text-left ${
                      isCurrentTemplate ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                    data-testid={`template-${template.id}`}
                  >
                    <div className="aspect-video relative overflow-hidden bg-muted">
                      <img
                        src={template.thumbnail}
                        alt={template.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      {isCurrentTemplate && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Aktiv
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>
                    
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-base">{template.name}</h3>
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          <CategoryIcon className="w-3 h-3 mr-1" />
                          {categoryLabels[template.category] || template.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                      <div className="mt-3 text-xs text-muted-foreground">
                        {template.builderState.pages.length} {template.builderState.pages.length === 1 ? 'side' : 'sider'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anvend skabelon?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil erstatte alt dit nuværende indhold med skabelonen "{selectedTemplate?.name}". 
              Denne handling kan ikke fortrydes. Er du sikker på, at du vil fortsætte?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Anvend Skabelon
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
