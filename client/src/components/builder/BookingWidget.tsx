import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';

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
};

async function fetchServices(websiteId: string): Promise<BookingService[]> {
  const res = await fetch(`/api/public/websites/${websiteId}/booking-services`);
  if (!res.ok) return [];
  return res.json();
}

export default function BookingWidget({ websiteId, styles, props, isPreview }: Props) {
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
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPreview) return;

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
      setSelectedService('');
      setSelectedDate('');
      setSelectedTime('');
      setName('');
      setEmail('');
      setPhone('');
      setNotes('');
    } catch (err) {
      setStatus('error');
    }
  };

  const selectedServiceData = services.find(s => s.id === selectedService);
  const today = new Date().toISOString().split('T')[0];

  return (
    <section
      style={{
        backgroundColor: styles.backgroundColor || '#f8f9fa',
        color: styles.textColor || '#1a1a1a',
        padding: styles.padding || '60px 24px',
      }}
      data-testid="booking-widget"
    >
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Calendar style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.8 }} />
          <h2 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
            {props.title || 'Book an Appointment'}
          </h2>
          <p style={{ opacity: 0.8 }}>
            {props.description || 'Select a service and choose a date that works for you.'}
          </p>
        </div>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '32px', backgroundColor: '#d4edda', borderRadius: '8px' }}>
            <h3 style={{ color: '#155724', fontSize: '20px', marginBottom: '8px' }}>Booking Confirmed!</h3>
            <p style={{ color: '#155724' }}>We've received your booking request and will confirm it shortly.</p>
            <Button
              onClick={() => setStatus('idle')}
              style={{ marginTop: '16px' }}
              data-testid="button-new-booking"
            >
              Make Another Booking
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {services.length > 0 ? (
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Service</label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger data-testid="select-service">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} - ${service.price} ({service.durationMinutes} min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedServiceData?.description && (
                  <p style={{ fontSize: '14px', opacity: 0.7, marginTop: '4px' }}>
                    {selectedServiceData.description}
                  </p>
                )}
              </div>
            ) : (
              <div style={{ padding: '16px', backgroundColor: '#fff3cd', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ color: '#856404' }}>
                  {isPreview ? 'Add booking services in the Manage dashboard to enable this widget.' : 'No services available at this time.'}
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Date</label>
                <Input
                  type="date"
                  min={today}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                  data-testid="input-date"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Time</label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger data-testid="select-time">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Your Name</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="John Doe"
                data-testid="input-name"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="john@example.com"
                data-testid="input-email"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Phone (Optional)</label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                data-testid="input-phone"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any additional information..."
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  resize: 'vertical',
                }}
                data-testid="input-notes"
              />
            </div>

            <Button
              type="submit"
              disabled={status === 'loading' || services.length === 0}
              style={{
                padding: '14px 24px',
                fontSize: '16px',
                fontWeight: 600,
              }}
              data-testid="button-book"
            >
              {status === 'loading' ? 'Booking...' : (props.buttonText || 'Book Now')}
            </Button>

            {status === 'error' && (
              <p style={{ color: '#dc3545', textAlign: 'center' }}>
                Something went wrong. Please try again.
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
