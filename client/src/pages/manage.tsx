import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, ArrowLeft, Loader2, Settings, User, LogOut,
  ShoppingCart, Calendar, Mail, Users, Palette,
  Package, Clock, CheckCircle, XCircle, AlertCircle,
  Plus, Pencil, Trash2, DollarSign, Image
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = amount.toFixed(currency === 'DKK' ? 0 : 2);
  return currency === 'DKK' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

type Website = {
  id: string;
  name: string;
  status: string;
  setupType: string;
  ownerId: string;
};

type Order = {
  id: string;
  customerName: string;
  customerEmail: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'confirmed';
  paymentStatus?: 'unpaid' | 'pending' | 'paid' | 'refunded';
  total: number;
  currency?: string;
  items?: Array<{ id: string; name: string; price: number; quantity: number }>;
  createdAt: string;
};

type Booking = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  service: string;
  serviceId?: string;
  date: string;
  time?: string;
  durationMinutes?: number;
  price?: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt?: string;
};

type FormSubmission = {
  id: string;
  formName: string;
  data: Record<string, any>;
  createdAt: string;
  read: boolean;
};

type Customer = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
};

type Product = {
  id: string;
  name: string;
  description?: string;
  longDescription?: string;
  price: string;
  currency: string;
  imageUrl?: string;
  images?: string[];
  status: 'active' | 'draft' | 'archived';
  inventory?: string;
  category?: string;
};

type BookingService = {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: string;
  currency: string;
  isActive: boolean;
};

