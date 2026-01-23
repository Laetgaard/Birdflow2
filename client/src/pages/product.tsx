import { useState, useEffect, useRef, useCallback } from 'react';
import { useRoute, Link } from 'wouter';
import { CartProvider, useCart } from '../lib/cartContext';

type Product = {
  id: string;
  name: string;
  description?: string;
  longDescription?: string;
  long_description?: string;
  price: string;
  compareAtPrice?: string;
  compare_at_price?: string;
  currency?: string;
  imageUrl?: string;
  image_url?: string;
  images?: string[];
  category?: string;
  inventory?: string;
};

type Review = {
  id: string;
  name: string;
  rating: number;
  text?: string;
  verified: boolean;
  createdAt: string;
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  for (let i = 1; i <= 5; i++) {
    if (i <= fullStars) {
      stars.push(
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" strokeWidth="1">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      );
    } else if (i === fullStars + 1 && hasHalfStar) {
      stars.push(
        <svg key={i} width={size} height={size} viewBox="0 0 24 24">
          <defs>
            <linearGradient id={`half-star-${i}`}>
              <stop offset="50%" stopColor="#fbbf24"/>
              <stop offset="50%" stopColor="#e5e7eb"/>
            </linearGradient>
          </defs>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={`url(#half-star-${i})`} stroke="#fbbf24" strokeWidth="1"/>
        </svg>
      );
    } else {
      stars.push(
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="#e5e7eb" stroke="#e5e7eb" strokeWidth="1">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      );
    }
  }

  return <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} data-testid="star-rating">{stars}</div>;
}

function PriceDisplay({ price, compareAtPrice, currency = 'USD' }: { price: string; compareAtPrice?: string; currency?: string }) {
  const currentPrice = parseFloat(price);
  const originalPrice = compareAtPrice ? parseFloat(compareAtPrice) : null;
  const hasDiscount = originalPrice && originalPrice > currentPrice;
  
  if (hasDiscount && originalPrice) {
    const savings = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} data-testid="price-display">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '36px', fontWeight: 700, color: '#dc2626' }} data-testid="sale-price">
            {formatCurrency(currentPrice, currency)}
          </span>
          <span style={{ fontSize: '24px', fontWeight: 500, color: '#9ca3af', textDecoration: 'line-through' }} data-testid="original-price">
            {formatCurrency(originalPrice, currency)}
          </span>
          <span style={{ 
            backgroundColor: '#dc2626', 
            color: '#fff', 
            padding: '6px 12px', 
            borderRadius: '20px', 
            fontSize: '14px', 
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }} data-testid="save-badge">
            Save {savings}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <p style={{ fontSize: '36px', fontWeight: 700, color: '#4f46e5', margin: 0 }} data-testid="price-display">
      {formatCurrency(currentPrice, currency)}
    </p>
  );
}

