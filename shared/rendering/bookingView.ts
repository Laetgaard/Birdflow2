import type * as ReactTypes from 'react';

export type BookingAppearance = {
  title?: string; description?: string; subtitle?: string; buttonText?: string;
  headingVisible?: boolean | string; variant?: string; displayMode?: string;
};
export type BookingViewProps = {
  props: BookingAppearance;
  styles: Record<string, unknown>;
  language?: 'da' | 'en';
  step: 'service' | 'person' | 'datetime' | 'details';
  status: 'idle' | 'loading' | 'success' | 'error';
  services: Array<{ id: string; name: string; description?: string; price: string; currency: string; durationMinutes?: number; duration_minutes?: number }>;
  members: Array<{ id: string; name: string; serviceIds?: string[] }>;
  slots: Array<{ time: string; available: boolean }>;
  selectedService: string; selectedMember: string; selectedDate: string; selectedTime: string;
  customer: { name: string; email: string; phone: string; notes: string };
  loadingSlots?: boolean; loadingServices?: boolean; error?: string;
  editing?: boolean; editingField?: string | null;
  onTextChange?: (field: string, value: string) => void;
  onEditField?: (field: string | null) => void;
  onService: (id: string) => void; onMember: (id: string) => void; onDate: (date: string) => void; onTime: (time: string) => void;
  onCustomer: (field: 'name' | 'email' | 'phone' | 'notes', value: string) => void;
  onNext: () => void; onBack: () => void; onReset: () => void; onSubmit: (event: ReactTypes.FormEvent) => void;
};

/** One presentation implementation for the editor and generated website.
 * Self-contained for trusted publisher emission; I/O stays in host adapters.
 */
