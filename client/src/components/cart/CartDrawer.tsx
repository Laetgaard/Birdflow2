import { useCart, CartItem } from '@/lib/cartContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Minus, ShoppingBag, Trash2 } from 'lucide-react';
import { useState } from 'react';

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

function CartItemRow({ item, onUpdateQuantity, onRemove }: { 
  item: CartItem; 
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-4 py-4 border-b" data-testid={`cart-item-${item.id}`}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded-lg" />
      ) : (
        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">📦</div>
      )}
      <div className="flex-1">
        <h4 className="font-medium text-sm">{item.name}</h4>
        <p className="text-sm text-muted-foreground">{formatCurrency(item.price, item.currency)}</p>
        <div className="flex items-center gap-2 mt-2">
          <Button 
            size="icon" 
            variant="outline" 
            className="h-7 w-7"
            onClick={() => onUpdateQuantity(item.quantity - 1)}
            data-testid={`decrease-qty-${item.id}`}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-sm w-8 text-center">{item.quantity}</span>
          <Button 
            size="icon" 
            variant="outline" 
            className="h-7 w-7"
            onClick={() => onUpdateQuantity(item.quantity + 1)}
            data-testid={`increase-qty-${item.id}`}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-7 w-7 ml-auto text-red-500 hover:text-red-600"
            onClick={onRemove}
            data-testid={`remove-item-${item.id}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

type CartDrawerProps = {
  websiteId?: string;
  onCheckout?: () => void;
};

export default function CartDrawer({ websiteId, onCheckout }: CartDrawerProps) {
  const { items, isOpen, setIsOpen, updateQuantity, removeItem, totalAmount, totalItems, currency, clearCart } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [emailError, setEmailError] = useState('');
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleProceedToCheckout = () => {
    setShowCheckoutForm(true);
  };

  const handleCheckout = async () => {
    if (!websiteId || items.length === 0) return;
    
    if (!customerEmail) {
      setEmailError('Email is required');
      return;
    }
    
    if (!validateEmail(customerEmail)) {
      setEmailError('Please enter a valid email');
      return;
    }
    
    setEmailError('');
    setIsCheckingOut(true);
    
    try {
      const response = await fetch(`/api/public/websites/${websiteId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            productId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            currency: item.currency,
          })),
          customerEmail,
          customerName: customerName || customerEmail.split('@')[0],
          currency,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert(error.message || 'Failed to start checkout. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Your Cart ({totalItems})
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg">Your cart is empty</h3>
              <p className="text-muted-foreground text-sm mt-1">Add some products to get started</p>
            </div>
          ) : (
            <div>
              {items.map(item => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  onUpdateQuantity={(qty) => updateQuantity(item.id, qty)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <SheetFooter className="border-t pt-4">
            <div className="w-full space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-lg font-bold" data-testid="cart-total">
                  {formatCurrency(totalAmount, currency)}
                </span>
              </div>
              
              {showCheckoutForm ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="checkout-name">Name (optional)</Label>
                    <Input
                      id="checkout-name"
                      placeholder="Your name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      data-testid="input-checkout-name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="checkout-email">Email *</Label>
                    <Input
                      id="checkout-email"
                      type="email"
                      placeholder="your@email.com"
                      value={customerEmail}
                      onChange={(e) => {
                        setCustomerEmail(e.target.value);
                        setEmailError('');
                      }}
                      className={emailError ? 'border-red-500' : ''}
                      data-testid="input-checkout-email"
                    />
                    {emailError && <p className="text-sm text-red-500">{emailError}</p>}
                  </div>
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleCheckout}
                    disabled={isCheckingOut}
                    data-testid="checkout-button"
                  >
                    {isCheckingOut ? 'Processing...' : 'Pay Now'}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full"
                    onClick={() => setShowCheckoutForm(false)}
                  >
                    Back to Cart
                  </Button>
                </div>
              ) : (
                <>
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleProceedToCheckout}
                    data-testid="proceed-checkout-button"
                  >
                    Proceed to Checkout
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={clearCart}
                    data-testid="clear-cart-button"
                  >
                    Clear Cart
                  </Button>
                </>
              )}
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