export default function ManagePage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, profile, session, isLoading: authLoading, signOut } = useAuth();
  const { toast } = useToast();

  const [website, setWebsite] = useState<Website | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("orders");

  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [productForm, setProductForm] = useState<Partial<Product>>({
    name: '',
    description: '',
    longDescription: '',
    price: '0',
    currency: 'USD',
    imageUrl: '',
    images: [],
    status: 'active',
    category: '',
  });
  
  const [bookingServices, setBookingServices] = useState<BookingService[]>([]);
  const [editingService, setEditingService] = useState<BookingService | null>(null);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState<Partial<BookingService>>({
    name: '',
    description: '',
    durationMinutes: 60,
    price: '0',
    currency: 'USD',
    isActive: true,
  });
  
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [bookingSearch, setBookingSearch] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isBookingDetailOpen, setIsBookingDetailOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/auth");
    }
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    const fetchData = async () => {
      if (!session || !id) return;

      setIsLoading(true);
      try {
        const websiteRes = await fetch(`/api/websites/${id}`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });

        if (!websiteRes.ok) {
          if (websiteRes.status === 403 || websiteRes.status === 404) {
            toast({
              title: "Access Denied",
              description: "You don't have permission to access this website.",
              variant: "destructive",
            });
            setLocation("/dashboard");
            return;
          }
          throw new Error("Failed to load website");
        }

        const websiteData = await websiteRes.json();
        setWebsite(websiteData);

        const ordersRes = await fetch(`/api/websites/${id}/orders`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (ordersRes.ok) setOrders(await ordersRes.json());

        const bookingsRes = await fetch(`/api/websites/${id}/bookings`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (bookingsRes.ok) setBookings(await bookingsRes.json());

        const submissionsRes = await fetch(`/api/websites/${id}/submissions`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (submissionsRes.ok) setSubmissions(await submissionsRes.json());

        const customersRes = await fetch(`/api/websites/${id}/customers`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (customersRes.ok) setCustomers(await customersRes.json());

        const productsRes = await fetch(`/api/websites/${id}/products`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (productsRes.ok) setProducts(await productsRes.json());

        const servicesRes = await fetch(`/api/websites/${id}/booking-services`, {
          headers: { "Authorization": `Bearer ${session.access_token}` },
        });
        if (servicesRes.ok) setBookingServices(await servicesRes.json());

      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, session]);

  useEffect(() => {
    if (!id) return;

    const supabase = getSupabase();
    
    const channel = supabase
      .channel(`bookings-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `website_id=eq.${id}`,
        },
        (payload) => {
          const newBooking = payload.new as any;
          const formattedBooking: Booking = {
            id: newBooking.id,
            customerName: newBooking.customer_name,
            customerEmail: newBooking.customer_email,
            customerPhone: newBooking.customer_phone,
            service: newBooking.service,
            serviceId: newBooking.service_id,
            date: newBooking.date,
            time: newBooking.time,
            durationMinutes: newBooking.duration_minutes,
            price: newBooking.price,
            notes: newBooking.notes,
            status: newBooking.status,
            createdAt: newBooking.created_at,
          };
          
          setBookings((prev) => {
            if (prev.some(b => b.id === formattedBooking.id)) {
              return prev;
            }
            return [formattedBooking, ...prev];
          });
          
          toast({
            title: "New Booking!",
            description: `${formattedBooking.customerName} booked ${formattedBooking.service}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, toast]);

  const displayName = profile?.fullName || user?.user_metadata?.full_name || user?.email || "User";
  const displayEmail = profile?.email || user?.email || "";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />{status}</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />{status}</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800"><AlertCircle className="w-3 h-3 mr-1" />{status}</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const resetProductForm = () => {
    setProductForm({
      name: '',
      description: '',
      longDescription: '',
      price: '0',
      currency: 'USD',
      imageUrl: '',
      images: [],
      status: 'active',
      category: '',
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
        price: product.price,
        currency: product.currency,
        imageUrl: product.imageUrl || '',
        images: product.images || [],
        status: product.status,
        category: product.category || '',
      });
    } else {
      resetProductForm();
    }
    setIsProductDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!session || !id || !productForm.name) return;
    
    try {
      const url = editingProduct 
        ? `/api/websites/${id}/products/${editingProduct.id}`
        : `/api/websites/${id}/products`;
      
      const method = editingProduct ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productForm),
      });

      if (!res.ok) throw new Error("Failed to save product");

      const savedProduct = await res.json();
      
      if (editingProduct) {
        setProducts(products.map(p => p.id === savedProduct.id ? savedProduct : p));
      } else {
        setProducts([...products, savedProduct]);
      }
      
      toast({
        title: editingProduct ? "Product Updated" : "Product Created",
        description: `${savedProduct.name} has been ${editingProduct ? 'updated' : 'added'}.`,
      });
      
      setIsProductDialogOpen(false);
      resetProductForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!session || !id) return;
    
    try {
      const res = await fetch(`/api/websites/${id}/products/${productId}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error("Failed to delete product");
      
      setProducts(products.filter(p => p.id !== productId));
      
      toast({
        title: "Product Deleted",
        description: "The product has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetServiceForm = () => {
    setServiceForm({
      name: '',
      description: '',
      durationMinutes: 60,
      price: '0',
      currency: 'USD',
      isActive: true,
    });
    setEditingService(null);
  };

  const openServiceDialog = (service?: BookingService) => {
    if (service) {
      setEditingService(service);
      setServiceForm({
        name: service.name,
        description: service.description || '',
        durationMinutes: service.durationMinutes,
        price: service.price,
        currency: service.currency,
        isActive: service.isActive,
      });
    } else {
      resetServiceForm();
    }
    setIsServiceDialogOpen(true);
  };

  const handleSaveService = async () => {
    if (!session || !id || !serviceForm.name) return;
    
    try {
      const url = editingService 
        ? `/api/websites/${id}/booking-services/${editingService.id}`
        : `/api/websites/${id}/booking-services`;
      
      const method = editingService ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serviceForm),
      });

      if (!res.ok) throw new Error("Failed to save service");

      const savedService = await res.json();
      
      if (editingService) {
        setBookingServices(bookingServices.map(s => s.id === savedService.id ? savedService : s));
      } else {
        setBookingServices([...bookingServices, savedService]);
      }
      
      toast({
        title: editingService ? "Service Updated" : "Service Created",
        description: `${savedService.name} has been ${editingService ? 'updated' : 'added'}.`,
      });
      
      setIsServiceDialogOpen(false);
      resetServiceForm();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!session || !id) return;
    
    try {
      const res = await fetch(`/api/websites/${id}/booking-services/${serviceId}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete service (${res.status})`);
      }
      
      setBookingServices(bookingServices.filter(s => s.id !== serviceId));
      
      toast({
        title: "Service Deleted",
        description: "The booking service has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: Booking['status']) => {
    if (!session || !id) return;
    
    const previousBookings = [...bookings];
    const previousSelectedBooking = selectedBooking;
    
    setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
    if (selectedBooking?.id === bookingId) {
      setSelectedBooking({ ...selectedBooking, status: newStatus });
    }
    
    try {
      const res = await fetch(`/api/websites/${id}/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        setBookings(previousBookings);
        if (previousSelectedBooking?.id === bookingId) {
          setSelectedBooking(previousSelectedBooking);
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update booking (${res.status})`);
      }

      toast({
        title: "Booking Updated",
        description: `Booking status changed to ${newStatus}.`,
      });
    } catch (error: any) {
      setBookings(previousBookings);
      if (previousSelectedBooking?.id === bookingId) {
        setSelectedBooking(previousSelectedBooking);
      }
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!website) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card h-14 flex items-center px-4 gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground">
            <Globe className="w-4 h-4" />
          </div>
          <span className="font-medium" data-testid="text-website-name">{website.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${website.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {website.status}
          </span>
        </div>

        <div className="flex-1" />

        <Button variant="default" size="sm" onClick={() => setLocation(`/builder/${id}`)} data-testid="button-builder">
          <Palette className="w-4 h-4 mr-2" />
          Open Builder
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full" data-testid="button-profile-menu">
              <Avatar className="h-8 w-8">
                <AvatarImage src={`https://avatar.vercel.sh/${displayEmail}`} alt={displayName} />
                <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{displayEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLocation("/dashboard")}>
              <Globe className="mr-2 h-4 w-4" />
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Website Management</h1>
          <p className="text-muted-foreground">Manage orders, bookings, form submissions, and customers for {website.name}</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{orders.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{bookings.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Form Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{submissions.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{customers.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="orders" data-testid="tab-orders">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="bookings" data-testid="tab-bookings">
              <Calendar className="w-4 h-4 mr-2" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="submissions" data-testid="tab-submissions">
              <Mail className="w-4 h-4 mr-2" />
              Forms
            </TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers">
              <Users className="w-4 h-4 mr-2" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products">
              <Package className="w-4 h-4 mr-2" />
              Products
            </TabsTrigger>
            <TabsTrigger value="services" data-testid="tab-services">
              <Clock className="w-4 h-4 mr-2" />
              Services
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Orders</CardTitle>
                <CardDescription>Manage customer orders from your website</CardDescription>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No orders yet</p>
                    <p className="text-sm">Orders will appear here when customers make purchases on your website.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map(order => (
                      <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`order-${order.id}`}>
                        <div className="flex-1">
                          <p className="font-medium">{order.customerName}</p>
                          <p className="text-sm text-muted-foreground">{order.customerEmail}</p>
                          {order.items && order.items.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {order.items.map(item => `${item.name} x${item.quantity}`).join(', ')}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <p className="font-medium text-lg">${typeof order.total === 'number' ? order.total.toFixed(2) : parseFloat(order.total || '0').toFixed(2)}</p>
                          <div className="flex gap-2">
                            {order.paymentStatus && (
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                                order.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                order.paymentStatus === 'refunded' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {order.paymentStatus === 'paid' ? '✓ Paid' : 
                                 order.paymentStatus === 'pending' ? '⏳ Pending' :
                                 order.paymentStatus === 'refunded' ? '↩ Refunded' : 'Unpaid'}
                              </span>
                            )}
                            {getStatusBadge(order.status)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bookings">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>Bookings</CardTitle>
                    <CardDescription>Manage appointment and service bookings</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant={bookingFilter === 'all' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setBookingFilter('all')}
                      data-testid="filter-all"
                    >
                      All ({bookings.length})
                    </Button>
                    <Button 
                      variant={bookingFilter === 'pending' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setBookingFilter('pending')}
                      className={bookingFilter !== 'pending' ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50' : 'bg-yellow-500 hover:bg-yellow-600'}
                      data-testid="filter-pending"
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      Pending ({bookings.filter(b => b.status === 'pending').length})
                    </Button>
                    <Button 
                      variant={bookingFilter === 'confirmed' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setBookingFilter('confirmed')}
                      className={bookingFilter !== 'confirmed' ? 'border-green-300 text-green-700 hover:bg-green-50' : 'bg-green-500 hover:bg-green-600'}
                      data-testid="filter-confirmed"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Confirmed ({bookings.filter(b => b.status === 'confirmed').length})
                    </Button>
                    <Button 
                      variant={bookingFilter === 'cancelled' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setBookingFilter('cancelled')}
                      className={bookingFilter !== 'cancelled' ? 'border-red-300 text-red-700 hover:bg-red-50' : 'bg-red-500 hover:bg-red-600'}
                      data-testid="filter-cancelled"
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Cancelled ({bookings.filter(b => b.status === 'cancelled').length})
                    </Button>
                  </div>
                </div>
                <div className="mt-4">
                  <Input 
                    placeholder="Search by customer name, email, or service..." 
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    className="max-w-md"
                    data-testid="input-booking-search"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {bookings.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No bookings yet</p>
                    <p className="text-sm">Bookings will appear here when customers schedule appointments.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bookings
                      .filter(b => bookingFilter === 'all' || b.status === bookingFilter)
                      .filter(b => {
                        if (!bookingSearch) return true;
                        const search = bookingSearch.toLowerCase();
                        return b.customerName.toLowerCase().includes(search) ||
                               b.customerEmail.toLowerCase().includes(search) ||
                               b.service.toLowerCase().includes(search);
                      })
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(booking => {
                        const bookingDate = new Date(booking.date);
                        const isUpcoming = bookingDate > new Date();
                        const isToday = bookingDate.toDateString() === new Date().toDateString();
                        
                        return (
                          <div 
                            key={booking.id} 
                            className={`p-4 border rounded-xl transition-all hover:shadow-md cursor-pointer ${
                              booking.status === 'pending' ? 'border-l-4 border-l-yellow-400 bg-yellow-50/30' :
                              booking.status === 'confirmed' ? 'border-l-4 border-l-green-400 bg-green-50/30' :
                              'border-l-4 border-l-red-400 bg-red-50/30 opacity-75'
                            }`}
                            onClick={() => { setSelectedBooking(booking); setIsBookingDetailOpen(true); }}
                            data-testid={`booking-${booking.id}`}
                          >
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                                  booking.status === 'pending' ? 'bg-yellow-500' :
                                  booking.status === 'confirmed' ? 'bg-green-500' : 'bg-red-500'
                                }`}>
                                  {booking.customerName.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-lg">{booking.customerName}</p>
                                    {isToday && <Badge className="bg-blue-100 text-blue-700 text-xs">Today</Badge>}
                                    {!isToday && isUpcoming && booking.status !== 'cancelled' && (
                                      <Badge className="bg-purple-100 text-purple-700 text-xs">Upcoming</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{booking.customerEmail}</p>
                                  {booking.customerPhone && (
                                    <p className="text-sm text-muted-foreground">{booking.customerPhone}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="secondary" className="font-medium">{booking.service}</Badge>
                                    {booking.durationMinutes && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {booking.durationMinutes} min
                                      </span>
                                    )}
                                    {booking.price && (
                                      <span className="text-xs font-medium text-green-600">
                                        ${parseFloat(booking.price).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex flex-col md:items-end gap-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <Calendar className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    {bookingDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                  </span>
                                  <span className="text-muted-foreground">at</span>
                                  <span className="font-medium">
                                    {bookingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  {booking.status === 'pending' && (
                                    <>
                                      <Button 
                                        size="sm" 
                                        className="bg-green-500 hover:bg-green-600 text-white"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateBookingStatus(booking.id, 'confirmed');
                                        }}
                                        data-testid={`btn-confirm-${booking.id}`}
                                      >
                                        <CheckCircle className="w-4 h-4 mr-1" /> Confirm
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="border-red-300 text-red-600 hover:bg-red-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateBookingStatus(booking.id, 'cancelled');
                                        }}
                                        data-testid={`btn-cancel-${booking.id}`}
                                      >
                                        <XCircle className="w-4 h-4 mr-1" /> Cancel
                                      </Button>
                                    </>
                                  )}
                                  {booking.status === 'confirmed' && (
                                    <div className="flex items-center gap-2">
                                      <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> Confirmed
                                      </Badge>
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        className="text-red-600 hover:bg-red-50 h-7 text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateBookingStatus(booking.id, 'cancelled');
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  )}
                                  {booking.status === 'cancelled' && (
                                    <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
                                      <XCircle className="w-3 h-3" /> Cancelled
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {booking.notes && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-medium">Notes:</span> {booking.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    
                    {bookings.filter(b => bookingFilter === 'all' || b.status === bookingFilter).filter(b => {
                      if (!bookingSearch) return true;
                      const search = bookingSearch.toLowerCase();
                      return b.customerName.toLowerCase().includes(search) ||
                             b.customerEmail.toLowerCase().includes(search) ||
                             b.service.toLowerCase().includes(search);
                    }).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No bookings match your filters</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Dialog open={isBookingDetailOpen} onOpenChange={setIsBookingDetailOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Booking Details</DialogTitle>
                </DialogHeader>
                {selectedBooking && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl ${
                        selectedBooking.status === 'pending' ? 'bg-yellow-500' :
                        selectedBooking.status === 'confirmed' ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {selectedBooking.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{selectedBooking.customerName}</h3>
                        <p className="text-sm text-muted-foreground">{selectedBooking.customerEmail}</p>
                        {selectedBooking.customerPhone && (
                          <p className="text-sm text-muted-foreground">{selectedBooking.customerPhone}</p>
                        )}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="grid gap-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Service</span>
                        <span className="font-medium">{selectedBooking.service}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-medium">
                          {new Date(selectedBooking.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time</span>
                        <span className="font-medium">
                          {new Date(selectedBooking.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {selectedBooking.durationMinutes && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Duration</span>
                          <span className="font-medium">{selectedBooking.durationMinutes} minutes</span>
                        </div>
                      )}
                      {selectedBooking.price && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Price</span>
                          <span className="font-medium text-green-600">${parseFloat(selectedBooking.price).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge className={
                          selectedBooking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          selectedBooking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }>
                          {selectedBooking.status.charAt(0).toUpperCase() + selectedBooking.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    
                    {selectedBooking.notes && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Notes</p>
                          <p className="text-sm bg-muted p-3 rounded-lg">{selectedBooking.notes}</p>
                        </div>
                      </>
                    )}
                    
                    <Separator />
                    
                    <div className="flex gap-2">
                      {selectedBooking.status === 'pending' && (
                        <>
                          <Button 
                            className="flex-1 bg-green-500 hover:bg-green-600"
                            onClick={() => { 
                              handleUpdateBookingStatus(selectedBooking.id, 'confirmed');
                              setSelectedBooking({ ...selectedBooking, status: 'confirmed' });
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" /> Confirm Booking
                          </Button>
                          <Button 
                            variant="outline"
                            className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() => { 
                              handleUpdateBookingStatus(selectedBooking.id, 'cancelled');
                              setSelectedBooking({ ...selectedBooking, status: 'cancelled' });
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-2" /> Cancel
                          </Button>
                        </>
                      )}
                      {selectedBooking.status === 'confirmed' && (
                        <Button 
                          variant="outline"
                          className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => { 
                            handleUpdateBookingStatus(selectedBooking.id, 'cancelled');
                            setSelectedBooking({ ...selectedBooking, status: 'cancelled' });
                          }}
                        >
                          <XCircle className="w-4 h-4 mr-2" /> Cancel Booking
                        </Button>
                      )}
                      {selectedBooking.status === 'cancelled' && (
                        <Button 
                          className="flex-1"
                          onClick={() => { 
                            handleUpdateBookingStatus(selectedBooking.id, 'pending');
                            setSelectedBooking({ ...selectedBooking, status: 'pending' });
                          }}
                        >
                          Reopen Booking
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="submissions">
            <Card>
              <CardHeader>
                <CardTitle>Form Submissions</CardTitle>
                <CardDescription>View messages from contact forms and other submissions</CardDescription>
              </CardHeader>
              <CardContent>
                {submissions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No form submissions yet</p>
                    <p className="text-sm">Form submissions will appear here when visitors fill out forms on your website.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {submissions.map(submission => (
                      <div key={submission.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium">{submission.formName}</p>
                          <span className="text-sm text-muted-foreground">{new Date(submission.createdAt).toLocaleDateString()}</span>
                        </div>
                        <pre className="text-sm bg-muted p-2 rounded overflow-auto">{JSON.stringify(submission.data, null, 2)}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers">
            <Card>
              <CardHeader>
                <CardTitle>Customers</CardTitle>
                <CardDescription>View and manage your customer base</CardDescription>
              </CardHeader>
              <CardContent>
                {customers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No customers yet</p>
                    <p className="text-sm">Customer profiles will appear here as they interact with your website.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customers.map(customer => (
                      <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-sm text-muted-foreground">{customer.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${customer.totalSpent.toFixed(2)} spent</p>
                          <p className="text-sm text-muted-foreground">{customer.totalOrders} orders</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Products</CardTitle>
                  <CardDescription>Manage your product catalog</CardDescription>
                </div>
                <Dialog open={isProductDialogOpen} onOpenChange={(open) => {
                  setIsProductDialogOpen(open);
                  if (!open) resetProductForm();
                }}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openProductDialog()} data-testid="button-add-product">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                      <DialogDescription>
                        {editingProduct ? 'Update product details' : 'Add a new product to your catalog'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input 
                          id="name"
                          value={productForm.name || ''} 
                          onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                          placeholder="Product name"
                          data-testid="input-product-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Short Description</Label>
                        <Textarea 
                          id="description"
                          value={productForm.description || ''} 
                          onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                          placeholder="Brief product description (shown on cards)"
                          rows={2}
                          data-testid="input-product-description"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="longDescription">Full Description</Label>
                        <Textarea 
                          id="longDescription"
                          value={productForm.longDescription || ''} 
                          onChange={(e) => setProductForm({...productForm, longDescription: e.target.value})}
                          placeholder="Detailed product description (shown on product page)"
                          rows={4}
                          data-testid="input-product-long-description"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="price">Price</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                              id="price"
                              type="number"
                              step="0.01"
                              className="pl-9"
                              value={productForm.price || '0'} 
                              onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                              data-testid="input-product-price"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="currency">Currency</Label>
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
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="category">Category</Label>
                          <Input 
                            id="category"
                            value={productForm.category || ''} 
                            onChange={(e) => setProductForm({...productForm, category: e.target.value})}
                            placeholder="e.g., Electronics"
                            data-testid="input-product-category"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="imageUrl">Main Image URL</Label>
                        <div className="relative">
                          <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input 
                            id="imageUrl"
                            className="pl-9"
                            value={productForm.imageUrl || ''} 
                            onChange={(e) => setProductForm({...productForm, imageUrl: e.target.value})}
                            placeholder="https://example.com/image.jpg"
                            data-testid="input-product-image"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Additional Images</Label>
                        <div className="space-y-2">
                          {(productForm.images || []).map((img, index) => (
                            <div key={index} className="flex gap-2">
                              <Input 
                                value={img}
                                onChange={(e) => {
                                  const newImages = [...(productForm.images || [])];
                                  newImages[index] = e.target.value;
                                  setProductForm({...productForm, images: newImages});
                                }}
                                placeholder="https://example.com/image.jpg"
                                data-testid={`input-product-additional-image-${index}`}
                              />
                              <Button 
                                type="button"
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  const newImages = (productForm.images || []).filter((_, i) => i !== index);
                                  setProductForm({...productForm, images: newImages});
                                }}
                                data-testid={`button-remove-image-${index}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm"
                            onClick={() => setProductForm({...productForm, images: [...(productForm.images || []), '']})}
                            data-testid="button-add-image"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Image
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Add multiple product images for gallery display</p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveProduct} disabled={!productForm.name} data-testid="button-save-product">
                        {editingProduct ? 'Save Changes' : 'Add Product'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No products yet</p>
                    <p className="text-sm">Add products to your catalog to display them on your website.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map(product => (
                      <div key={product.id} className="border rounded-lg overflow-hidden" data-testid={`card-product-${product.id}`}>
                        {product.imageUrl && (
                          <div className="aspect-video bg-muted relative">
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        {!product.imageUrl && (
                          <div className="aspect-video bg-muted flex items-center justify-center">
                            <Package className="w-12 h-12 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-medium">{product.name}</h3>
                              {product.category && (
                                <p className="text-xs text-muted-foreground">{product.category}</p>
                              )}
                            </div>
                            <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                              {product.status}
                            </Badge>
                          </div>
                          {product.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{product.description}</p>
                          )}
                          <div className="flex items-center justify-between mt-4">
                            <span className="text-lg font-bold">{formatCurrency(parseFloat(product.price), product.currency)}</span>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openProductDialog(product)} data-testid={`button-edit-${product.id}`}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteProduct(product.id)} data-testid={`button-delete-${product.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Booking Services</CardTitle>
                  <CardDescription>Manage services available for booking</CardDescription>
                </div>
                <Dialog open={isServiceDialogOpen} onOpenChange={(open) => {
                  setIsServiceDialogOpen(open);
                  if (!open) resetServiceForm();
                }}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openServiceDialog()} data-testid="button-add-service">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Service
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingService ? 'Edit Service' : 'Add New Service'}</DialogTitle>
                      <DialogDescription>
                        {editingService ? 'Update the service details below.' : 'Enter the details for your new booking service.'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="serviceName">Name *</Label>
                        <Input 
                          id="serviceName"
                          value={serviceForm.name || ''} 
                          onChange={(e) => setServiceForm({...serviceForm, name: e.target.value})}
                          placeholder="Service name"
                          data-testid="input-service-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="serviceDescription">Description</Label>
                        <Textarea 
                          id="serviceDescription"
                          value={serviceForm.description || ''} 
                          onChange={(e) => setServiceForm({...serviceForm, description: e.target.value})}
                          placeholder="Service description"
                          data-testid="input-service-description"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="serviceDuration">Duration (minutes)</Label>
                        <Input 
                          id="serviceDuration"
                          type="number"
                          value={serviceForm.durationMinutes || 60} 
                          onChange={(e) => setServiceForm({...serviceForm, durationMinutes: parseInt(e.target.value) || 60})}
                          data-testid="input-service-duration"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="servicePrice">Price</Label>
                          <Input 
                            id="servicePrice"
                            type="number"
                            step="0.01"
                            value={serviceForm.price || '0'} 
                            onChange={(e) => setServiceForm({...serviceForm, price: e.target.value})}
                            data-testid="input-service-price"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="serviceCurrency">Currency</Label>
                          <select
                            id="serviceCurrency"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={serviceForm.currency || 'USD'}
                            onChange={(e) => setServiceForm({...serviceForm, currency: e.target.value})}
                            data-testid="select-service-currency"
                          >
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="DKK">DKK (kr)</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="serviceActive"
                          checked={serviceForm.isActive ?? true}
                          onChange={(e) => setServiceForm({...serviceForm, isActive: e.target.checked})}
                          className="rounded"
                          data-testid="checkbox-service-active"
                        />
                        <Label htmlFor="serviceActive">Service is active and available for booking</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsServiceDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleSaveService} disabled={!serviceForm.name} data-testid="button-save-service">
                        {editingService ? 'Save Changes' : 'Add Service'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {bookingServices.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No services yet</p>
                    <p className="text-sm">Add booking services that customers can schedule appointments for.</p>
                    <Button className="mt-4" onClick={() => openServiceDialog()}>
                      <Plus className="w-4 h-4 mr-2" /> Add Your First Service
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {bookingServices.map(service => (
                      <div 
                        key={service.id} 
                        className={`relative p-5 border rounded-xl transition-all hover:shadow-lg ${
                          service.isActive 
                            ? 'bg-gradient-to-br from-white to-green-50/30 border-green-200' 
                            : 'bg-gray-50 border-gray-200 opacity-75'
                        }`}
                        data-testid={`service-${service.id}`}
                      >
                        <div className="absolute top-3 right-3">
                          <Badge 
                            className={service.isActive 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-200 text-gray-600'
                            }
                          >
                            {service.isActive ? '✓ Active' : 'Inactive'}
                          </Badge>
                        </div>
                        
                        <div className="mb-4">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-3">
                            <Calendar className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="font-semibold text-lg">{service.name}</h3>
                          {service.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{service.description}</p>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between py-3 border-t border-dashed">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              <span>{service.durationMinutes} min</span>
                            </div>
                            <div className="text-lg font-bold text-green-600">
                              {formatCurrency(parseFloat(service.price), service.currency)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 mt-3">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => openServiceDialog(service)} 
                            data-testid={`button-edit-service-${service.id}`}
                          >
                            <Pencil className="w-3 h-3 mr-1" /> Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleDeleteService(service.id)} 
                            data-testid={`button-delete-service-${service.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    <div 
                      className="p-5 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition-colors min-h-[200px]"
                      onClick={() => openServiceDialog()}
                    >
                      <Plus className="w-8 h-8 mb-2" />
                      <span className="font-medium">Add New Service</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Website Settings</CardTitle>
                <CardDescription>Configure your website settings and preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Website Name</Label>
                    <Input value={website.name} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant={website.status === 'published' ? 'default' : 'secondary'}>
                        {website.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {website.status === 'draft' ? 'Your website is not yet published.' : 'Your website is live!'}
                      </span>
                    </div>
                  </div>
                  <Separator />
                  <div className="text-sm text-muted-foreground">
                    <p>More settings will be available here including:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Custom domain configuration</li>
                      <li>SEO settings</li>
                      <li>Analytics integration</li>
                      <li>Email notification preferences</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