export function createBookingView(React: typeof ReactTypes) {
  const h = React.createElement;
  return function BookingView(p: BookingViewProps) {
    const en = p.language === 'en';
    const t = en ? {
      title: 'Book an appointment', service: 'Service', practitioner: 'Practitioner', any: 'Any available practitioner', date: 'Date and time', details: 'Your details', next: 'Continue', back: 'Back', book: 'Confirm booking', empty: 'No services are available for booking yet.', loading: 'Loading services…', slots: 'Available times', noSlots: 'No available times on this date. Please choose another date.', loadingSlots: 'Loading available times…', name: 'Name', email: 'Email', phone: 'Phone (optional)', notes: 'Message (optional)', success: 'Your booking is confirmed', another: 'Make another booking', previousMonth: 'Previous month', nextMonth: 'Next month', failed: 'Something went wrong. Please try again.', submitting: 'Confirming…'
    } : {
      title: 'Book en tid', service: 'Ydelse', practitioner: 'Behandler', any: 'En ledig behandler', date: 'Dato og tidspunkt', details: 'Dine oplysninger', next: 'Fortsæt', back: 'Tilbage', book: 'Bekræft booking', empty: 'Der er endnu ingen ydelser, der kan bookes.', loading: 'Indlæser ydelser…', slots: 'Ledige tider', noSlots: 'Ingen ledige tider denne dag. Vælg venligst en anden dato.', loadingSlots: 'Indlæser ledige tider…', name: 'Navn', email: 'E-mail', phone: 'Telefon (valgfrit)', notes: 'Besked (valgfrit)', success: 'Din booking er bekræftet', another: 'Book en ny tid', previousMonth: 'Forrige måned', nextMonth: 'Næste måned', failed: 'Der opstod en fejl. Prøv igen.', submitting: 'Bekræfter…'
    };
    const locale = en ? 'en-DK' : 'da-DK';
    const uid = React.useId();
    const [month, setMonth] = React.useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const selected = p.services.find(service => service.id === p.selectedService);
    const members = p.members.filter(member => !member.serviceIds?.length || member.serviceIds.includes(p.selectedService));
    const compact = p.props.variant === 'compact';
    const inline = p.props.variant === 'inline';
    const accent = String(p.styles.accentColor || p.styles.buttonColor || '#6366f1');
    const text = String(p.styles.textColor || '#1e293b');
    const radius = String(p.styles.borderRadius || '12px');
    const fieldStyle: ReactTypes.CSSProperties = { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '12px', border: '1px solid #94a3b8', borderRadius: radius, color: text, background: '#fff', font: 'inherit', minHeight: 44 };
    const buttonStyle: ReactTypes.CSSProperties = { minHeight: 44, padding: '10px 16px', borderRadius: radius, border: `1px solid ${accent}`, color: text, background: '#fff', cursor: p.editing ? 'default' : 'pointer', font: 'inherit' };
    const dateValue = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = dateValue(new Date());
    const step = p.step === 'person' ? 'service' : p.step;
    const editing = (field: string) => ({ contentEditable: !!p.editing && p.editingField === field, suppressContentEditableWarning: true,
      onDoubleClick: p.editing ? (event: ReactTypes.MouseEvent) => { event.stopPropagation(); p.onEditField?.(field); } : undefined,
      onBlur: p.editing ? (event: ReactTypes.FocusEvent<HTMLElement>) => { if (p.editingField === field) { p.onTextChange?.(field, event.currentTarget.textContent || ''); p.onEditField?.(null); } } : undefined });
    const money = (service: typeof selected) => {
      if (!service || service.price === '' || service.price == null) return '';
      const amount = Number(service.price);
      if (!Number.isFinite(amount)) return String(service.price);
      try { return new Intl.NumberFormat(locale, { style: 'currency', currency: service.currency || 'DKK' }).format(amount); } catch { return `${amount} ${service.currency || 'DKK'}`; }
    };
    const nextDisabled = p.editing || (step === 'service' ? !p.selectedService : !p.selectedDate || !p.selectedTime || !!p.loadingSlots);
    const content = p.status === 'success' ? h('div', { role: 'status', style: { textAlign: 'center', padding: '32px 0' } },
      h('h3', null, t.success), h('p', null, [selected?.name, p.selectedDate, p.selectedTime].filter(Boolean).join(' · ')), h('button', { 'data-preview-local-interaction': '', type: 'button', style: buttonStyle, onClick: p.onReset }, t.another)
    ) : h(React.Fragment, null,
      h('ol', { 'aria-label': en ? 'Booking steps' : 'Bookingtrin', style: { display: 'flex', flexWrap: 'wrap', gap: '12px 24px', padding: '0 0 20px', margin: 0, listStyle: 'none' } }, [t.service, t.date, t.details].map((label, i) => h('li', { key: label, 'aria-current': ['service', 'datetime', 'details'][i] === step ? 'step' : undefined, style: { fontWeight: ['service', 'datetime', 'details'][i] === step ? 700 : 400 } }, `${i + 1}. ${label}`))),
      p.error && h('p', { role: 'alert' }, p.error),
      step === 'service' && h('div', null,
        p.loadingServices ? h('p', { role: 'status' }, t.loading) : p.services.length === 0 ? h('p', { role: 'status' }, t.empty) : h('div', { role: 'group', 'aria-label': t.service, style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 } }, p.services.map(service => h('button', { 'data-preview-local-interaction': '',
          key: service.id, type: 'button', 'aria-pressed': service.id === p.selectedService, disabled: p.editing, onClick: () => p.onService(service.id),
          style: { ...buttonStyle, textAlign: 'left', borderWidth: service.id === p.selectedService ? 2 : 1, padding: compact ? 12 : 20 }
        }, h('strong', { style: { display: 'block' } }, service.name), service.description && h('span', { style: { display: 'block', marginTop: 8 } }, service.description), h('span', { style: { display: 'block', marginTop: 8 } }, [service.durationMinutes ?? service.duration_minutes, 'min', money(service)].filter(value => value !== undefined && value !== '').join(' '))))),
        p.selectedService && members.length > 1 && h('label', { style: { display: 'block', marginTop: 20 } }, t.practitioner,
          h('select', { style: fieldStyle, value: p.selectedMember, disabled: p.editing, onChange: (event: ReactTypes.ChangeEvent<HTMLSelectElement>) => p.onMember(event.target.value) }, h('option', { value: '' }, t.any), members.map(member => h('option', { key: member.id, value: member.id }, member.name))))
      ),
      step === 'datetime' && h('div', null,
        h('h3', null, t.date),
        p.props.displayMode === 'list' ? h('label', null, t.date, h('input', { type: 'date', min: today, value: p.selectedDate, disabled: p.editing, style: fieldStyle, onChange: (event: ReactTypes.ChangeEvent<HTMLInputElement>) => p.onDate(event.target.value) })) : h('div', { 'data-booking-calendar': '', style: { maxWidth: 420, margin: '0 auto' } },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 } },
            h('button', { 'data-preview-local-interaction': '', type: 'button', style: buttonStyle, 'aria-label': t.previousMonth, disabled: p.editing || dateValue(month).slice(0, 7) <= today.slice(0, 7), onClick: () => setMonth(value => new Date(value.getFullYear(), value.getMonth() - 1, 1)) }, '‹'),
            h('strong', { 'aria-live': 'polite' }, new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)),
            h('button', { 'data-preview-local-interaction': '', type: 'button', style: buttonStyle, 'aria-label': t.nextMonth, disabled: p.editing, onClick: () => setMonth(value => new Date(value.getFullYear(), value.getMonth() + 1, 1)) }, '›')),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 } },
            (en ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø']).map(day => h('span', { key: day, style: { textAlign: 'center' } }, day)),
            Array.from({ length: (month.getDay() + 6) % 7 }, (_, i) => h('span', { key: `empty-${i}` })),
            Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => {
              const day = new Date(month.getFullYear(), month.getMonth(), i + 1); const date = dateValue(day);
              return h('button', { 'data-preview-local-interaction': '', key: date, type: 'button', 'aria-label': new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(day), 'aria-pressed': date === p.selectedDate, disabled: p.editing || date < today, style: { ...buttonStyle, minHeight: 38, padding: '6px 0', border: date === p.selectedDate ? `2px solid ${accent}` : '1px solid transparent', opacity: date < today ? 0.4 : 1 }, onClick: () => p.onDate(date) }, i + 1);
            }))),
        p.selectedDate && h('div', { style: { marginTop: 20 } }, h('h4', null, t.slots), p.loadingSlots ? h('p', { role: 'status' }, t.loadingSlots) : !p.slots.some(slot => slot.available) ? h('p', { role: 'status' }, t.noSlots) : h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } }, p.slots.map(slot => h('button', { 'data-preview-local-interaction': '', key: slot.time, type: 'button', 'aria-pressed': slot.time === p.selectedTime, disabled: p.editing || !slot.available, onClick: () => p.onTime(slot.time), style: { ...buttonStyle, borderWidth: slot.time === p.selectedTime ? 2 : 1, opacity: slot.available ? 1 : 0.4 } }, slot.time))))
      ),
      step === 'details' && h('form', { 'data-preview-local-form': '', id: `${uid}-form`, onSubmit: p.onSubmit, style: { display: 'grid', gap: 16 } },
        h('p', null, [selected?.name, p.selectedDate, p.selectedTime, money(selected)].filter(Boolean).join(' · ')),
        (['name', 'email', 'phone', 'notes'] as const).map(field => h('label', { key: field }, t[field], h(field === 'notes' ? 'textarea' : 'input', {
          name: field, type: field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text', value: p.customer[field], required: field === 'name' || field === 'email', disabled: p.editing || p.status === 'loading', maxLength: field === 'notes' ? 2000 : 200, style: fieldStyle, onChange: (event: ReactTypes.ChangeEvent<HTMLInputElement>) => p.onCustomer(field, event.target.value)
        }))),
        h('p', { style: { fontSize: 13, lineHeight: 1.5, margin: 0 } }, en ? 'Your details are only used to process your booking — see our ' : 'Dine oplysninger bruges kun til at håndtere din booking – se vores ', h('a', { href: '/privacy', style: { color: 'inherit', textDecoration: 'underline' } }, en ? 'privacy policy' : 'privatlivspolitik')),
        h('button', { 'data-preview-local-interaction': '', 'data-testid': 'button-confirm-booking', type: 'submit', disabled: p.editing || p.status === 'loading', style: { ...buttonStyle, fontWeight: 700 } }, p.status === 'loading' ? t.submitting : p.props.buttonText || t.book)
      ),
      p.services.length > 0 && h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 24 } },
        step !== 'service' && h('button', { 'data-preview-local-interaction': '', type: 'button', style: buttonStyle, disabled: p.editing || p.status === 'loading', onClick: p.onBack }, t.back),
        step !== 'details' && h('button', { 'data-preview-local-interaction': '', type: 'button', style: { ...buttonStyle, marginLeft: 'auto', fontWeight: 700, opacity: nextDisabled ? 0.5 : 1 }, disabled: nextDisabled, onClick: p.onNext }, t.next))
    );
    return h('section', { 'data-booking': 'true', 'data-booking-variant': p.props.variant || 'default', 'data-booking-display': p.props.displayMode || 'calendar', style: { boxSizing: 'border-box', width: '100%', minWidth: 0, backgroundColor: String(p.styles.backgroundColor || '#f8fafc'), color: text, padding: String(p.styles.padding || '24px'), fontFamily: p.styles.fontFamily ? String(p.styles.fontFamily) : 'inherit' } },
      h('div', { style: { boxSizing: 'border-box', width: '100%', maxWidth: inline ? 'none' : compact ? 560 : 720, margin: '0 auto', borderRadius: radius } },
        p.props.headingVisible !== false && p.props.headingVisible !== 'false' && h('header', { style: { marginBottom: compact ? 20 : 32 } },
          h('h2', { ...editing('title'), style: { margin: '0 0 12px', fontSize: compact ? '1.5rem' : 'clamp(1.5rem, 4vw, 2rem)', lineHeight: 1.2 } }, p.props.title || t.title),
          (p.props.description ?? p.props.subtitle) && h('p', { ...editing('description'), style: { margin: 0, lineHeight: 1.6 } }, p.props.description ?? p.props.subtitle)),
        content)
    );
  };
}
