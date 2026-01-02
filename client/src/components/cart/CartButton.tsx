import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cartContext';

export default function CartButton() {
  const { totalItems, setIsOpen } = useCart();

  return (
    <Button
      variant="outline"
      size="icon"
      className="relative"
      onClick={() => setIsOpen(true)}
      data-testid="cart-button"
    >
      <ShoppingCart className="h-5 w-5" />
      {totalItems > 0 && (
        <span 
          className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center"
          data-testid="cart-count"
        >
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </Button>
  );
}
