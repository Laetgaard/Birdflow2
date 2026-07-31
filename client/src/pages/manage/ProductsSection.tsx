// Produkter-sektionen af manage-dashboardet: produktkatalog, varianter,
// lagerstyring, visningsindstillinger og anmeldelser.
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Plus, Pencil, Trash2, DollarSign, Image, XCircle,
  AlertCircle, LayoutGrid, Users, Star,
} from "lucide-react";
import type { SectionProps, Product, ProductVariant, ProductVariantOption, ProductReview } from "./types";
import {
  formatCurrency, formatDateDa, authHeaders, jsonAuthHeaders,
  ImageUploadButton, LoadingState, EmptyState, ErrorState,
} from "./shared";

/** Lokal type: kun brugt til produktgitterets visningsindstillinger. */
type ProductLayout = {
  columns: number;
  cardStyle: 'default' | 'minimal' | 'detailed';
  showDescription: boolean;
  showCategory: boolean;
  showInventory: boolean;
  imageAspect: 'video' | 'square' | 'portrait';
};

/** Lokal type: formularen til at tilføje/redigere en anmeldelse. */
type ReviewFormState = {
  name: string;
  rating: number;
  text: string;
  verified: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  draft: 'Kladde',
  archived: 'Arkiveret',
};

export function ProductsSection({ websiteId, accessToken }: SectionProps) {
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [productForm, setProductForm] = useState<Partial<Product>>({
    name: '',
    description: '',
    longDescription: '',
    productDetails: '',
    careInstructions: '',
    sizeGuide: '',
    shippingInfo: '',
    price: '',
    compareAtPrice: null,
    currency: 'USD',
    imageUrl: '',
    images: [],
    status: 'active',
    category: '',
    variants: [],
  });

  // Visningsindstillinger for produkter
  const [productLayout, setProductLayout] = useState<ProductLayout>({
    columns: 3,
    cardStyle: 'default',
    showDescription: true,
    showCategory: true,
    showInventory: true,
    imageAspect: 'video',
  });

  // Anmeldelser
  const [productReviews, setProductReviews] = useState<ProductReview[]>([]);
  const [selectedProductForReviews, setSelectedProductForReviews] = useState<Product | null>(null);
  const [isReviewsDialogOpen, setIsReviewsDialogOpen] = useState(false);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<ProductReview | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewFormState>({
    name: '',
    rating: 5,
    text: '',
    verified: false,
  });

  const fetchProducts = useCallback(async () => {
    if (!accessToken || !websiteId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/products`, {
        headers: authHeaders(accessToken),
      });
      if (!res.ok) throw new Error("Kunne ikke indlæse produkter");
      setProducts(await res.json());
    } catch (error: any) {
      setLoadError(error.message || "Kunne ikke indlæse produkter");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, websiteId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const resetProductForm = () => {
    setProductForm({
      name: '',
      description: '',
      longDescription: '',
      productDetails: '',
      careInstructions: '',
      sizeGuide: '',
      shippingInfo: '',
      price: '',
      compareAtPrice: null,
      currency: 'USD',
      imageUrl: '',
      images: [],
      status: 'active',
      category: '',
      stockQuantity: 0,
      trackInventory: false,
      variants: [],
    });
    setEditingProduct(null);
  };

  const openProductDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        description: product.description || '',
        longDescription: product.longDescription || '',
        productDetails: product.productDetails || '',
        careInstructions: product.careInstructions || '',
        sizeGuide: product.sizeGuide || '',
        shippingInfo: product.shippingInfo || '',
        price: product.price,
        compareAtPrice: product.compareAtPrice || null,
        currency: product.currency,
        imageUrl: product.imageUrl || '',
        images: product.images || [],
        status: product.status,
        category: product.category || '',
        stockQuantity: product.stockQuantity ?? 0,
        trackInventory: product.trackInventory ?? false,
        variants: product.variants || [],
      });
    } else {
      resetProductForm();
    }
    setIsProductDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!accessToken || !websiteId || !productForm.name) return;

    try {
      const url = editingProduct
        ? `/api/websites/${websiteId}/products/${editingProduct.id}`
        : `/api/websites/${websiteId}/products`;

      const method = editingProduct ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify(productForm),
      });

      if (!res.ok) throw new Error("Kunne ikke gemme produktet");

      const savedProduct = await res.json();

      if (editingProduct) {
        setProducts(products.map(p => p.id === savedProduct.id ? savedProduct : p));
      } else {
        setProducts([...products, savedProduct]);
      }

      toast({
        title: editingProduct ? "Produkt opdateret" : "Produkt oprettet",
        description: `${savedProduct.name} er blevet ${editingProduct ? 'opdateret' : 'tilføjet'}.`,
      });

      setIsProductDialogOpen(false);
      resetProductForm();
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!accessToken || !websiteId) return;

    try {
      const res = await fetch(`/api/websites/${websiteId}/products/${productId}`, {
        method: 'DELETE',
        headers: authHeaders(accessToken),
      });

      if (!res.ok) throw new Error("Kunne ikke slette produktet");

      setProducts(products.filter(p => p.id !== productId));

      toast({
        title: "Produkt slettet",
        description: "Produktet er blevet fjernet.",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Anmeldelses-handlers
  const fetchProductReviews = async (productId: string) => {
    if (!accessToken || !websiteId) return;
    try {
      const res = await fetch(`/api/websites/${websiteId}/products/${productId}/reviews`, {
        headers: authHeaders(accessToken),
      });
      if (!res.ok) throw new Error("Kunne ikke hente anmeldelser");
      const data = await res.json();
      setProductReviews(data);
    } catch (error) {
      setProductReviews([]);
    }
  };

  const openReviewsDialog = async (product: Product) => {
    setSelectedProductForReviews(product);
    await fetchProductReviews(product.id);
    setIsReviewsDialogOpen(true);
  };

  const resetReviewForm = () => {
    setReviewForm({ name: '', rating: 5, text: '', verified: false });
    setEditingReview(null);
  };

  const openReviewForm = (review?: ProductReview) => {
    if (review) {
      setEditingReview(review);
      setReviewForm({
        name: review.name,
        rating: review.rating,
        text: review.text || '',
        verified: review.verified,
      });
    } else {
      resetReviewForm();
    }
    setIsReviewFormOpen(true);
  };

  const handleSaveReview = async () => {
    if (!accessToken || !websiteId || !selectedProductForReviews || !reviewForm.name) return;

    try {
      const url = editingReview
        ? `/api/websites/${websiteId}/products/${selectedProductForReviews.id}/reviews/${editingReview.id}`
        : `/api/websites/${websiteId}/products/${selectedProductForReviews.id}/reviews`;

      const method = editingReview ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify(reviewForm),
      });

      if (!res.ok) throw new Error("Kunne ikke gemme anmeldelsen");

      await fetchProductReviews(selectedProductForReviews.id);
      setIsReviewFormOpen(false);
      resetReviewForm();

      toast({
        title: editingReview ? "Anmeldelse opdateret" : "Anmeldelse tilføjet",
        description: editingReview ? "Anmeldelsen er blevet opdateret." : "En ny anmeldelse er blevet tilføjet.",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!accessToken || !websiteId || !selectedProductForReviews) return;

    try {
      const res = await fetch(`/api/websites/${websiteId}/products/${selectedProductForReviews.id}/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: authHeaders(accessToken),
      });

      if (!res.ok) throw new Error("Kunne ikke slette anmeldelsen");

      setProductReviews(productReviews.filter(r => r.id !== reviewId));

      toast({
        title: "Anmeldelse slettet",
        description: "Anmeldelsen er blevet fjernet.",
      });
    } catch (error: any) {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchProducts} />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Produkter</CardTitle>
          <CardDescription>Administrer dit produktkatalog</CardDescription>
        </div>
        <Dialog open={isProductDialogOpen} onOpenChange={(open) => {
          setIsProductDialogOpen(open);
          if (!open) resetProductForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => openProductDialog()} data-testid="button-add-product">
              <Plus className="w-4 h-4 mr-2" />
              Tilføj produkt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Rediger produkt' : 'Tilføj nyt produkt'}</DialogTitle>
              <DialogDescription>
                {editingProduct ? 'Opdater produktets oplysninger' : 'Tilføj et nyt produkt til dit katalog'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Navn *</Label>
                <Input
                  id="name"
                  value={productForm.name || ''}
                  onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                  placeholder="Produktnavn"
                  data-testid="input-product-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Kort beskrivelse</Label>
                <Textarea
                  id="description"
                  value={productForm.description || ''}
                  onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                  placeholder="Kort produktbeskrivelse (vises på kortene)"
                  rows={2}
                  data-testid="input-product-description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longDescription">Fuld beskrivelse</Label>
                <Textarea
                  id="longDescription"
                  value={productForm.longDescription || ''}
                  onChange={(e) => setProductForm({...productForm, longDescription: e.target.value})}
                  placeholder="Detaljeret produktbeskrivelse (vises på produktsiden)"
                  rows={4}
                  data-testid="input-product-long-description"
                />
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">Foldeafsnit på produktsiden</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="productDetails">Produktdetaljer</Label>
                    <Textarea
                      id="productDetails"
                      value={productForm.productDetails || ''}
                      onChange={(e) => setProductForm({...productForm, productDetails: e.target.value})}
                      placeholder="Materiale: Premium bomuld&#10;Mål: 25 x 20 x 10 cm&#10;Vægt: 250 g"
                      rows={3}
                      data-testid="input-product-details"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="careInstructions">Vaskeanvisning</Label>
                    <Textarea
                      id="careInstructions"
                      value={productForm.careInstructions || ''}
                      onChange={(e) => setProductForm({...productForm, careInstructions: e.target.value})}
                      placeholder="Maskinvask koldt med lignende farver. Tørretumbles ved lav varme. Må ikke bleges."
                      rows={3}
                      data-testid="input-care-instructions"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sizeGuide">Størrelsesguide</Label>
                    <Textarea
                      id="sizeGuide"
                      value={productForm.sizeGuide || ''}
                      onChange={(e) => setProductForm({...productForm, sizeGuide: e.target.value})}
                      placeholder="S: 86-91 cm&#10;M: 96-101 cm&#10;L: 106-111 cm&#10;XL: 116-121 cm"
                      rows={3}
                      data-testid="input-size-guide"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shippingInfo">Forsendelse og retur</Label>
                    <Textarea
                      id="shippingInfo"
                      value={productForm.shippingInfo || ''}
                      onChange={(e) => setProductForm({...productForm, shippingInfo: e.target.value})}
                      placeholder="Gratis fragt ved køb over 350 kr. 30 dages returret. Nem ombytning."
                      rows={3}
                      data-testid="input-shipping-info"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Pris</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="price"
                      type="text"
                      inputMode="decimal"
                      className="pl-9"
                      placeholder="0.00"
                      value={productForm.price}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                          setProductForm({...productForm, price: val});
                        }
                      }}
                      data-testid="input-product-price"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compare_at_price">Førpris (original)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="compare_at_price"
                      type="text"
                      inputMode="decimal"
                      className="pl-9"
                      placeholder="Lad stå tom hvis varen ikke er på tilbud"
                      value={productForm.compareAtPrice || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                          setProductForm({...productForm, compareAtPrice: val || null});
                        }
                      }}
                      data-testid="input-product-compare-price"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Sæt den højere end prisen for at vise et "Tilbud"-mærke</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Valuta</Label>
                  <Select
                    value={productForm.currency || 'USD'}
                    onValueChange={(value) => setProductForm({...productForm, currency: value})}
                  >
                    <SelectTrigger data-testid="select-product-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="DKK">DKK (kr)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={productForm.status || 'active'}
                    onValueChange={(value) => setProductForm({...productForm, status: value as any})}
                  >
                    <SelectTrigger data-testid="select-product-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Aktiv</SelectItem>
                      <SelectItem value="draft">Kladde</SelectItem>
                      <SelectItem value="archived">Arkiveret</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Kategori</Label>
                  <Input
                    id="category"
                    value={productForm.category || ''}
                    onChange={(e) => setProductForm({...productForm, category: e.target.value})}
                    placeholder="f.eks. Elektronik"
                    data-testid="input-product-category"
                  />
                </div>
              </div>
              <div className="border-t pt-4 mt-2">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="trackInventory"
                    checked={productForm.trackInventory ?? false}
                    onChange={(e) => setProductForm({...productForm, trackInventory: e.target.checked})}
                    className="rounded"
                    data-testid="checkbox-track-inventory"
                  />
                  <Label htmlFor="trackInventory" className="font-normal">Spor lagerbeholdning for dette produkt</Label>
                </div>
                {productForm.trackInventory && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="stockQuantity">Antal på lager</Label>
                    <Input
                      id="stockQuantity"
                      type="number"
                      min="0"
                      value={productForm.stockQuantity ?? 0}
                      onChange={(e) => setProductForm({...productForm, stockQuantity: parseInt(e.target.value) || 0})}
                      data-testid="input-stock-quantity"
                    />
                    {(productForm.stockQuantity ?? 0) > 0 && (productForm.stockQuantity ?? 0) <= 5 && (
                      <p className="text-sm text-yellow-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Advarsel: lav lagerbeholdning
                      </p>
                    )}
                    {(productForm.stockQuantity ?? 0) === 0 && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Udsolgt
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Hovedbillede</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="imageUrl"
                      className="pl-9"
                      value={productForm.imageUrl || ''}
                      onChange={(e) => setProductForm({...productForm, imageUrl: e.target.value})}
                      placeholder="https://eksempel.dk/billede.jpg eller upload"
                      data-testid="input-product-image"
                    />
                  </div>
                  <ImageUploadButton
                    onUpload={(url) => setProductForm({...productForm, imageUrl: url})}
                    data-testid="button-upload-main-image"
                  />
                </div>
                {productForm.imageUrl && (
                  <div className="relative w-20 h-20 rounded border overflow-hidden">
                    <img src={productForm.imageUrl} alt="Forhåndsvisning" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setProductForm({...productForm, imageUrl: ''})}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                    >
                      <XCircle className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Flere billeder</Label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(productForm.images || []).filter(img => img).map((img, index) => (
                      <div key={index} className="relative w-16 h-16 rounded border overflow-hidden group">
                        <img src={img} alt={`Produkt ${index + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            const newImages = (productForm.images || []).filter((_, i) => i !== index);
                            setProductForm({...productForm, images: newImages});
                          }}
                          className="absolute top-0 right-0 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-remove-image-${index}`}
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Indsæt billed-URL..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const value = (e.target as HTMLInputElement).value.trim();
                          if (value) {
                            setProductForm({...productForm, images: [...(productForm.images || []), value]});
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                      data-testid="input-add-image-url"
                    />
                    <ImageUploadButton
                      onUpload={(url) => setProductForm({...productForm, images: [...(productForm.images || []), url]})}
                      data-testid="button-upload-additional-image"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Upload eller indsæt URL'er. Tryk Enter for at tilføje en URL.</p>
              </div>

              {/* Produktvarianter */}
              <div className="border-t pt-4 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <Label className="font-medium">Produktvarianter</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newVariant: ProductVariant = {
                        id: `var-${Date.now()}`,
                        name: '',
                        options: []
                      };
                      setProductForm({
                        ...productForm,
                        variants: [...(productForm.variants || []), newVariant]
                      });
                    }}
                    data-testid="button-add-variant"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Tilføj variant
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Tilføj varianter som Størrelse eller Farve med forskellige prisreguleringer.
                </p>

                {(productForm.variants || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-md bg-muted/30">
                    Ingen varianter tilføjet endnu. Klik på "Tilføj variant" for at oprette muligheder som Størrelse eller Farve.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {(productForm.variants || []).map((variant, variantIndex) => (
                      <div key={variant.id} className="border rounded-lg p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Variantnavn (f.eks. Størrelse, Farve)"
                            value={variant.name}
                            onChange={(e) => {
                              const updatedVariants = [...(productForm.variants || [])];
                              updatedVariants[variantIndex] = { ...variant, name: e.target.value };
                              setProductForm({ ...productForm, variants: updatedVariants });
                            }}
                            className="flex-1"
                            data-testid={`input-variant-name-${variantIndex}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updatedVariants = (productForm.variants || []).filter((_, i) => i !== variantIndex);
                              setProductForm({ ...productForm, variants: updatedVariants });
                            }}
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-remove-variant-${variantIndex}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="pl-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Muligheder</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newOption: ProductVariantOption = {
                                  id: `opt-${Date.now()}`,
                                  name: '',
                                  priceAdjustment: 0
                                };
                                const updatedVariants = [...(productForm.variants || [])];
                                updatedVariants[variantIndex] = {
                                  ...variant,
                                  options: [...variant.options, newOption]
                                };
                                setProductForm({ ...productForm, variants: updatedVariants });
                              }}
                              data-testid={`button-add-option-${variantIndex}`}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Tilføj mulighed
                            </Button>
                          </div>

                          {variant.options.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Ingen muligheder endnu</p>
                          ) : (
                            <div className="space-y-2">
                              {variant.options.map((option, optionIndex) => (
                                <div key={option.id} className="flex items-center gap-2">
                                  <Input
                                    placeholder="Mulighed (f.eks. Small, Rød)"
                                    value={option.name}
                                    onChange={(e) => {
                                      const updatedVariants = [...(productForm.variants || [])];
                                      const updatedOptions = [...variant.options];
                                      updatedOptions[optionIndex] = { ...option, name: e.target.value };
                                      updatedVariants[variantIndex] = { ...variant, options: updatedOptions };
                                      setProductForm({ ...productForm, variants: updatedVariants });
                                    }}
                                    className="flex-1"
                                    data-testid={`input-option-name-${variantIndex}-${optionIndex}`}
                                  />
                                  <div className="relative w-24">
                                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="+/-"
                                      value={option.priceAdjustment || ''}
                                      onChange={(e) => {
                                        const updatedVariants = [...(productForm.variants || [])];
                                        const updatedOptions = [...variant.options];
                                        updatedOptions[optionIndex] = {
                                          ...option,
                                          priceAdjustment: parseFloat(e.target.value) || 0
                                        };
                                        updatedVariants[variantIndex] = { ...variant, options: updatedOptions };
                                        setProductForm({ ...productForm, variants: updatedVariants });
                                      }}
                                      className="pl-6 text-sm"
                                      data-testid={`input-option-price-${variantIndex}-${optionIndex}`}
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updatedVariants = [...(productForm.variants || [])];
                                      const updatedOptions = variant.options.filter((_, i) => i !== optionIndex);
                                      updatedVariants[variantIndex] = { ...variant, options: updatedOptions };
                                      setProductForm({ ...productForm, variants: updatedVariants });
                                    }}
                                    className="text-muted-foreground hover:text-destructive p-1"
                                    data-testid={`button-remove-option-${variantIndex}-${optionIndex}`}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>Annuller</Button>
              <Button onClick={handleSaveProduct} disabled={!productForm.name} data-testid="button-save-product">
                {editingProduct ? 'Gem ændringer' : 'Tilføj produkt'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog til håndtering af anmeldelser */}
        <Dialog open={isReviewsDialogOpen} onOpenChange={(open) => {
          setIsReviewsDialogOpen(open);
          if (!open) {
            setSelectedProductForReviews(null);
            setProductReviews([]);
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Anmeldelser af {selectedProductForReviews?.name}</DialogTitle>
              <DialogDescription>
                Administrer kundeanmeldelser for dette produkt. Anmeldelserne vises på produktsiden.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{productReviews.length} {productReviews.length === 1 ? 'anmeldelse' : 'anmeldelser'}</span>
                <Button onClick={() => openReviewForm()} size="sm" data-testid="button-add-review">
                  <Plus className="w-4 h-4 mr-2" />
                  Tilføj anmeldelse
                </Button>
              </div>

              {productReviews.length === 0 ? (
                <EmptyState
                  icon={<Users className="w-10 h-10 opacity-50" />}
                  title="Ingen anmeldelser endnu"
                  description="Tilføj anmeldelser for at opbygge tillid hos potentielle kunder."
                />
              ) : (
                <div className="space-y-3">
                  {productReviews.map(review => (
                    <div key={review.id} className="border rounded-lg p-4" data-testid={`review-item-${review.id}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{review.name}</span>
                            {review.verified && (
                              <Badge className="bg-green-100 text-green-800 text-xs">Verificeret</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map(star => (
                              <span key={star} className={star <= review.rating ? 'text-yellow-500' : 'text-gray-300'}>★</span>
                            ))}
                            <span className="text-sm text-muted-foreground ml-2">
                              {formatDateDa(review.createdAt)}
                            </span>
                          </div>
                          {review.text && <p className="text-sm text-muted-foreground">{review.text}</p>}
                        </div>
                        <div className="flex gap-1 ml-4">
                          <Button variant="ghost" size="icon" onClick={() => openReviewForm(review)} data-testid={`button-edit-review-${review.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteReview(review.id)} data-testid={`button-delete-review-${review.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog til at tilføje/redigere en anmeldelse */}
        <Dialog open={isReviewFormOpen} onOpenChange={(open) => {
          setIsReviewFormOpen(open);
          if (!open) resetReviewForm();
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingReview ? 'Rediger anmeldelse' : 'Tilføj anmeldelse'}</DialogTitle>
              <DialogDescription>
                {editingReview ? 'Opdater anmeldelsens oplysninger.' : 'Tilføj en ny anmeldelse til dette produkt.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reviewer-name">Anmelderens navn</Label>
                <Input
                  id="reviewer-name"
                  value={reviewForm.name}
                  onChange={(e) => setReviewForm({...reviewForm, name: e.target.value})}
                  placeholder="f.eks. Jens D."
                  data-testid="input-reviewer-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Bedømmelse</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewForm({...reviewForm, rating: star})}
                      className={`text-2xl transition-colors ${star <= reviewForm.rating ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-300'}`}
                      data-testid={`button-rating-${star}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-text">Anmeldelsestekst (valgfri)</Label>
                <Textarea
                  id="review-text"
                  value={reviewForm.text}
                  onChange={(e) => setReviewForm({...reviewForm, text: e.target.value})}
                  placeholder="Hvad syntes kunden om produktet?"
                  data-testid="input-review-text"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="verified-purchase"
                  checked={reviewForm.verified}
                  onChange={(e) => setReviewForm({...reviewForm, verified: e.target.checked})}
                  data-testid="checkbox-verified"
                />
                <Label htmlFor="verified-purchase" className="cursor-pointer">Verificeret køb</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReviewFormOpen(false)}>Annuller</Button>
              <Button onClick={handleSaveReview} disabled={!reviewForm.name} data-testid="button-save-review">
                {editingReview ? 'Opdater anmeldelse' : 'Tilføj anmeldelse'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState label="Indlæser produkter..." />
        ) : (
          <>
            {/* Redigering af produktvisning */}
            {products.length > 0 && (
              <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-dashed">
                <div className="flex items-center gap-2 mb-3">
                  <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">Visningsindstillinger for produkter</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Kolonner i gitteret</Label>
                    <div className="flex gap-1">
                      {[2, 3, 4].map(cols => (
                        <Button
                          key={cols}
                          variant={productLayout.columns === cols ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 h-8"
                          onClick={() => setProductLayout({...productLayout, columns: cols})}
                        >
                          {cols}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Kortstil</Label>
                    <Select value={productLayout.cardStyle} onValueChange={(v: any) => setProductLayout({...productLayout, cardStyle: v})}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Standard</SelectItem>
                        <SelectItem value="minimal">Minimal</SelectItem>
                        <SelectItem value="detailed">Detaljeret</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Billedformat</Label>
                    <Select value={productLayout.imageAspect} onValueChange={(v: any) => setProductLayout({...productLayout, imageAspect: v})}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">16:9</SelectItem>
                        <SelectItem value="square">1:1 Kvadratisk</SelectItem>
                        <SelectItem value="portrait">3:4 Portræt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Vis elementer</Label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setProductLayout({...productLayout, showDescription: !productLayout.showDescription})}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${productLayout.showDescription ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input text-muted-foreground'}`}
                      >
                        Beskr.
                      </button>
                      <button
                        onClick={() => setProductLayout({...productLayout, showCategory: !productLayout.showCategory})}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${productLayout.showCategory ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input text-muted-foreground'}`}
                      >
                        Kategori
                      </button>
                      <button
                        onClick={() => setProductLayout({...productLayout, showInventory: !productLayout.showInventory})}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${productLayout.showInventory ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input text-muted-foreground'}`}
                      >
                        Lager
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {products.length === 0 ? (
              <EmptyState
                icon={
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                    <Package className="w-8 h-8 opacity-50" />
                  </div>
                }
                title="Ingen produkter endnu"
                description="Tilføj dit første produkt for at begynde at opbygge dit onlinekatalog. Produkterne vises på din udgivne hjemmeside."
                action={
                  <Button variant="outline" onClick={() => openProductDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Tilføj dit første produkt
                  </Button>
                }
              />
            ) : (
              <div className={`grid gap-4 ${
                productLayout.columns === 2 ? 'grid-cols-1 md:grid-cols-2' :
                productLayout.columns === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
                'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              }`}>
                {products.map(product => (
                  <div
                    key={product.id}
                    className={`border rounded-lg overflow-hidden group hover:shadow-md transition-all ${
                      productLayout.cardStyle === 'minimal' ? 'border-transparent hover:border-border' : ''
                    }`}
                    data-testid={`card-product-${product.id}`}
                  >
                    {/* Billede */}
                    <div className={`bg-muted relative overflow-hidden ${
                      productLayout.imageAspect === 'square' ? 'aspect-square' :
                      productLayout.imageAspect === 'portrait' ? 'aspect-[3/4]' :
                      'aspect-video'
                    }`}>
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-muted-foreground/30" />
                        </div>
                      )}
                      {product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price) && (
                        <Badge className="absolute top-2 left-2 bg-red-500 text-white text-[10px] px-1.5">Tilbud</Badge>
                      )}
                      <Badge
                        className={`absolute top-2 right-2 text-[10px] px-1.5 ${
                          product.status === 'active' ? 'bg-emerald-500 text-white' :
                          product.status === 'draft' ? 'bg-amber-500 text-white' :
                          'bg-gray-500 text-white'
                        }`}
                      >
                        {STATUS_LABELS[product.status] || product.status}
                      </Badge>
                    </div>

                    {/* Indhold */}
                    <div className={`${productLayout.cardStyle === 'minimal' ? 'p-3' : 'p-4'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className={`font-semibold truncate ${productLayout.cardStyle === 'minimal' ? 'text-sm' : ''}`}>{product.name}</h3>
                          {productLayout.showCategory && product.category && (
                            <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>
                          )}
                        </div>
                      </div>

                      {productLayout.showDescription && productLayout.cardStyle !== 'minimal' && product.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{product.description}</p>
                      )}

                      {productLayout.showInventory && product.trackInventory && (
                        <div className="mt-2 flex items-center gap-2">
                          {product.stockQuantity === 0 ? (
                            <Badge variant="destructive" className="text-[10px]">Udsolgt</Badge>
                          ) : (product.stockQuantity ?? 0) <= 5 ? (
                            <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-400">
                              Lavt lager: {product.stockQuantity}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              På lager: {product.stockQuantity}
                            </Badge>
                          )}
                        </div>
                      )}

                      {productLayout.cardStyle === 'detailed' && product.longDescription && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-3 border-t pt-2">{product.longDescription}</p>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <div className="flex items-center gap-1.5">
                          {product.compareAtPrice && parseFloat(product.compareAtPrice) > parseFloat(product.price) && (
                            <span className="text-xs text-muted-foreground line-through">{formatCurrency(parseFloat(product.compareAtPrice), product.currency)}</span>
                          )}
                          <span className="text-base font-bold">{formatCurrency(parseFloat(product.price), product.currency)}</span>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openReviewsDialog(product)} title="Anmeldelser" data-testid={`button-reviews-${product.id}`}>
                            <Star className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openProductDialog(product)} data-testid={`button-edit-${product.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteProduct(product.id)} data-testid={`button-delete-${product.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
