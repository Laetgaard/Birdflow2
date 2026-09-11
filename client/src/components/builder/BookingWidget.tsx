import * as React from 'react';
import { createBookingView, type BookingViewProps, type BookingAppearance } from '@shared/rendering/bookingView';

const BookingView = createBookingView(React);
type Slot = BookingViewProps['slots'][number];
type Props = {
  websiteId: string; styles: Record<string, any>; props: BookingAppearance;
  language?: 'da' | 'en'; isPreview?: boolean; isSelected?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  onTextChange?: (field: string, value: string) => void;
  editingField?: string | null; onEditField?: (field: string | null) => void;
};

// The editor reads real configuration but never submits a reservation.
// The published host owns the mutation adapter; both use BookingView.
export default function BookingWidget({ websiteId, styles, props, language = 'da', isPreview, onClick, onTextChange, editingField, onEditField }: Props) {
  const [testing, setTesting] = React.useState(false);
  const [services, setServices] = React.useState<BookingViewProps['services']>([]);
  const [members, setMembers] = React.useState<BookingViewProps['members']>([]);
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [loadingServices, setLoadingServices] = React.useState(true);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [error, setError] = React.useState('');
  const [step, setStep] = React.useState<BookingViewProps['step']>('service');
  const [status, setStatus] = React.useState<BookingViewProps['status']>('idle');
  const [selectedService, setService] = React.useState('');
  const [selectedMember, setMember] = React.useState('');
  const [selectedDate, setDate] = React.useState('');
  const [selectedTime, setTime] = React.useState('');
  const [customer, setCustomer] = React.useState({ name: '', email: '', phone: '', notes: '' });
  const editing = !isPreview && !testing;
  React.useEffect(() => {
    const controller = new AbortController();
    setServices([]); setMembers([]); setService(''); setMember(''); setDate(''); setTime(''); setStep('service'); setStatus('idle'); setError('');
    if (!websiteId) { setLoadingServices(false); return; }
    setLoadingServices(true);
    const read = async (path: string) => {
      const response = await fetch(path, { signal: controller.signal });
      if (!response.ok) throw new Error('configuration');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('configuration');
      return data;
    };
    Promise.all([read('/api/public/websites/' + encodeURIComponent(websiteId) + '/booking-services'), read('/api/public/websites/' + encodeURIComponent(websiteId) + '/team-members')])
      .then(([serviceData, memberData]) => { if (!controller.signal.aborted) { setServices(serviceData); setMembers(memberData); } })
      .catch(() => { if (!controller.signal.aborted) setError(language === 'en' ? 'Booking configuration could not be loaded.' : 'Bookingopsætningen kunne ikke indlæses.'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingServices(false); });
    return () => controller.abort();
  }, [websiteId, language]);
  React.useEffect(() => {
    const controller = new AbortController();
    setSlots([]); setTime(''); setLoadingSlots(false);
    if (!websiteId || !selectedService || !selectedDate) return;
    setLoadingSlots(true); setError('');
    const query = new URLSearchParams({ date: selectedDate });
    if (selectedMember) query.set('teamMemberId', selectedMember);
    fetch('/api/public/websites/' + encodeURIComponent(websiteId) + '/services/' + encodeURIComponent(selectedService) + '/slots?' + query, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('slots'); return response.json(); })
      .then(data => { if (!controller.signal.aborted) setSlots(Array.isArray(data) ? data : []); })
      .catch(() => { if (!controller.signal.aborted) setError(language === 'en' ? 'Available times could not be loaded.' : 'Ledige tider kunne ikke indlæses.'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingSlots(false); });
    return () => controller.abort();
  }, [websiteId, selectedService, selectedDate, selectedMember, language]);
  const reset = () => { setStep('service'); setStatus('idle'); setTime(''); setDate(''); setError(''); setCustomer({ name: '', email: '', phone: '', notes: '' }); };
  return <div onClick={editing ? onClick : undefined}>
    {!isPreview && <button type="button" onClick={event => { event.stopPropagation(); setTesting(value => !value); reset(); }} style={{ marginBottom: 8 }}>
      {testing ? (language === 'en' ? 'Back to editing' : 'Tilbage til redigering') : (language === 'en' ? 'Try booking' : 'Prøv booking')}
    </button>}
    {testing && <p role="status">{language === 'en' ? 'Preview only. No reservation or message is created.' : 'Kun prøvevisning. Ingen reservation eller besked oprettes.'}</p>}
    <BookingView props={props} styles={styles} language={language} services={services} members={members} slots={slots}
      loadingServices={loadingServices} loadingSlots={loadingSlots} error={error} step={step} status={status}
      selectedService={selectedService} selectedMember={selectedMember} selectedDate={selectedDate} selectedTime={selectedTime} customer={customer}
      editing={editing} editingField={editingField} onTextChange={onTextChange} onEditField={onEditField}
      onService={id => { setService(id); setMember(''); setTime(''); setDate(''); }} onMember={id => { setMember(id); setTime(''); }}
      onDate={date => { setDate(date); setTime(''); }} onTime={setTime} onCustomer={(field, value) => setCustomer(previous => ({ ...previous, [field]: value }))}
      onNext={() => setStep(step === 'service' ? 'datetime' : 'details')} onBack={() => setStep(step === 'details' ? 'datetime' : 'service')} onReset={reset}
      onSubmit={event => { event.preventDefault(); if (!editing && selectedService && selectedDate && selectedTime && customer.name && customer.email) setStatus('success'); }} />
  </div>;
}