function RatingSummary({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null;

  const totalReviews = reviews.length;
  const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
  
  const distribution = [5, 4, 3, 2, 1].map(stars => {
    const count = reviews.filter(r => r.rating === stars).length;
    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
    return { stars, count, percentage };
  });

  return (
    <div style={{ 
      display: 'flex', 
      gap: '32px', 
      padding: '20px 0',
      flexWrap: 'wrap',
      alignItems: 'flex-start'
    }} data-testid="rating-summary">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '120px' }}>
        <div style={{ fontSize: '48px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>
          {averageRating.toFixed(1)}
        </div>
        <StarRating rating={averageRating} size={20} />
        <div style={{ color: '#6b7280', fontSize: '14px', marginTop: '8px' }}>
          {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
        </div>
      </div>
      
      <div style={{ flex: 1, minWidth: '200px', maxWidth: '300px' }}>
        {distribution.map(({ stars, count, percentage }) => (
          <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', color: '#6b7280', width: '50px' }}>{stars} star</span>
            <div style={{ 
              flex: 1, 
              height: '8px', 
              backgroundColor: '#e5e7eb', 
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${percentage}%`, 
                height: '100%', 
                backgroundColor: '#fbbf24',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <span style={{ fontSize: '13px', color: '#6b7280', width: '35px', textAlign: 'right' }}>
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div style={{ 
      padding: '24px', 
      borderBottom: '1px solid #e5e7eb',
    }} data-testid={`review-card-${review.id}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '50%', 
            backgroundColor: '#eef2ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            color: '#4f46e5',
            fontSize: '16px'
          }}>
            {review.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, color: '#111827' }}>{review.name}</span>
              {review.verified && (
                <span style={{ 
                  backgroundColor: '#dcfce7', 
                  color: '#16a34a', 
                  padding: '2px 8px', 
                  borderRadius: '12px', 
                  fontSize: '11px', 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }} data-testid="verified-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Verified Purchase
                </span>
              )}
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
              {formatDate(review.createdAt)}
            </div>
          </div>
        </div>
        <StarRating rating={review.rating} size={16} />
      </div>
      {review.text && (
        <p style={{ color: '#4b5563', lineHeight: 1.7, margin: 0 }}>{review.text}</p>
      )}
    </div>
  );
}

function ProductTabs({ 
  product, 
  reviews 
}: { 
  product: Product; 
  reviews: Review[];
}) {
  const [activeTab, setActiveTab] = useState('description');
  const hasReviews = reviews.length > 0;
  const longDesc = product.longDescription || product.long_description;

  const tabs = [
    { id: 'description', label: 'Description' },
    { id: 'info', label: 'Additional Information' },
    ...(hasReviews ? [{ id: 'reviews', label: `Reviews (${reviews.length})` }] : []),
  ];

  return (
    <div style={{ marginTop: '80px', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', overflow: 'hidden' }} data-testid="product-tabs">
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '16px 32px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 600,
              color: activeTab === tab.id ? '#4f46e5' : '#6b7280',
              borderBottom: activeTab === tab.id ? '2px solid #4f46e5' : '2px solid transparent',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            data-testid={`tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '32px' }}>
        {activeTab === 'description' && (
          <div data-testid="tab-content-description">
            {longDesc ? (
              <div style={{ fontSize: '16px', color: '#4b5563', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {longDesc}
              </div>
            ) : (
              <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No detailed description available.</p>
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div data-testid="tab-content-info">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {product.category && (
                  <tr>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 500, color: '#374151', width: '200px' }}>Category</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>{product.category}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 500, color: '#374151', width: '200px' }}>SKU</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>{product.id.slice(0, 8).toUpperCase()}</td>
                </tr>
                {product.inventory && (
                  <tr>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 500, color: '#374151', width: '200px' }}>Availability</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                      {parseInt(product.inventory) > 0 ? `${product.inventory} in stock` : 'Out of stock'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'reviews' && hasReviews && (
          <div data-testid="tab-content-reviews">
            {reviews.map(review => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ImageGallery({ images, productName }: { images: string[]; productName: string }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const mainImageRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mainImageRef.current) return;
    const rect = mainImageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isLightboxOpen) return;
    if (e.key === 'Escape') setIsLightboxOpen(false);
    if (e.key === 'ArrowLeft') setSelectedIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
    if (e.key === 'ArrowRight') setSelectedIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  }, [isLightboxOpen, images.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isLightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isLightboxOpen]);

  if (images.length === 0) {
    return (
      <div style={{ width: '100%', aspectRatio: '1', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px', borderRadius: '16px' }}>
        📦
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          ref={mainImageRef}
          onClick={() => setIsLightboxOpen(true)}
          onMouseEnter={() => setIsZoomed(true)}
          onMouseLeave={() => setIsZoomed(false)}
          onMouseMove={handleMouseMove}
          style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            cursor: 'zoom-in',
            position: 'relative',
          }}
          data-testid="main-product-image"
        >
          <img
            src={images[selectedIndex]}
            alt={`${productName} - Image ${selectedIndex + 1}`}
            style={{
              width: '100%',
              aspectRatio: '1',
              objectFit: 'cover',
              transition: 'transform 0.2s ease-out',
              transform: isZoomed ? 'scale(1.5)' : 'scale(1)',
              transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: isZoomed ? 0 : 1,
            transition: 'opacity 0.2s',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
              <path d="M11 8v6M8 11h6" />
            </svg>
            Click to expand
          </div>
        </div>

        {images.length > 1 && (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '4px' }}>
            {images.map((img, index) => (
              <button
                key={index}
                onClick={() => setSelectedIndex(index)}
                style={{
                  width: '80px',
                  height: '80px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: selectedIndex === index ? '3px solid #4f46e5' : '2px solid #e5e7eb',
                  padding: 0,
                  cursor: 'pointer',
                  background: 'none',
                  transition: 'all 0.2s',
                  opacity: selectedIndex === index ? 1 : 0.7,
                }}
                data-testid={`thumbnail-${index}`}
              >
                <img
                  src={img}
                  alt={`${productName} - Thumbnail ${index + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {isLightboxOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.95)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setIsLightboxOpen(false)}
          data-testid="lightbox-overlay"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setIsLightboxOpen(false); }}
            aria-label="Close image viewer"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              transition: 'background 0.2s',
            }}
            data-testid="lightbox-close"
          >
            ✕
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
                }}
                aria-label="Previous image"
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#fff',
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
                data-testid="lightbox-prev"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
                }}
                aria-label="Next image"
                style={{
                  position: 'absolute',
                  right: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#fff',
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
                data-testid="lightbox-next"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </>
          )}

          <img
            src={images[selectedIndex]}
            alt={`${productName} - Full size ${selectedIndex + 1}`}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '8px',
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="lightbox-image"
          />

          {images.length > 1 && (
            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '8px',
            }}>
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => { e.stopPropagation(); setSelectedIndex(index); }}
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: selectedIndex === index ? '#fff' : 'rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  data-testid={`lightbox-dot-${index}`}
                />
              ))}
            </div>
          )}

          <div style={{
            position: 'absolute',
            bottom: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '14px',
          }}>
            {selectedIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}

