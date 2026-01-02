import { useState, useEffect } from 'react';
import { useRoute, Link } from 'wouter';

type Product = {
  id: string;
  name: string;
  description?: string;
  longDescription?: string;
  long_description?: string;
  price: string;
  currency?: string;
  imageUrl?: string;
  image_url?: string;
  category?: string;
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

export default function ProductDetailPage() {
  const [, params] = useRoute('/product/:id');
  const productId = params?.id;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const websiteId = searchParams.get('website');

  useEffect(() => {
    if (!productId || !websiteId) {
      setError('Invalid product or website');
      setLoading(false);
      return;
    }

    fetch(`/api/public/websites/${websiteId}/products/${productId}`)
      .then(res => {
        if (!res.ok) throw new Error('Product not found');
        return res.json();
      })
      .then(data => {
        setProduct(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [productId, websiteId]);

  const handleAddToCart = () => {
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6b7280' }}>Loading product...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📦</div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#111827' }}>Product Not Found</h1>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>{error || 'The product you are looking for does not exist or is no longer available.'}</p>
          <Link href="/" style={{ display: 'inline-block', padding: '12px 24px', backgroundColor: '#4f46e5', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#4f46e5', textDecoration: 'none', marginBottom: '32px', fontSize: '14px', fontWeight: 500 }} data-testid="back-link">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Products
        </Link>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '48px', alignItems: 'start' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            {(product.imageUrl || product.image_url) ? (
              <img 
                src={product.imageUrl || product.image_url} 
                alt={product.name} 
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }}
                data-testid="product-image"
              />
            ) : (
              <div style={{ width: '100%', aspectRatio: '1', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px' }}>
                📦
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {product.category && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em' }} data-testid="product-category">
                {product.category}
              </span>
            )}
            
            <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#111827', margin: 0 }} data-testid="product-title">
              {product.name}
            </h1>
            
            <p style={{ fontSize: '32px', fontWeight: 700, color: '#4f46e5' }} data-testid="product-price">
              {formatCurrency(parseFloat(product.price), product.currency)}
            </p>

            <button
              onClick={handleAddToCart}
              style={{
                padding: '16px 32px',
                backgroundColor: addedToCart ? '#22c55e' : '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              data-testid="add-to-cart-button"
            >
              {addedToCart ? (
                <>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M5 10L8.5 13.5L15 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Added to Cart
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 3H5L5.4 5M7 13H15L17 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.1 15.9 4.5 17 5.3 17H15M15 17C14.2 17 13.5 17.7 13.5 18.5S14.2 20 15 20 16.5 19.3 16.5 18.5 15.8 17 15 17ZM7 17C6.2 17 5.5 17.7 5.5 18.5S6.2 20 7 20 8.5 19.3 8.5 18.5 7.8 17 7 17Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Add to Cart
                </>
              )}
            </button>

            {product.description && (
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>Description</h2>
                <p style={{ fontSize: '16px', color: '#6b7280', lineHeight: 1.6 }} data-testid="product-description">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {(product.longDescription || product.long_description) && (
          <div style={{ marginTop: '64px', backgroundColor: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '24px' }}>Product Details</h2>
            <div style={{ fontSize: '16px', color: '#4b5563', lineHeight: 1.8, whiteSpace: 'pre-wrap' }} data-testid="product-long-description">
              {product.longDescription || product.long_description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
