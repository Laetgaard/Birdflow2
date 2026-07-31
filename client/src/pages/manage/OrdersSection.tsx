// Orders section of the manage dashboard. Moved out of the old monolithic
// manage.tsx and translated to Danish.
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Package, CheckCircle, XCircle } from "lucide-react";
import type { SectionProps, Order } from "./types";
import {
  formatCurrency,
  formatDateDa,
  authHeaders,
  jsonAuthHeaders,
  StatusBadge,
  LoadingState,
  EmptyState,
  ErrorState,
} from "./shared";

/** Long Danish date (with weekday) used in the order detail dialog. */
function formatLongDateDa(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return String(iso);
  return new Intl.DateTimeFormat('da-DK', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function OrdersSection({ websiteId, accessToken }: SectionProps) {
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!websiteId || !accessToken) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/websites/${websiteId}/orders`, {
        headers: authHeaders(accessToken),
      });
      if (!res.ok) throw new Error(`Kunne ikke hente ordrer (${res.status})`);
      setOrders(await res.json());
    } catch (error: any) {
      setLoadError(error.message || "Kunne ikke hente ordrer");
    } finally {
      setIsLoading(false);
    }
  }, [websiteId, accessToken]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    if (!accessToken || !websiteId) return;

    const previousOrders = [...orders];
    const previousSelectedOrder = selectedOrder;

    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    if (selectedOrder?.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }

    try {
      const res = await fetch(`/api/websites/${websiteId}/orders/${orderId}`, {
        method: 'PATCH',
        headers: jsonAuthHeaders(accessToken),
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        setOrders(previousOrders);
        if (previousSelectedOrder?.id === orderId) {
          setSelectedOrder(previousSelectedOrder);
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Kunne ikke opdatere ordren (${res.status})`);
      }

      toast({
        title: "Ordre opdateret",
        description: "Ordrens status er ændret.",
      });
    } catch (error: any) {
      setOrders(previousOrders);
      if (previousSelectedOrder?.id === orderId) {
        setSelectedOrder(previousSelectedOrder);
      }
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loadError) {
    return <ErrorState message={loadError} onRetry={fetchOrders} />;
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Ordrer</CardTitle>
          <CardDescription>Håndtér kundeordrer fra din hjemmeside</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState label="Indlæser ordrer..." />
          ) : orders.length === 0 ? (
            <EmptyState
              icon={<Package className="w-12 h-12" />}
              title="Ingen ordrer endnu"
              description="Ordrer vises her, når kunder køber noget på din hjemmeside."
            />
          ) : (
            <div className="space-y-3">
              {orders.map(order => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  data-testid={`order-${order.id}`}
                  onClick={() => { setSelectedOrder(order); setIsOrderDetailOpen(true); }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">{order.customerName}</p>
                      <span className="text-xs text-muted-foreground">#{order.id.slice(0, 8)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{order.customerEmail}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateDa(order.createdAt, true)}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2 ml-4">
                    <p className="font-semibold text-lg">
                      {formatCurrency(typeof order.total === 'number' ? order.total : parseFloat(order.total || '0'), order.currency || 'USD')}
                    </p>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {order.paymentStatus && (
                        <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                          order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                          order.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          order.paymentStatus === 'refunded' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {order.paymentStatus === 'paid' ? '✓ Betalt' :
                           order.paymentStatus === 'pending' ? '⏳ Afventer' :
                           order.paymentStatus === 'refunded' ? '↩ Refunderet' : 'Ubetalt'}
                        </span>
                      )}
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOrderDetailOpen} onOpenChange={setIsOrderDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ordredetaljer</DialogTitle>
            <DialogDescription>
              {selectedOrder && `Ordre #${selectedOrder.id.slice(0, 8)}`}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl ${
                  selectedOrder.status === 'pending' ? 'bg-yellow-500' :
                  selectedOrder.status === 'completed' || selectedOrder.status === 'confirmed' ? 'bg-green-500' :
                  selectedOrder.status === 'processing' ? 'bg-blue-500' : 'bg-red-500'
                }`}>
                  {selectedOrder.customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedOrder.customerName}</h3>
                  <p className="text-sm text-muted-foreground">{selectedOrder.customerEmail}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dato</span>
                  <span className="font-medium">
                    {formatLongDateDa(selectedOrder.createdAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">I alt</span>
                  <span className="font-medium text-lg">
                    {formatCurrency(typeof selectedOrder.total === 'number' ? selectedOrder.total : parseFloat(selectedOrder.total || '0'), selectedOrder.currency || 'USD')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Betalingsstatus</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    selectedOrder.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                    selectedOrder.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedOrder.paymentStatus === 'paid' ? '✓ Betalt' :
                     selectedOrder.paymentStatus === 'pending' ? '⏳ Afventer' : 'Ubetalt'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Ordrestatus</span>
                  <StatusBadge status={selectedOrder.status} />
                </div>
              </div>

              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Varer</h4>
                    <div className="space-y-2">
                      {selectedOrder.items.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm bg-muted/50 p-2 rounded">
                          <span>{item.name} × {item.quantity}</span>
                          <span className="font-medium">{formatCurrency(item.price * item.quantity, selectedOrder.currency || 'USD')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="flex gap-2 flex-wrap">
                {selectedOrder.status === 'pending' && (
                  <>
                    <Button
                      className="flex-1 bg-green-500 hover:bg-green-600"
                      onClick={() => {
                        handleUpdateOrderStatus(selectedOrder.id, 'completed');
                        setSelectedOrder({ ...selectedOrder, status: 'completed' });
                      }}
                      data-testid="btn-complete-order"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Markér som gennemført
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        handleUpdateOrderStatus(selectedOrder.id, 'cancelled');
                        setSelectedOrder({ ...selectedOrder, status: 'cancelled' });
                      }}
                      data-testid="btn-cancel-order"
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Annuller
                    </Button>
                  </>
                )}
                {selectedOrder.status === 'processing' && (
                  <>
                    <Button
                      className="flex-1 bg-green-500 hover:bg-green-600"
                      onClick={() => {
                        handleUpdateOrderStatus(selectedOrder.id, 'completed');
                        setSelectedOrder({ ...selectedOrder, status: 'completed' });
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Markér som gennemført
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        handleUpdateOrderStatus(selectedOrder.id, 'cancelled');
                        setSelectedOrder({ ...selectedOrder, status: 'cancelled' });
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Annuller
                    </Button>
                  </>
                )}
                {(selectedOrder.status === 'completed' || selectedOrder.status === 'confirmed') && (
                  <Badge className="bg-green-100 text-green-700 flex items-center gap-1 py-2 px-4">
                    <CheckCircle className="w-4 h-4" /> Ordre gennemført
                  </Badge>
                )}
                {selectedOrder.status === 'cancelled' && (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      handleUpdateOrderStatus(selectedOrder.id, 'pending');
                      setSelectedOrder({ ...selectedOrder, status: 'pending' });
                    }}
                  >
                    Genåbn ordre
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
