import type { BuilderComponent, ThemeConfig, NavigationConfig } from "@shared/schema";
import { Star, Zap, Shield, Check, Mail, Phone, MapPin } from "lucide-react";

interface BlockProps {
  component: BuilderComponent;
  theme: ThemeConfig;
  isSelected?: boolean;
  onClick?: () => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  star: Star,
  zap: Zap,
  shield: Shield,
  check: Check,
  mail: Mail,
  phone: Phone,
  mappin: MapPin,
};

function getIcon(iconName?: string) {
  if (!iconName) return Star;
  return iconMap[iconName.toLowerCase()] || Star;
}

export function HeroBlock({ component, theme, isSelected, onClick }: BlockProps) {
  const { props, styles } = component;
  
  return (
    <section
      data-testid={`block-hero-${component.id}`}
      onClick={onClick}
      className={`relative ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      style={{
        backgroundColor: styles.backgroundColor || theme.colors.surface,
        color: styles.textColor || theme.colors.text,
        padding: styles.padding || theme.spacing.sectionPadding,
        fontFamily: theme.fonts.body,
      }}
    >
      <div className="max-w-4xl mx-auto" style={{ textAlign: props.alignment || 'center' }}>
        <h1
          className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4"
          style={{ fontFamily: theme.fonts.heading }}
        >
          {props.title || 'Welcome'}
        </h1>
        {props.subtitle && (
          <p className="text-lg md:text-xl opacity-80 mb-8 max-w-2xl mx-auto">
            {props.subtitle}
          </p>
        )}
        {props.buttonText && (
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href={props.buttonLink || '#'}
              className="px-6 py-3 rounded-lg font-medium transition-transform hover:scale-105"
              style={{
                backgroundColor: theme.colors.primary,
                color: '#ffffff',
                borderRadius: theme.borderRadius,
              }}
            >
              {props.buttonText}
            </a>
            {props.secondaryButtonText && (
              <a
                href={props.secondaryButtonLink || '#'}
                className="px-6 py-3 rounded-lg font-medium border-2 transition-transform hover:scale-105"
                style={{
                  borderColor: theme.colors.primary,
                  color: theme.colors.primary,
                  borderRadius: theme.borderRadius,
                }}
              >
                {props.secondaryButtonText}
              </a>
            )}
          </div>
        )}
        {props.imageUrl && (
          <img
            src={props.imageUrl}
            alt={props.title || 'Hero image'}
            className="mt-8 rounded-lg shadow-lg max-w-full mx-auto"
            style={{ borderRadius: theme.borderRadius }}
          />
        )}
      </div>
    </section>
  );
}

export function FeaturesBlock({ component, theme, isSelected, onClick }: BlockProps) {
  const { props, styles } = component;
  const columns = props.columns || 3;
  
  return (
    <section
      data-testid={`block-features-${component.id}`}
      onClick={onClick}
      className={`relative ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      style={{
        backgroundColor: styles.backgroundColor || theme.colors.background,
        color: styles.textColor || theme.colors.text,
        padding: styles.padding || theme.spacing.sectionPadding,
        fontFamily: theme.fonts.body,
      }}
    >
      <div className="max-w-6xl mx-auto">
        {props.title && (
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ textAlign: props.alignment || 'center', fontFamily: theme.fonts.heading }}
          >
            {props.title}
          </h2>
        )}
        {props.subtitle && (
          <p
            className="text-lg opacity-70 mb-12 max-w-2xl mx-auto"
            style={{ textAlign: props.alignment || 'center' }}
          >
            {props.subtitle}
          </p>
        )}
        <div
          className="grid gap-8"
          style={{ gridTemplateColumns: `repeat(${Math.min(columns, 4)}, 1fr)` }}
        >
          {props.items?.map((item) => {
            const IconComponent = getIcon(item.icon);
            return (
              <div
                key={item.id}
                className="p-6 rounded-lg"
                style={{
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.borderRadius,
                }}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: theme.colors.primary + '20' }}
                >
                  <IconComponent className="w-6 h-6" style={{ color: theme.colors.primary }} />
                </div>
                <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: theme.fonts.heading }}>
                  {item.title}
                </h3>
                <p className="opacity-70">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CTABlock({ component, theme, isSelected, onClick }: BlockProps) {
  const { props, styles } = component;
  
  return (
    <section
      data-testid={`block-cta-${component.id}`}
      onClick={onClick}
      className={`relative ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      style={{
        backgroundColor: styles.backgroundColor || theme.colors.primary,
        color: styles.textColor || '#ffffff',
        padding: styles.padding || theme.spacing.sectionPadding,
        fontFamily: theme.fonts.body,
      }}
    >
      <div className="max-w-4xl mx-auto" style={{ textAlign: props.alignment || 'center' }}>
        <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: theme.fonts.heading }}>
          {props.title || 'Ready to get started?'}
        </h2>
        {props.subtitle && (
          <p className="text-lg opacity-90 mb-8">{props.subtitle}</p>
        )}
        {props.buttonText && (
          <a
            href={props.buttonLink || '#'}
            className="inline-block px-8 py-4 rounded-lg font-medium transition-transform hover:scale-105"
            style={{
              backgroundColor: '#ffffff',
              color: styles.backgroundColor || theme.colors.primary,
              borderRadius: theme.borderRadius,
            }}
          >
            {props.buttonText}
          </a>
        )}
      </div>
    </section>
  );
}

export function TestimonialsBlock({ component, theme, isSelected, onClick }: BlockProps) {
  const { props, styles } = component;
  
  return (
    <section
      data-testid={`block-testimonials-${component.id}`}
      onClick={onClick}
      className={`relative ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      style={{
        backgroundColor: styles.backgroundColor || theme.colors.surface,
        color: styles.textColor || theme.colors.text,
        padding: styles.padding || theme.spacing.sectionPadding,
        fontFamily: theme.fonts.body,
      }}
    >
      <div className="max-w-6xl mx-auto">
        {props.title && (
          <h2
            className="text-3xl md:text-4xl font-bold mb-12"
            style={{ textAlign: props.alignment || 'center', fontFamily: theme.fonts.heading }}
          >
            {props.title}
          </h2>
        )}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {props.items?.map((item) => (
            <div
              key={item.id}
              className="p-6 rounded-lg"
              style={{ backgroundColor: theme.colors.background, borderRadius: theme.borderRadius }}
            >
              <p className="mb-4 italic opacity-80">"{item.description}"</p>
              <div className="flex items-center gap-3">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                )}
                <span className="font-semibold">{item.title}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TextImageBlock({ component, theme, isSelected, onClick }: BlockProps) {
  const { props, styles } = component;
  const isImageLeft = props.alignment === 'left';
  
  return (
    <section
      data-testid={`block-text-image-${component.id}`}
      onClick={onClick}
      className={`relative ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      style={{
        backgroundColor: styles.backgroundColor || theme.colors.background,
        color: styles.textColor || theme.colors.text,
        padding: styles.padding || theme.spacing.sectionPadding,
        fontFamily: theme.fonts.body,
      }}
    >
      <div className={`max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-center ${isImageLeft ? 'md:flex-row-reverse' : ''}`}>
        <div className="flex-1">
          {props.title && (
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: theme.fonts.heading }}>
              {props.title}
            </h2>
          )}
          {props.description && (
            <p className="text-lg opacity-80 mb-6">{props.description}</p>
          )}
          {props.buttonText && (
            <a
              href={props.buttonLink || '#'}
              className="inline-block px-6 py-3 rounded-lg font-medium"
              style={{
                backgroundColor: theme.colors.primary,
                color: '#ffffff',
                borderRadius: theme.borderRadius,
              }}
            >
              {props.buttonText}
            </a>
          )}
        </div>
        {props.imageUrl && (
          <div className="flex-1">
            <img
              src={props.imageUrl}
              alt={props.title || 'Content image'}
              className="rounded-lg shadow-lg w-full"
              style={{ borderRadius: theme.borderRadius }}
            />
          </div>
        )}
      </div>
    </section>
  );
}

export function ImageSliderBlock({ component, theme, isSelected, onClick }: BlockProps) {
  const { props, styles } = component;
  
  return (
    <section
      data-testid={`block-image-slider-${component.id}`}
      onClick={onClick}
      className={`relative ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      style={{
        backgroundColor: styles.backgroundColor || theme.colors.background,
        color: styles.textColor || theme.colors.text,
        padding: styles.padding || theme.spacing.sectionPadding,
        fontFamily: theme.fonts.body,
      }}
    >
      <div className="max-w-6xl mx-auto">
        {props.title && (
          <h2
            className="text-3xl font-bold mb-8"
            style={{ textAlign: props.alignment || 'center', fontFamily: theme.fonts.heading }}
          >
            {props.title}
          </h2>
        )}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {props.images?.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`Slide ${idx + 1}`}
              className="w-80 h-60 object-cover rounded-lg flex-shrink-0"
              style={{ borderRadius: theme.borderRadius }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingBlock({ component, theme, isSelected, onClick }: BlockProps) {
  const { props, styles } = component;
  
  return (
    <section
      data-testid={`block-pricing-${component.id}`}
      onClick={onClick}
      className={`relative ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      style={{
        backgroundColor: styles.backgroundColor || theme.colors.background,
        color: styles.textColor || theme.colors.text,
        padding: styles.padding || theme.spacing.sectionPadding,
        fontFamily: theme.fonts.body,
      }}
    >
      <div className="max-w-6xl mx-auto">
        {props.title && (
          <h2
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ textAlign: 'center', fontFamily: theme.fonts.heading }}
          >
            {props.title}
          </h2>
        )}
        {props.subtitle && (
          <p className="text-lg opacity-70 mb-12 text-center">{props.subtitle}</p>
        )}
        <div className="grid md:grid-cols-3 gap-8">
          {props.items?.map((item) => (
            <div
              key={item.id}
              className="p-8 rounded-lg border"
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.borderRadius,
                borderColor: theme.colors.primary + '30',
              }}
            >
              <h3 className="text-2xl font-bold mb-2">{item.title}</h3>
              <p className="text-4xl font-bold mb-4" style={{ color: theme.colors.primary }}>
                {item.price}
              </p>
              <p className="opacity-70 mb-6">{item.description}</p>
              <ul className="space-y-2 mb-6">
                {item.features?.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <Check className="w-5 h-5" style={{ color: theme.colors.secondary }} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                className="w-full py-3 rounded-lg font-medium"
                style={{
                  backgroundColor: theme.colors.primary,
                  color: '#ffffff',
                  borderRadius: theme.borderRadius,
                }}
              >
                Get Started
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ContactFormBlock({ component, theme, isSelected, onClick }: BlockProps) {
  const { props, styles } = component;
  
  return (
    <section
      data-testid={`block-contact-form-${component.id}`}
      onClick={onClick}
      className={`relative ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      style={{
        backgroundColor: styles.backgroundColor || theme.colors.surface,
        color: styles.textColor || theme.colors.text,
        padding: styles.padding || theme.spacing.sectionPadding,
        fontFamily: theme.fonts.body,
      }}
    >
      <div className="max-w-xl mx-auto">
        {props.title && (
          <h2 className="text-3xl font-bold mb-4 text-center" style={{ fontFamily: theme.fonts.heading }}>
            {props.title}
          </h2>
        )}
        {props.subtitle && (
          <p className="text-lg opacity-70 mb-8 text-center">{props.subtitle}</p>
        )}
        <form className="space-y-4">
          <input
            type="text"
            placeholder="Your name"
            className="w-full px-4 py-3 rounded-lg border"
            style={{ borderRadius: theme.borderRadius, borderColor: theme.colors.textMuted + '40' }}
          />
          <input
            type="email"
            placeholder="Your email"
            className="w-full px-4 py-3 rounded-lg border"
            style={{ borderRadius: theme.borderRadius, borderColor: theme.colors.textMuted + '40' }}
          />
          <textarea
            placeholder="Your message"
            rows={4}
            className="w-full px-4 py-3 rounded-lg border"
            style={{ borderRadius: theme.borderRadius, borderColor: theme.colors.textMuted + '40' }}
          />
          <button
            type="submit"
            className="w-full py-3 rounded-lg font-medium"
            style={{
              backgroundColor: theme.colors.primary,
              color: '#ffffff',
              borderRadius: theme.borderRadius,
            }}
          >
            {props.buttonText || 'Send Message'}
          </button>
        </form>
      </div>
    </section>
  );
}

interface HeaderBlockProps {
  navigation: NavigationConfig;
  theme: ThemeConfig;
}

export function HeaderBlock({ navigation, theme }: HeaderBlockProps) {
  const { header } = navigation;
  
  return (
    <header
      data-testid="block-header"
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: theme.colors.background,
        borderColor: theme.colors.textMuted + '20',
        fontFamily: theme.fonts.body,
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {header.logo && (
            <img src={header.logo} alt="Logo" className="h-8" />
          )}
          {header.logoText && (
            <span className="text-xl font-bold" style={{ fontFamily: theme.fonts.heading }}>
              {header.logoText}
            </span>
          )}
        </div>
        <nav className="hidden md:flex items-center gap-6">
          {header.links.map((link) => (
            <a
              key={link.id}
              href={link.path}
              className="hover:opacity-70 transition-opacity"
              style={{ color: theme.colors.text }}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
        {header.showCta && header.ctaText && (
          <a
            href={header.ctaLink || '#'}
            className="px-4 py-2 rounded-lg font-medium"
            style={{
              backgroundColor: theme.colors.primary,
              color: '#ffffff',
              borderRadius: theme.borderRadius,
            }}
          >
            {header.ctaText}
          </a>
        )}
      </div>
    </header>
  );
}

interface FooterBlockProps {
  navigation: NavigationConfig;
  theme: ThemeConfig;
}

export function FooterBlock({ navigation, theme }: FooterBlockProps) {
  const { footer } = navigation;
  
  return (
    <footer
      data-testid="block-footer"
      style={{
        backgroundColor: theme.colors.text,
        color: theme.colors.background,
        fontFamily: theme.fonts.body,
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="opacity-70">{footer.copyright}</p>
          <nav className="flex items-center gap-6">
            {footer.links.map((link) => (
              <a
                key={link.id}
                href={link.path}
                className="hover:opacity-100 opacity-70 transition-opacity"
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

export function renderComponent(
  component: BuilderComponent,
  theme: ThemeConfig,
  isSelected?: boolean,
  onClick?: () => void
): React.ReactNode {
  const blockProps = { component, theme, isSelected, onClick };
  
  switch (component.type) {
    case 'hero':
      return <HeroBlock key={component.id} {...blockProps} />;
    case 'features':
      return <FeaturesBlock key={component.id} {...blockProps} />;
    case 'cta':
      return <CTABlock key={component.id} {...blockProps} />;
    case 'testimonials':
      return <TestimonialsBlock key={component.id} {...blockProps} />;
    case 'text-image':
      return <TextImageBlock key={component.id} {...blockProps} />;
    case 'image-slider':
      return <ImageSliderBlock key={component.id} {...blockProps} />;
    case 'pricing':
      return <PricingBlock key={component.id} {...blockProps} />;
    case 'contact-form':
      return <ContactFormBlock key={component.id} {...blockProps} />;
    default:
      return (
        <div
          key={component.id}
          className="p-8 text-center opacity-50"
          style={{ backgroundColor: theme.colors.surface }}
        >
          Unknown component: {component.type}
        </div>
      );
  }
}
