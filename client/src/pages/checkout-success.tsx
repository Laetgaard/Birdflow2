import { useEffect, useState } from 'react';
import { Link, useSearch } from 'wouter';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CheckoutSuccessPage() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const sessionId = params.get('session_id');
  const websiteId = params.get('website');
  const [orderDetails, setOrderDetails] = useState<any>(null);

  useEffect(() => {
    if (sessionId && websiteId) {
      localStorage.removeItem(`saasify_cart_${websiteId}`);
    }
  }, [sessionId, websiteId]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
      <div style={{ textAlign: 'center', maxWidth: '500px', padding: '40px' }}>
        <div style={{ 
          width: '80px', 
          height: '80px', 
          borderRadius: '50%', 
          backgroundColor: '#dcfce7', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 24px' 
        }}>
          <CheckCircle style={{ width: '48px', height: '48px', color: '#22c55e' }} />
        </div>
        
        <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#111827', marginBottom: '16px' }} data-testid="success-title">
          Payment Successful!
        </h1>
        
        <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '32px', lineHeight: 1.6 }} data-testid="success-message">
          Thank you for your purchase. You will receive an email confirmation shortly with your order details.
        </p>
        
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <Link href="/">
            <Button size="lg" data-testid="continue-shopping-button">
              Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
