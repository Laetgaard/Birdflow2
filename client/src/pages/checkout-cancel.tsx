import { Link } from 'wouter';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CheckoutCancelPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
      <div style={{ textAlign: 'center', maxWidth: '500px', padding: '40px' }}>
        <div style={{ 
          width: '80px', 
          height: '80px', 
          borderRadius: '50%', 
          backgroundColor: '#fee2e2', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 24px' 
        }}>
          <XCircle style={{ width: '48px', height: '48px', color: '#ef4444' }} />
        </div>
        
        <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#111827', marginBottom: '16px' }} data-testid="cancel-title">
          Payment Cancelled
        </h1>
        
        <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '32px', lineHeight: 1.6 }} data-testid="cancel-message">
          Your payment was cancelled. No charges were made. Your cart items are still saved if you'd like to try again.
        </p>
        
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <Link href="/">
            <Button variant="outline" size="lg" data-testid="back-home-button">
              Back to Home
            </Button>
          </Link>
          <Link href="/">
            <Button size="lg" data-testid="try-again-button">
              View Cart
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
