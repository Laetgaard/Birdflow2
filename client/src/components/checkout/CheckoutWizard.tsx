import { useState, useEffect } from 'react';
import { useCart } from '@/lib/cartContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Check, Loader2, Truck, CreditCard, User, AlertCircle, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';

type CheckoutStep = 'customer' | 'shipping' | 'review';

type ShippingOption = {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  deliveryTime?: string;
};

type CustomerInfo = {
  name: string;
  email: string;
  phone: string;
};

type ShippingAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

type CheckoutWizardProps = {
  websiteId: string;
  onClose?: () => void;
  onSuccess?: () => void;
};

function formatCurrency(cents: number, currency: string = 'USD'): string {
  const amount = cents / 100;
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

const STEPS: { key: CheckoutStep; label: string; icon: typeof User }[] = [
  { key: 'customer', label: 'Your Info', icon: User },
  { key: 'shipping', label: 'Shipping', icon: Truck },
  { key: 'review', label: 'Review', icon: CreditCard },
];

export default function CheckoutWizard({ websiteId, onClose, onSuccess }: CheckoutWizardProps) {
  const { items, totalAmount, currency, clearCart } = useCart();
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('customer');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outOfStock, setOutOfStock] = useState<Array<{ productId: string; name: string; requested: number; available: number }>>([]);

  const [customer, setCustomer] = useState<CustomerInfo>({ name: '', email: '', phone: '' });
  const [address, setAddress] = useState<ShippingAddress>({ street: '', city: '', state: '', zip: '', country: '' });
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null);
  const [validatedSubtotalCents, setValidatedSubtotalCents] = useState(0);

  const [customerErrors, setCustomerErrors] = useState<{ name?: string; email?: string }>({});

  const subtotalCents = Math.round(totalAmount * 100);
  const selectedShipping = shippingOptions.find(s => s.id === selectedShippingId);
  const shippingCostCents = selectedShipping?.priceCents || 0;
  const totalCents = subtotalCents + shippingCostCents;

  const validateCustomerStep = () => {
    const errors: { name?: string; email?: string } = {};
    if (!customer.name || customer.name.trim().length < 2) {
      errors.name = 'Name is required';
    }
    if (!customer.email || !customer.email.includes('@')) {
      errors.email = 'Valid email is required';
    }
    setCustomerErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = async () => {
    setError(null);
    setOutOfStock([]);

    if (currentStep === 'customer') {
      if (!validateCustomerStep()) return;
      
      setIsLoading(true);
      try {
        const res = await fetch(`/api/public/websites/${websiteId}/checkout/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map(item => ({ productId: item.id, quantity: item.quantity })),
            customerEmail: customer.email,
            customerName: customer.name,
            customerPhone: customer.phone,
            shippingAddress: address.street ? address : undefined,
          }),
        });

        const data = await res.json();
        if (!data.success) {
          if (data.outOfStock) {
            setOutOfStock(data.outOfStock);
          }
          setError(data.message || 'Validation failed');
          return;
        }

        setValidatedSubtotalCents(data.subtotalCents);

        const shippingRes = await fetch(`/api/public/websites/${websiteId}/checkout/shipping-options`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subtotalCents: data.subtotalCents, shippingAddress: address }),
        });

        const shippingData = await shippingRes.json();
        if (shippingData.success) {
          setShippingOptions(shippingData.shippingOptions || []);
          if (shippingData.shippingOptions?.length > 0 && !selectedShippingId) {
            setSelectedShippingId(shippingData.shippingOptions[0].id);
          }
        }

        setCurrentStep('shipping');
      } catch (err) {
        setError('Failed to validate cart. Please try again.');
      } finally {
        setIsLoading(false);
      }
    } else if (currentStep === 'shipping') {
      setCurrentStep('review');
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 'shipping') {
      setCurrentStep('customer');
    } else if (currentStep === 'review') {
      setCurrentStep('shipping');
    }
  };

  const handleConfirmOrder = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/public/websites/${websiteId}/checkout/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({ productId: item.id, quantity: item.quantity })),
          customerEmail: customer.email,
          customerName: customer.name,
          customerPhone: customer.phone,
          shippingAddress: address.street ? address : undefined,
          shippingMethodId: selectedShippingId,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        if (data.outOfStock) {
          setOutOfStock(data.outOfStock);
        }
        setError(data.message || 'Checkout failed');
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      setError('Failed to process checkout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((step, index) => (
          <div key={step.key} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              index < currentStepIndex 
                ? 'bg-green-500 text-white' 
                : index === currentStepIndex 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
            }`}>
              {index < currentStepIndex ? (
                <Check className="w-5 h-5" />
              ) : (
                <step.icon className="w-5 h-5" />
              )}
            </div>
            <span className={`ml-2 text-sm font-medium hidden sm:block ${
              index === currentStepIndex ? 'text-foreground' : 'text-muted-foreground'
            }`}>
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <div className={`w-8 sm:w-16 h-0.5 mx-2 ${
                index < currentStepIndex ? 'bg-green-500' : 'bg-muted'
              }`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-700 font-medium">{error}</p>
            {outOfStock.length > 0 && (
              <ul className="mt-2 text-sm text-red-600">
                {outOfStock.map(item => (
                  <li key={item.productId}>
                    {item.name}: requested {item.requested}, only {item.available} available
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentStep === 'customer' && <><User className="w-5 h-5" /> Your Information</>}
            {currentStep === 'shipping' && <><Truck className="w-5 h-5" /> Shipping Method</>}
            {currentStep === 'review' && <><ShoppingBag className="w-5 h-5" /> Order Review</>}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {currentStep === 'customer' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                    placeholder="John Doe"
                    className={customerErrors.name ? 'border-red-500' : ''}
                    data-testid="input-customer-name"
                  />
                  {customerErrors.name && <p className="text-sm text-red-500">{customerErrors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={customer.email}
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                    placeholder="you@example.com"
                    className={customerErrors.email ? 'border-red-500' : ''}
                    data-testid="input-customer-email"
                  />
                  {customerErrors.email && <p className="text-sm text-red-500">{customerErrors.email}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                  data-testid="input-customer-phone"
                />
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium mb-3">Shipping Address (optional)</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="street">Street Address</Label>
                    <Input
                      id="street"
                      value={address.street}
                      onChange={(e) => setAddress({ ...address, street: e.target.value })}
                      placeholder="123 Main St"
                      data-testid="input-address-street"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={address.city}
                        onChange={(e) => setAddress({ ...address, city: e.target.value })}
                        placeholder="New York"
                        data-testid="input-address-city"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State / Province</Label>
                      <Input
                        id="state"
                        value={address.state}
                        onChange={(e) => setAddress({ ...address, state: e.target.value })}
                        placeholder="NY"
                        data-testid="input-address-state"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="zip">ZIP / Postal Code</Label>
                      <Input
                        id="zip"
                        value={address.zip}
                        onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                        placeholder="10001"
                        data-testid="input-address-zip"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        value={address.country}
                        onChange={(e) => setAddress({ ...address, country: e.target.value })}
                        placeholder="United States"
                        data-testid="input-address-country"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'shipping' && (
            <div className="space-y-4">
              {shippingOptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No shipping options available.</p>
                  <p className="text-sm mt-1">You can still proceed with your order.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {shippingOptions.map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedShippingId === option.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      data-testid={`shipping-option-${option.id}`}
                    >
                      <input
                        type="radio"
                        name="shipping"
                        checked={selectedShippingId === option.id}
                        onChange={() => setSelectedShippingId(option.id)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <div>
                            <p className="font-medium">{option.name}</p>
                            {option.deliveryTime && (
                              <p className="text-sm text-muted-foreground">{option.deliveryTime}</p>
                            )}
                          </div>
                          <span className="font-medium">
                            {option.priceCents === 0 ? 'Free' : formatCurrency(option.priceCents, currency)}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 'review' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="font-medium">Order Summary</h3>
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-sm" data-testid={`review-item-${item.id}`}>
                    <span>{item.name} x {item.quantity}</span>
                    <span>{formatCurrency(Math.round(item.price * 100) * item.quantity, item.currency)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotalCents, currency)}</span>
                </div>
                {selectedShipping && (
                  <div className="flex justify-between text-sm">
                    <span>Shipping ({selectedShipping.name})</span>
                    <span>{shippingCostCents === 0 ? 'Free' : formatCurrency(shippingCostCents, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(totalCents, currency)}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <h3 className="font-medium">Customer Details</h3>
                <p className="text-sm text-muted-foreground">{customer.name}</p>
                <p className="text-sm text-muted-foreground">{customer.email}</p>
                {customer.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
                {address.street && (
                  <p className="text-sm text-muted-foreground">
                    {address.street}, {address.city}, {address.state} {address.zip}, {address.country}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between">
          {currentStep !== 'customer' ? (
            <Button variant="outline" onClick={handlePrevStep} disabled={isLoading} data-testid="button-back">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose} data-testid="button-cancel">
              Cancel
            </Button>
          )}

          {currentStep !== 'review' ? (
            <Button onClick={handleNextStep} disabled={isLoading} data-testid="button-continue">
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                <>Continue <ChevronRight className="w-4 h-4 ml-1" /></>
              )}
            </Button>
          ) : (
            <Button onClick={handleConfirmOrder} disabled={isLoading} data-testid="button-confirm-order">
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                <>Proceed to Payment <CreditCard className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
