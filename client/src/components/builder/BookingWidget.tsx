import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, User, Mail, Phone, FileText, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';

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
};

async function fetchServices(websiteId: string): Promise<BookingService[]> {
  const res = await fetch(`/api/public/websites/${websiteId}/booking-services`);
  if (!res.ok) return [];
  return res.json();
}

export default function BookingWidget({ websiteId, styles, props, isPreview, isSelected, onClick }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const { data: services = [] } = useQuery({
    queryKey: ['booking-services', websiteId],
    queryFn: () => fetchServices(websiteId),
    enabled: !!websiteId,
  });

  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  const handleSectionClick = (e: React.MouseEvent) => {
    if (!isPreview && onClick) {
      onClick(e);
    }
  };

  const isBuilderMode = !isPreview;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBuilderMode) return;

    if (!selectedService || !selectedDate || !selectedTime || !name || !email) {
      setStatus('error');
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
  const accentColor = '#6366f1';

  return (
    <section
      onClick={handleSectionClick}
      style={{
        backgroundColor: bgColor,
        color: textColor,
        padding: styles.padding || '80px 24px',
        cursor: isBuilderMode ? 'pointer' : 'default',
        outline: isSelected ? '3px solid #3b82f6' : 'none',
        outlineOffset: '-3px',
        position: 'relative',
        pointerEvents: isBuilderMode ? 'auto' : 'auto',
      }}
      data-testid="booking-widget"
    >
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '64px', 
            height: '64px', 
            borderRadius: '16px',
            background: `linear-gradient(135deg, ${accentColor}, #8b5cf6)`,
            marginBottom: '20px',
            boxShadow: '0 10px 40px rgba(99, 102, 241, 0.3)'
          }}>
            <Calendar style={{ width: '32px', height: '32px', color: '#fff' }} />
          </div>
          <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '12px', letterSpacing: '-0.02em' }}>
            {props.title || 'Book Your Appointment'}
          </h2>
          <p style={{ fontSize: '18px', opacity: 0.7, maxWidth: '400px', margin: '0 auto' }}>
            {props.description || 'Schedule a time that works best for you'}
          </p>
        </div>

        {!isPreview && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 600,
                    backgroundColor: step >= s ? accentColor : 'rgba(0,0,0,0.1)',
                    color: step >= s ? '#fff' : 'rgba(0,0,0,0.4)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {step > s ? <CheckCircle style={{ width: '16px', height: '16px' }} /> : s}
                </div>
                {s < 3 && (
                  <div style={{ 
                    width: '40px', 
                    height: '2px', 
                    backgroundColor: step > s ? accentColor : 'rgba(0,0,0,0.1)',
                    transition: 'all 0.2s ease',
                  }} />
                )}
              </div>
            ))}
          </div>
        )}

        {status === 'success' ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '48px 32px', 
            background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
            borderRadius: '16px',
            border: '1px solid #a7f3d0',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <CheckCircle style={{ width: '32px', height: '32px', color: '#fff' }} />
            </div>
            <h3 style={{ color: '#065f46', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
              Booking Confirmed!
            </h3>
            <p style={{ color: '#047857', marginBottom: '24px' }}>
              We'll send a confirmation email to {email}
            </p>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                resetForm();
              }}
              style={{ 
                backgroundColor: '#10b981',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '10px',
                fontWeight: 600,
              }}
              data-testid="button-new-booking"
            >
              Book Another Appointment
            </Button>
          </div>
        ) : (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '20px',
            padding: '32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            {services.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 20px',
                backgroundColor: '#fefce8',
                borderRadius: '12px',
                border: '1px solid #fde047',
              }}>
                <Sparkles style={{ width: '40px', height: '40px', color: '#ca8a04', margin: '0 auto 16px' }} />
                <p style={{ color: '#854d0e', fontWeight: 500 }}>
                  {isBuilderMode ? 'Add booking services in the Manage dashboard' : 'No services available right now'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {step === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles style={{ width: '18px', height: '18px', color: accentColor }} />
                      Choose a Service
                    </p>
                    {services.map((service) => (
                      <div
                        key={service.id}
                        onClick={(e) => {
                          if (isBuilderMode) return;
                          e.stopPropagation();
                          setSelectedService(service.id);
                        }}
                        style={{
                          padding: '20px',
                          borderRadius: '12px',
                          border: selectedService === service.id ? `2px solid ${accentColor}` : '2px solid #e2e8f0',
                          backgroundColor: selectedService === service.id ? '#f0f4ff' : '#fff',
                          cursor: isBuilderMode ? 'default' : 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        data-testid={`service-option-${service.id}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>{service.name}</p>
                            {service.description && (
                              <p style={{ fontSize: '14px', opacity: 0.6, marginBottom: '8px' }}>{service.description}</p>
                            )}
                            <div style={{ display: 'flex', gap: '12px', fontSize: '13px', opacity: 0.7 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock style={{ width: '14px', height: '14px' }} />
                                {service.durationMinutes} min
                              </span>
                            </div>
                          </div>
                          <div style={{ 
                            fontSize: '20px', 
                            fontWeight: 700, 
                            color: accentColor,
                            backgroundColor: '#f0f4ff',
                            padding: '8px 12px',
                            borderRadius: '8px',
                          }}>
                            ${parseFloat(service.price).toFixed(0)}
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
                        marginTop: '16px',
                        padding: '14px 24px',
                        borderRadius: '12px',
                        fontSize: '16px',
                        fontWeight: 600,
                        backgroundColor: canProceedStep1 ? accentColor : '#e2e8f0',
                        color: canProceedStep1 ? '#fff' : '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                      data-testid="button-next-step1"
                    >
                      Continue <ArrowRight style={{ width: '18px', height: '18px' }} />
                    </Button>
                  </div>
                )}

                {step === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar style={{ width: '18px', height: '18px', color: accentColor }} />
                      Select Date & Time
                    </p>
                    
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, opacity: 0.8 }}>
                        Date
                      </label>
                      <Input
                        type="date"
                        min={today}
                        value={selectedDate}
                        onChange={(e) => !isBuilderMode && setSelectedDate(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isBuilderMode}
                        style={{ 
                          padding: '14px 16px', 
                          borderRadius: '10px',
                          fontSize: '16px',
                          border: '2px solid #e2e8f0',
                        }}
                        data-testid="input-date"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, opacity: 0.8 }}>
                        Time
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {timeSlots.map((time) => (
                          <button
                            key={time}
                            type="button"
                            onClick={(e) => {
                              if (isBuilderMode) return;
                              e.stopPropagation();
                              setSelectedTime(time);
                            }}
                            disabled={isBuilderMode}
                            style={{
                              padding: '12px',
                              borderRadius: '8px',
                              border: selectedTime === time ? `2px solid ${accentColor}` : '2px solid #e2e8f0',
                              backgroundColor: selectedTime === time ? '#f0f4ff' : '#fff',
                              color: selectedTime === time ? accentColor : textColor,
                              fontWeight: 500,
                              cursor: isBuilderMode ? 'default' : 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            data-testid={`time-slot-${time}`}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => {
                          if (isBuilderMode) return;
                          e.stopPropagation();
                          setStep(1);
                        }}
                        disabled={isBuilderMode}
                        style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 600 }}
                      >
                        Back
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
                          borderRadius: '12px',
                          fontWeight: 600,
                          backgroundColor: canProceedStep2 ? accentColor : '#e2e8f0',
                          color: canProceedStep2 ? '#fff' : '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                        }}
                        data-testid="button-next-step2"
                      >
                        Continue <ArrowRight style={{ width: '18px', height: '18px' }} />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <User style={{ width: '18px', height: '18px', color: accentColor }} />
                      Your Details
                    </p>

                    {selectedServiceData && (
                      <div style={{ 
                        padding: '16px', 
                        backgroundColor: '#f8fafc', 
                        borderRadius: '10px',
                        marginBottom: '8px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                          <span style={{ opacity: 0.7 }}>Service:</span>
                          <span style={{ fontWeight: 600 }}>{selectedServiceData.name}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '4px' }}>
                          <span style={{ opacity: 0.7 }}>Date & Time:</span>
                          <span style={{ fontWeight: 600 }}>{selectedDate} at {selectedTime}</span>
                        </div>
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                        <User style={{ width: '14px', height: '14px', opacity: 0.6 }} /> Full Name *
                      </label>
                      <Input
                        type="text"
                        value={name}
                        onChange={(e) => !isBuilderMode && setName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isBuilderMode}
                        placeholder="John Smith"
                        style={{ padding: '14px 16px', borderRadius: '10px', fontSize: '16px' }}
                        data-testid="input-name"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                        <Mail style={{ width: '14px', height: '14px', opacity: 0.6 }} /> Email *
                      </label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => !isBuilderMode && setEmail(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isBuilderMode}
                        placeholder="john@example.com"
                        style={{ padding: '14px 16px', borderRadius: '10px', fontSize: '16px' }}
                        data-testid="input-email"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                        <Phone style={{ width: '14px', height: '14px', opacity: 0.6 }} /> Phone (optional)
                      </label>
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => !isBuilderMode && setPhone(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isBuilderMode}
                        placeholder="+1 (555) 123-4567"
                        style={{ padding: '14px 16px', borderRadius: '10px', fontSize: '16px' }}
                        data-testid="input-phone"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                        <FileText style={{ width: '14px', height: '14px', opacity: 0.6 }} /> Notes (optional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => !isBuilderMode && setNotes(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isBuilderMode}
                        rows={3}
                        placeholder="Any special requests or information..."
                        style={{
                          width: '100%',
                          padding: '14px 16px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          fontSize: '16px',
                          resize: 'none',
                          fontFamily: 'inherit',
                        }}
                        data-testid="input-notes"
                      />
                    </div>

                    {status === 'error' && (
                      <div style={{ 
                        padding: '12px 16px', 
                        backgroundColor: '#fef2f2', 
                        borderRadius: '8px',
                        color: '#dc2626',
                        fontSize: '14px',
                        textAlign: 'center',
                      }}>
                        Please fill in all required fields and try again.
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => {
                          if (isBuilderMode) return;
                          e.stopPropagation();
                          setStep(2);
                        }}
                        disabled={isBuilderMode}
                        style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 600 }}
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        onClick={(e) => e.stopPropagation()}
                        disabled={status === 'loading' || !name || !email || isBuilderMode}
                        style={{
                          flex: 2,
                          padding: '14px',
                          borderRadius: '12px',
                          fontWeight: 600,
                          backgroundColor: accentColor,
                          color: '#fff',
                          opacity: status === 'loading' || !name || !email || isBuilderMode ? 0.6 : 1,
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
      </div>
    </section>
  );
}