function ProductDetailPageContent({ websiteId }: { websiteId: string | null }) {
  const [, params] = useRoute('/product/:id');
  const productId = params?.id;
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const cart = useCart();

  useEffect(() => {
    if (!productId || !websiteId) {
      setError('Invalid product or website');
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`/api/public/websites/${websiteId}/products/${productId}`)
        .then(res => {
          if (!res.ok) throw new Error('Product not found');
          return res.json();
        }),
      fetch(`/api/public/websites/${websiteId}/products/${productId}/reviews`)
        .then(res => res.ok ? res.json() : [])
        .catch(() => [])
    ])
      .then(([productData, reviewsData]) => {
        setProduct(productData);
        setReviews(reviewsData || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [productId, websiteId]);

  const handleAddToCart = () => {
    if (!product || !websiteId) return;
    
    cart.addItem({
      id: product.id,
      name: product.name,
      price: parseFloat(product.price),
      currency: product.currency || 'USD',
      imageUrl: product.imageUrl || product.image_url,
    }, quantity);
    
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const getAllImages = (): string[] => {
    if (!product) return [];
    const mainImage = product.imageUrl || product.image_url;
    const additionalImages = product.images || [];
    
    if (mainImage) {
      return [mainImage, ...additionalImages.filter(img => img !== mainImage)];
    }
    return additionalImages;
  };

  const getStockStatus = () => {
    if (!product?.inventory) return null;
    const stock = parseInt(product.inventory);
    if (isNaN(stock)) return null;
    if (stock === 0) return { text: 'Out of Stock', color: '#ef4444' };
    if (stock <= 5) return { text: `Only ${stock} left!`, color: '#f59e0b' };
    return { text: 'In Stock', color: '#22c55e' };
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

  const images = getAllImages();
  const stockStatus = getStockStatus();
  const isOutOfStock = stockStatus?.text === 'Out of Stock';
  const compareAtPrice = product.compareAtPrice || product.compare_at_price;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .product-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
          .product-info {
            position: static !important;
          }
          .trust-badges {
            flex-direction: column !important;
            gap: 12px !important;
          }
        }
      `}</style>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 24px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#4f46e5', textDecoration: 'none', marginBottom: '32px', fontSize: '14px', fontWeight: 500 }} data-testid="back-link">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Products
        </Link>

        <div className="product-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 600px) 1fr', gap: '64px', alignItems: 'start' }}>
          <ImageGallery images={images} productName={product.name} />

          <div className="product-info" style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'sticky', top: '40px' }}>
            {product.category && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em' }} data-testid="product-category">
                {product.category}
              </span>
            )}
            
            <h1 style={{ fontSize: '40px', fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }} data-testid="product-title">
              {product.name}
            </h1>

            {reviews.length > 0 && (
              <RatingSummary reviews={reviews} />
            )}

            {stockStatus && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: stockStatus.color }} />
                <span style={{ fontSize: '14px', fontWeight: 500, color: stockStatus.color }} data-testid="stock-status">
                  {stockStatus.text}
                </span>
              </div>
            )}
            
            <PriceDisplay 
              price={product.price} 
              compareAtPrice={compareAtPrice} 
              currency={product.currency} 
            />

            {product.description && (
              <p style={{ fontSize: '16px', color: '#6b7280', lineHeight: 1.6, margin: 0 }} data-testid="product-description">
                {product.description}
              </p>
            )}

            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={isOutOfStock}
                  style={{
                    width: '44px',
                    height: '44px',
                    border: 'none',
                    backgroundColor: '#f9fafb',
                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                    fontSize: '20px',
                    color: '#374151',
                  }}
                  data-testid="quantity-decrease"
                >
                  −
                </button>
                <span style={{ width: '48px', textAlign: 'center', fontSize: '16px', fontWeight: 500 }} data-testid="quantity-value">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  disabled={isOutOfStock}
                  style={{
                    width: '44px',
                    height: '44px',
                    border: 'none',
                    backgroundColor: '#f9fafb',
                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                    fontSize: '20px',
                    color: '#374151',
                  }}
                  data-testid="quantity-increase"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '14px 32px',
                  backgroundColor: isOutOfStock ? '#d1d5db' : addedToCart ? '#22c55e' : '#4f46e5',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                data-testid="add-to-cart-button"
              >
                {isOutOfStock ? (
                  'Out of Stock'
                ) : addedToCart ? (
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
            </div>

            <div className="trust-badges" style={{ display: 'flex', gap: '24px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                Free Shipping
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Secure Checkout
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Easy Returns
              </div>
            </div>
          </div>
        </div>

        <ProductTabs product={product} reviews={reviews} />

        <div style={{ marginTop: '80px', backgroundColor: '#fff', borderRadius: '16px', padding: '40px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '24px' }}>Why Choose Us</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '32px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
                  <path d="M5 12l5 5L20 7"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Premium Quality</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>Crafted with the finest materials for lasting durability</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Satisfaction Guaranteed</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>30-day money-back guarantee on all orders</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Fast Delivery</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>Quick and reliable shipping to your doorstep</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const websiteId = searchParams.get('website');

  return (
    <CartProvider websiteId={websiteId || undefined}>
      <ProductDetailPageContent websiteId={websiteId} />
    </CartProvider>
  );
}
