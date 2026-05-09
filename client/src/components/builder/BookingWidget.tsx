import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, User, Mail, Phone, FileText, CheckCircle, ArrowRight, ArrowLeft, Sparkles, Play, X, Star, Shield, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function MiniCalendar({ selectedDate, onSelect, accentColor, accentLight, disabled }: {
  selectedDate: string;
  onSelect: (date: string) => void;
  accentColor: string;
  accentLight: string;
  disabled?: boolean;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    // Monday-first: (getDay() + 6) % 7
    const startOffset = (first.getDay() + 6) % 7;
    const days: (Date | null)[] = Array(startOffset).fill(null);
    const count = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let d = 1; d <= count; d++) days.push(new Date(viewYear, viewMonth, d));
    return days;
  }, [viewYear, viewMonth]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  return (
    <div style={{ userSelect: 'none' }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button type="button" onClick={e => { e.stopPropagation(); prevMonth(); }} disabled={disabled}
          style={{ background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer', padding: '4px 8px', borderRadius: '8px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={e => { e.stopPropagation(); nextMonth(); }} disabled={disabled}
          style={{ background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer', padding: '4px 8px', borderRadius: '8px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={16} />
        </button>
      </div>
      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {WEEKDAYS.map((d: string) => (
          <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#94a3b8', padding: '2px 0' }}>{d}</div>
        ))}
      </div>
      {/* Days grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {daysInMonth.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const dateStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
          const isPast = dateStr < todayStr;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          return (
            <button
              key={dateStr}
              type="button"
              disabled={disabled || isPast}
              onClick={e => { e.stopPropagation(); if (!isPast && !disabled) onSelect(dateStr); }}
              style={{
                border: 'none',
                borderRadius: '8px',
                padding: '6px 2px',
                fontSize: '13px',
                fontWeight: isSelected ? 700 : isToday ? 600 : 400,
                cursor: disabled || isPast ? 'default' : 'pointer',
                backgroundColor: isSelected ? accentColor : isToday ? accentLight : 'transparent',
                color: isSelected ? '#fff' : isPast ? '#cbd5e1' : isToday ? accentColor : '#334155',
                transition: 'all 0.15s ease',
                textAlign: 'center',
              }}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type BookingService = {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: string;
  currency: string;
};

type Props = {
  websiteId: string;
  styles: {
    backgroundColor?: string;
    textColor?: string;
    padding?: string;
  };
  props: {
    title?: string;
    description?: string;
    buttonText?: string;
  };
  isPreview?: boolean;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onTextChange?: (field: string, value: string) => void;
  editingField?: string | null;
  onEditField?: ((field: string | null) => void) | undefined;
};

async function fetchServices(websiteId: string): Promise<BookingService[]> {
  const res = await fetch(`/api/public/websites/${websiteId}/booking-services`);
  if (!res.ok) return [];
  return res.json();
}

function formatCurrency(amount: number, currency: string = 'USD') {
  const symbols: Record<string, string> = { USD: '$', EUR: '\u20ac', GBP: '\u00a3', DKK: 'kr ' };
  const symbol = symbols[currency] || currency + ' ';
  if (currency === 'DKK') return `${amount.toFixed(0)} kr`;
  return `${symbol}${amount.toFixed(0)}`;
}

export default function BookingWidget({ websiteId, styles, props, isPreview, isSelected, onClick, onTextChange, editingField, onEditField }: Props) {
  const canEditText = !isPreview && onTextChange && onEditField;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMode, setTestMode] = useState(false);

  const { data: services = [] } = useQuery({
    queryKey: ['booking-services', websiteId],
    queryFn: () => fetchServices(websiteId),
    enabled: !!websiteId,
  });

  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  const handleSectionClick = (e: React.MouseEvent) => {
    if (!isPreview && !testMode && onClick) {
      onClick(e);
    }
  };

  const isBuilderMode = !isPreview && !testMode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBuilderMode) return;

    if (!selectedService || !selectedDate || !selectedTime || !name || !email) {
      setStatus('error');
      return;
    }

    if (testMode) {
      setStatus('success');
      return;
    }

    setStatus('loading');
    try {
      const service = services.find(s => s.id === selectedService);

      const res = await fetch(`/api/public/websites/${websiteId}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerEmail: email,
          customerPhone: phone || undefined,
          serviceId: selectedService,
          service: service?.name || 'Service',
          date: `${selectedDate}T${selectedTime}:00`,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Booking failed');
      }

      setStatus('success');
    } catch (err) {
      setStatus('error');
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedService('');
    setSelectedDate('');
    setSelectedTime('');
    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setStatus('idle');
  };

  const selectedServiceData = services.find(s => s.id === selectedService);
  const today = new Date().toISOString().split('T')[0];
  const canProceedStep1 = selectedService !== '';
  const canProceedStep2 = selectedDate !== '' && selectedTime !== '';

  const bgColor = styles.backgroundColor || '#f8fafc';
  const textColor = styles.textColor || '#1e293b';
  const accentColor = '#7c3aed';
  const accentLight = '#ede9fe';

  const stepLabels = ['Service', 'Schedule', 'Details'];

  return (
    <section
      onClick={handleSectionClick}
      style={{
        backgroundColor: bgColor,
        color: textColor,
        padding: styles.padding || '80px 24px',
        cursor: !isPreview && !testMode ? 'pointer' : 'default',
        outline: isSelected ? '3px solid #3b82f6' : 'none',
        outlineOffset: '-3px',
        position: 'relative',
      }}
      data-testid="booking-widget"
    >
      {/* Test Mode Toggle */}
      {!isPreview && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setTestMode(!testMode);
              if (testMode) {
                resetForm();
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: testMode ? '#ef4444' : '#10b981',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              transition: 'all 0.2s ease',
            }}
            data-testid="button-toggle-test-mode"
          >
            {testMode ? (
              <>
                <X style={{ width: '14px', height: '14px' }} />
                Exit Test
              </>
            ) : (
              <>
                <Play style={{ width: '14px', height: '14px' }} />
                Test Booking
              </>
            )}
          </button>
          {testMode && (
            <div style={{
              marginTop: '8px',
              padding: '6px 12px',
              backgroundColor: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#92400e',
              textAlign: 'center',
              fontWeight: 500,
            }}>
              Test mode active
            </div>
          )}
        </div>
      )}

      <div style={{ maxWidth: '580px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: `linear-gradient(135deg, ${accentColor}, #a855f7)`,
            marginBottom: '16px',
            boxShadow: `0 8px 32px ${accentColor}33`,
          }}>
            <Calendar style={{ width: '28px', height: '28px', color: '#fff' }} />
          </div>
          <h2
            data-editable-field={canEditText ? 'title' : undefined}
            contentEditable={editingField === 'title'}
            suppressContentEditableWarning
            onClick={canEditText ? (e: React.MouseEvent) => { e.stopPropagation(); onEditField!('title'); } : undefined}
            onBlur={editingField === 'title' ? (e: React.FocusEvent<HTMLHeadingElement>) => {
              onTextChange!('title', e.currentTarget.innerText.trim());
              onEditField!(null);
            } : undefined}
            onKeyDown={editingField === 'title' ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
              if (e.key === 'Escape') { e.preventDefault(); onEditField!(null); }
            } : undefined}
            ref={(el: HTMLHeadingElement | null) => { if (el && editingField === 'title') el.focus(); }}
            style={{
              fontSize: '28px',
              fontWeight: 800,
              marginBottom: '8px',
              letterSpacing: '-0.03em',
              lineHeight: 1.2,
              outline: editingField === 'title' ? '2px solid #3b82f6' : 'none',
              outlineOffset: editingField === 'title' ? '2px' : undefined,
              borderRadius: editingField === 'title' ? '4px' : undefined,
              cursor: canEditText ? 'text' : undefined,
            }}
          >
            {props.title || 'Book Your Appointment'}
          </h2>
          <p
            data-editable-field={canEditText ? 'description' : undefined}
            contentEditable={editingField === 'description'}
            suppressContentEditableWarning
            onClick={canEditText ? (e: React.MouseEvent) => { e.stopPropagation(); onEditField!('description'); } : undefined}
            onBlur={editingField === 'description' ? (e: React.FocusEvent<HTMLParagraphElement>) => {
              onTextChange!('description', e.currentTarget.innerText.trim());
              onEditField!(null);
            } : undefined}
            onKeyDown={editingField === 'description' ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
              if (e.key === 'Escape') { e.preventDefault(); onEditField!(null); }
            } : undefined}
            ref={(el: HTMLParagraphElement | null) => { if (el && editingField === 'description') el.focus(); }}
            style={{
              fontSize: '16px',
              opacity: 0.6,
              maxWidth: '380px',
              margin: '0 auto',
              lineHeight: 1.5,
              outline: editingField === 'description' ? '2px solid #3b82f6' : 'none',
              outlineOffset: editingField === 'description' ? '2px' : undefined,
              borderRadius: editingField === 'description' ? '4px' : undefined,
              cursor: canEditText ? 'text' : undefined,
            }}
          >
            {props.description || 'Schedule a time that works best for you'}
          </p>
        </div>

        {/* Step Indicator */}
        {(isPreview || testMode) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0',
            marginBottom: '28px',
            padding: '0 20px',
          }}>
            {[1, 2, 3].map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 700,
                      backgroundColor: step > s ? '#10b981' : step === s ? accentColor : '#e2e8f0',
                      color: step >= s ? '#fff' : '#94a3b8',
                      transition: 'all 0.3s ease',
                      boxShadow: step === s ? `0 4px 12px ${accentColor}40` : 'none',
                    }}
                  >
                    {step > s ? <CheckCircle style={{ width: '18px', height: '18px' }} /> : s}
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: step === s ? 600 : 400,
                    color: step === s ? accentColor : '#94a3b8',
                    transition: 'all 0.2s ease',
                  }}>
                    {stepLabels[s - 1]}
                  </span>
                </div>
                {s < 3 && (
                  <div style={{
                    width: '48px',
                    height: '2px',
                    backgroundColor: step > s ? '#10b981' : '#e2e8f0',
                    transition: 'all 0.3s ease',
                    margin: '0 8px',
                    marginBottom: '20px',
                    borderRadius: '1px',
                  }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Success State */}
        {status === 'success' ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 28px',
            background: testMode
              ? 'linear-gradient(135deg, #fffbeb, #fef3c7)'
              : 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
            borderRadius: '20px',
            border: testMode ? '1px solid #fbbf24' : '1px solid #6ee7b7',
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: testMode
                ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                : 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: testMode
                ? '0 8px 24px rgba(245, 158, 11, 0.3)'
                : '0 8px 24px rgba(16, 185, 129, 0.3)',
            }}>
              <CheckCircle style={{ width: '28px', height: '28px', color: '#fff' }} />
            </div>
            <h3 style={{
              color: testMode ? '#92400e' : '#065f46',
              fontSize: '22px',
              fontWeight: 800,
              marginBottom: '6px',
              letterSpacing: '-0.02em',
            }}>
              {testMode ? 'Test Complete!' : 'Booking Confirmed!'}
            </h3>
            <p style={{
              color: testMode ? '#b45309' : '#047857',
              marginBottom: '20px',
              fontSize: '14px',
              lineHeight: 1.5,
            }}>
              {testMode
                ? 'This is how the confirmation looks. No actual booking was made.'
                : `We'll send a confirmation email to ${email}`
              }
            </p>

            {/* Summary */}
            {selectedServiceData && (
              <div style={{
                backgroundColor: testMode ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '16px',
                textAlign: 'left',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ opacity: 0.7 }}>Service</span>
                  <span style={{ fontWeight: 600 }}>{selectedServiceData.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ opacity: 0.7 }}>Date & Time</span>
                  <span style={{ fontWeight: 600 }}>{selectedDate} at {selectedTime}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ opacity: 0.7 }}>Price</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(parseFloat(selectedServiceData.price), selectedServiceData.currency)}</span>
                </div>
              </div>
            )}

            <Button
              onClick={(e) => {
                e.stopPropagation();
                resetForm();
              }}
              style={{
                backgroundColor: testMode ? '#f59e0b' : '#10b981',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '14px',
              }}
              data-testid="button-new-booking"
            >
              {testMode ? 'Test Again' : 'Book Another'}
            </Button>
          </div>
        ) : (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            {services.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '36px 20px',
                backgroundColor: '#fefce8',
                borderRadius: '14px',
                border: '1px solid #fde047',
              }}>
                <Calendar style={{ width: '36px', height: '36px', color: '#ca8a04', margin: '0 auto 12px', opacity: 0.7 }} />
                <p style={{ color: '#854d0e', fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                  {!isPreview && !testMode
                    ? 'No services configured yet'
                    : 'No services available'
                  }
                </p>
                <p style={{ color: '#a16207', fontSize: '13px' }}>
                  {!isPreview && !testMode
                    ? 'Add booking services in Manage to enable the booking flow'
                    : 'Check back soon for available appointments'
                  }
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Step 1: Service Selection */}
                {step === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        backgroundColor: accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Sparkles style={{ width: '14px', height: '14px', color: accentColor }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '16px' }}>Choose a Service</span>
                    </div>

                    {services.map((service) => (
                      <div
                        key={service.id}
                        onClick={(e) => {
                          if (isBuilderMode) return;
                          e.stopPropagation();
                          setSelectedService(service.id);
                        }}
                        style={{
                          padding: '16px 18px',
                          borderRadius: '14px',
                          border: selectedService === service.id
                            ? `2px solid ${accentColor}`
                            : '2px solid #f1f5f9',
                          backgroundColor: selectedService === service.id ? accentLight : '#fafafa',
                          cursor: isBuilderMode ? 'default' : 'pointer',
                          transition: 'all 0.2s ease',
                          transform: selectedService === service.id ? 'scale(1.01)' : 'scale(1)',
                        }}
                        data-testid={`service-option-${service.id}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <p style={{ fontWeight: 700, fontSize: '15px', margin: 0 }}>{service.name}</p>
                              {selectedService === service.id && (
                                <div style={{
                                  width: '18px', height: '18px', borderRadius: '50%',
                                  backgroundColor: accentColor, display: 'flex',
                                  alignItems: 'center', justifyContent: 'center',
                                }}>
                                  <CheckCircle style={{ width: '12px', height: '12px', color: '#fff' }} />
                                </div>
                              )}
                            </div>
                            {service.description && (
                              <p style={{ fontSize: '13px', opacity: 0.6, marginBottom: '6px', lineHeight: 1.4, margin: '0 0 6px 0' }}>
                                {service.description}
                              </p>
                            )}
                            <div style={{ display: 'flex', gap: '10px', fontSize: '12px', opacity: 0.6 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Clock style={{ width: '12px', height: '12px' }} />
                                {service.durationMinutes} min
                              </span>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 800,
                            color: accentColor,
                            backgroundColor: accentLight,
                            padding: '6px 12px',
                            borderRadius: '10px',
                            letterSpacing: '-0.02em',
                            marginLeft: '12px',
                          }}>
                            {formatCurrency(parseFloat(service.price), service.currency)}
                          </div>
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      onClick={(e) => {
                        if (isBuilderMode) return;
                        e.stopPropagation();
                        if (canProceedStep1) setStep(2);
                      }}
                      disabled={!canProceedStep1 || isBuilderMode}
                      style={{
                        marginTop: '12px',
                        padding: '14px 24px',
                        borderRadius: '14px',
                        fontSize: '15px',
                        fontWeight: 700,
                        backgroundColor: canProceedStep1 ? accentColor : '#e2e8f0',
                        color: canProceedStep1 ? '#fff' : '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: canProceedStep1 ? `0 4px 12px ${accentColor}33` : 'none',
                        transition: 'all 0.2s ease',
                      }}
                      data-testid="button-next-step1"
                    >
                      Continue <ArrowRight style={{ width: '16px', height: '16px' }} />
                    </Button>
                  </div>
                )}

                {/* Step 2: Date & Time */}
                {step === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        backgroundColor: accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Calendar style={{ width: '14px', height: '14px', color: accentColor }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '16px' }}>Pick a Date & Time</span>
                    </div>

                    {/* Selected service badge */}
                    {selectedServiceData && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 14px',
                        backgroundColor: accentLight,
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: accentColor,
                        alignSelf: 'flex-start',
                      }}>
                        <Star style={{ width: '13px', height: '13px' }} />
                        {selectedServiceData.name} - {selectedServiceData.durationMinutes} min
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', marginBottom: '10px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                        Select date
                      </label>
                      <div style={{ backgroundColor: '#f8fafc', borderRadius: '14px', padding: '14px 12px', border: `1.5px solid ${selectedDate ? accentColor : '#e2e8f0'}`, transition: 'border-color 0.2s' }}>
                        <MiniCalendar
                          selectedDate={selectedDate}
                          onSelect={(d) => !isBuilderMode && setSelectedDate(d)}
                          accentColor={accentColor}
                          accentLight={accentLight}
                          disabled={isBuilderMode}
                        />
                      </div>
                      {selectedDate && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: accentColor, fontWeight: 600 }}>
                          <Calendar style={{ width: '13px', height: '13px' }} />
                          {selectedDate}
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '10px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                        Select time
                      </label>
                      {/* AM slots */}
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>Morning</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {timeSlots.filter(t => parseInt(t) < 12).map((time) => (
                            <button
                              key={time}
                              type="button"
                              onClick={(e) => { if (isBuilderMode) return; e.stopPropagation(); setSelectedTime(time); }}
                              disabled={isBuilderMode}
                              style={{
                                padding: '7px 14px',
                                borderRadius: '999px',
                                border: selectedTime === time ? `2px solid ${accentColor}` : '1.5px solid #e2e8f0',
                                backgroundColor: selectedTime === time ? accentColor : '#fff',
                                color: selectedTime === time ? '#fff' : '#475569',
                                fontWeight: selectedTime === time ? 700 : 500,
                                fontSize: '13px',
                                cursor: isBuilderMode ? 'default' : 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: selectedTime === time ? `0 2px 8px ${accentColor}40` : 'none',
                              }}
                              data-testid={`time-slot-${time}`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* PM slots */}
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>Afternoon</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {timeSlots.filter(t => parseInt(t) >= 12).map((time) => (
                            <button
                              key={time}
                              type="button"
                              onClick={(e) => { if (isBuilderMode) return; e.stopPropagation(); setSelectedTime(time); }}
                              disabled={isBuilderMode}
                              style={{
                                padding: '7px 14px',
                                borderRadius: '999px',
                                border: selectedTime === time ? `2px solid ${accentColor}` : '1.5px solid #e2e8f0',
                                backgroundColor: selectedTime === time ? accentColor : '#fff',
                                color: selectedTime === time ? '#fff' : '#475569',
                                fontWeight: selectedTime === time ? 700 : 500,
                                fontSize: '13px',
                                cursor: isBuilderMode ? 'default' : 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: selectedTime === time ? `0 2px 8px ${accentColor}40` : 'none',
                              }}
                              data-testid={`time-slot-${time}`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => {
                          if (isBuilderMode) return;
                          e.stopPropagation();
                          setStep(1);
                        }}
                        disabled={isBuilderMode}
                        style={{
                          flex: 1,
                          padding: '14px',
                          borderRadius: '14px',
                          fontWeight: 600,
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <ArrowLeft style={{ width: '14px', height: '14px' }} /> Back
                      </Button>
                      <Button
                        type="button"
                        onClick={(e) => {
                          if (isBuilderMode) return;
                          e.stopPropagation();
                          if (canProceedStep2) setStep(3);
                        }}
                        disabled={!canProceedStep2 || isBuilderMode}
                        style={{
                          flex: 2,
                          padding: '14px',
                          borderRadius: '14px',
                          fontWeight: 700,
                          fontSize: '15px',
                          backgroundColor: canProceedStep2 ? accentColor : '#e2e8f0',
                          color: canProceedStep2 ? '#fff' : '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: canProceedStep2 ? `0 4px 12px ${accentColor}33` : 'none',
                          transition: 'all 0.2s ease',
                        }}
                        data-testid="button-next-step2"
                      >
                        Continue <ArrowRight style={{ width: '16px', height: '16px' }} />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: Customer Details */}
                {step === 3 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        backgroundColor: accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <User style={{ width: '14px', height: '14px', color: accentColor }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '16px' }}>Your Details</span>
                    </div>

                    {/* Booking Summary */}
                    {selectedServiceData && (
                      <div style={{
                        padding: '14px 16px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #f1f5f9',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                            <Star style={{ width: '12px', height: '12px' }} /> Service
                          </span>
                          <span style={{ fontWeight: 600 }}>{selectedServiceData.name}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                            <Calendar style={{ width: '12px', height: '12px' }} /> Date & Time
                          </span>
                          <span style={{ fontWeight: 600 }}>{selectedDate} at {selectedTime}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
                            <Clock style={{ width: '12px', height: '12px' }} /> Duration
                          </span>
                          <span style={{ fontWeight: 600 }}>{selectedServiceData.durationMinutes} min</span>
                        </div>
                      </div>
                    )}

                    <div>
                      <label style={{
                        display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#475569',
                      }}>
                        Full Name <span style={{ color: accentColor }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <User style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#94a3b8' }} />
                        <Input
                          type="text"
                          value={name}
                          onChange={(e) => !isBuilderMode && setName(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={isBuilderMode}
                          placeholder="John Smith"
                          style={{ padding: '12px 14px 12px 38px', borderRadius: '12px', fontSize: '15px' }}
                          data-testid="input-name"
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{
                        display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#475569',
                      }}>
                        Email <span style={{ color: accentColor }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#94a3b8' }} />
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => !isBuilderMode && setEmail(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={isBuilderMode}
                          placeholder="john@example.com"
                          style={{ padding: '12px 14px 12px 38px', borderRadius: '12px', fontSize: '15px' }}
                          data-testid="input-email"
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{
                        display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#475569',
                      }}>
                        Phone <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Phone style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#94a3b8' }} />
                        <Input
                          type="tel"
                          value={phone}
                          onChange={(e) => !isBuilderMode && setPhone(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={isBuilderMode}
                          placeholder="+1 (555) 123-4567"
                          style={{ padding: '12px 14px 12px 38px', borderRadius: '12px', fontSize: '15px' }}
                          data-testid="input-phone"
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{
                        display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#475569',
                      }}>
                        Notes <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => !isBuilderMode && setNotes(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isBuilderMode}
                        rows={2}
                        placeholder="Any special requests..."
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          fontSize: '15px',
                          resize: 'none',
                          fontFamily: 'inherit',
                          lineHeight: 1.5,
                        }}
                        data-testid="input-notes"
                      />
                    </div>

                    {status === 'error' && (
                      <div style={{
                        padding: '10px 14px',
                        backgroundColor: '#fef2f2',
                        borderRadius: '10px',
                        color: '#dc2626',
                        fontSize: '13px',
                        textAlign: 'center',
                        fontWeight: 500,
                        border: '1px solid #fecaca',
                      }}>
                        Please fill in all required fields and try again.
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => {
                          if (isBuilderMode) return;
                          e.stopPropagation();
                          setStep(2);
                        }}
                        disabled={isBuilderMode}
                        style={{
                          flex: 1,
                          padding: '14px',
                          borderRadius: '14px',
                          fontWeight: 600,
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <ArrowLeft style={{ width: '14px', height: '14px' }} /> Back
                      </Button>
                      <Button
                        type="submit"
                        onClick={(e) => e.stopPropagation()}
                        disabled={status === 'loading' || !name || !email || isBuilderMode}
                        style={{
                          flex: 2,
                          padding: '14px',
                          borderRadius: '14px',
                          fontWeight: 700,
                          fontSize: '15px',
                          backgroundColor: accentColor,
                          color: '#fff',
                          opacity: status === 'loading' || !name || !email || isBuilderMode ? 0.5 : 1,
                          boxShadow: `0 4px 12px ${accentColor}33`,
                          transition: 'all 0.2s ease',
                        }}
                        data-testid="button-book"
                      >
                        {status === 'loading' ? 'Booking...' : (props.buttonText || 'Confirm Booking')}
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        )}

        {/* Trust badges */}
        {(isPreview || testMode) && status !== 'success' && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '24px',
            marginTop: '24px',
            fontSize: '12px',
            color: '#94a3b8',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Shield style={{ width: '13px', height: '13px' }} /> Secure
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle style={{ width: '13px', height: '13px' }} /> Instant Confirmation
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Clock style={{ width: '13px', height: '13px' }} /> Free Cancellation
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
