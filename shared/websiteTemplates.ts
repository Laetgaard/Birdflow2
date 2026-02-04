import type { BuilderComponentData, ComponentStyles } from './componentRegistry';
import type { BuilderPage, BuilderStateData, DesignTokens } from './schema';

export type { BuilderPage, BuilderStateData, DesignTokens as GlobalStyles };

export type WebsiteTemplate = {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'portfolio' | 'ecommerce' | 'services' | 'blog' | 'landing';
  thumbnail: string;
  builderState: BuilderStateData;
};

const generateId = () => Math.random().toString(36).substring(2, 9);

export const websiteTemplates: WebsiteTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start from scratch with a clean slate',
    category: 'landing',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop',
    builderState: {
      pages: [{
        id: 'home',
        name: 'Home',
        path: '/',
        components: [],
      }],
      activePage: 'home',
      globalStyles: {
        primaryColor: '#4f46e5',
        secondaryColor: '#06b6d4',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#ffffff',
      },
    },
  },
  {
    id: 'ecommerce-store',
    name: 'Luxe Timepieces',
    description: 'Eksklusiv ur-butik med premium design og luksuriøst layout',
    category: 'ecommerce',
    thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=300&fit=crop',
    builderState: {
      pages: [
        {
          id: 'home',
          name: 'Hjem',
          path: '/',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'LUXE TIMEPIECES',
                items: [
                  { id: '1', title: 'Kollektion', description: '/shop' },
                  { id: '2', title: 'Om Os', description: '/about' },
                  { id: '3', title: 'Kontakt', description: '/contact' },
                ],
                showCart: true,
              },
              styles: {
                backgroundColor: '#0a0a0a',
                textColor: '#ffffff',
                padding: '20px 48px',
                fontFamily: 'Cormorant Garamond, serif',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Tidløs Elegance',
                subtitle: 'Håndværk i Perfektion',
                description: 'Oplev vores eksklusive kollektion af schweiziske luksusure. Hvert ur er et mesterværk af præcision og raffinement.',
                buttonText: 'Udforsk Kollektionen',
                buttonLink: '/shop',
                alignment: 'center',
                imageUrl: 'https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=1400&h=800&fit=crop',
              },
              styles: {
                backgroundColor: '#0a0a0a',
                textColor: '#ffffff',
                padding: '140px 48px',
                fontFamily: 'Cormorant Garamond, serif',
                accentColor: '#c9a962',
                buttonColor: '#c9a962',
                buttonStyle: 'solid',
              },
            },
            {
              id: generateId(),
              type: 'features',
              props: {
                title: 'Vores Løfte',
                subtitle: 'Kvalitet uden kompromis',
                items: [
                  { id: '1', title: 'Ægte Schweizisk', description: 'Certificerede schweiziske urværker med livstidsgaranti', icon: '🇨🇭' },
                  { id: '2', title: 'Gratis Levering', description: 'Diskret og sikker levering i hele Danmark', icon: '📦' },
                  { id: '3', title: 'Autenticitet', description: 'Alle ure leveres med ægthedsbevis og original æske', icon: '✓' },
                  { id: '4', title: 'Personlig Service', description: 'Dedikeret rådgivning fra vores ur-eksperter', icon: '👤' },
                ],
              },
              styles: {
                backgroundColor: '#0f0f0f',
                textColor: '#ffffff',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#c9a962',
              },
            },
            {
              id: generateId(),
              type: 'product-grid',
              props: {
                title: 'Udvalgte Timepieces',
                subtitle: 'Håndplukkede mesterværker',
                columns: 3,
                productLimit: 6,
                showAddToCart: true,
              },
              styles: {
                backgroundColor: '#0a0a0a',
                textColor: '#ffffff',
                padding: '100px 48px',
                fontFamily: 'Cormorant Garamond, serif',
                accentColor: '#c9a962',
                cardStyle: 'flat',
              },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Arven af Excellence',
                description: 'Siden 2010 har LUXE TIMEPIECES været Danmarks foretrukne destination for eksklusive ure. Vores passion for urmageri og øje for detaljer sikrer, at hver kunde finder det perfekte ur til deres livsstil. Vi samarbejder kun med de mest prestigefyldte schweiziske urmagere.',
                imageUrl: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&h=600&fit=crop',
                imageSide: 'right',
              },
              styles: {
                backgroundColor: '#0f0f0f',
                textColor: '#ffffff',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'testimonials',
              props: {
                title: 'Vores Kunder Siger',
                items: [
                  { id: '1', title: 'Henrik M., København', description: 'Enestående service og et utroligt udvalg. Mit nye Omega er præcis hvad jeg søgte. Anbefales varmt!', imageUrl: '' },
                  { id: '2', title: 'Camilla S., Aarhus', description: 'Købte et ur som gave til min mand. Indpakningen og præsentationen var på niveau med de bedste butikker i verden.', imageUrl: '' },
                  { id: '3', title: 'Lars K., Odense', description: 'Tredje køb hos LUXE. De leverer hver gang - kvalitet, autenticitet og fremragende kundeservice.', imageUrl: '' },
                ],
              },
              styles: {
                backgroundColor: '#0a0a0a',
                textColor: '#ffffff',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#c9a962',
              },
            },
            {
              id: generateId(),
              type: 'cta',
              props: {
                title: 'Eksklusive Tilbud',
                description: 'Tilmeld dig vores nyhedsbrev og vær den første til at høre om nye kollektioner og private salgsarrangementer.',
                buttonText: 'Tilmeld Nu',
                buttonLink: '#newsletter',
              },
              styles: {
                backgroundColor: '#c9a962',
                textColor: '#0a0a0a',
                padding: '80px 48px',
                fontFamily: 'Cormorant Garamond, serif',
                buttonColor: '#0a0a0a',
                buttonStyle: 'solid',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 LUXE TIMEPIECES. Alle rettigheder forbeholdes.',
                description: 'kontakt@luxetimepieces.dk | +45 33 12 34 56 | Vilkår | Privatlivspolitik',
              },
              styles: {
                backgroundColor: '#0a0a0a',
                textColor: '#6b7280',
                padding: '48px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
          ],
        },
        {
          id: 'shop',
          name: 'Kollektion',
          path: '/shop',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'LUXE TIMEPIECES',
                items: [
                  { id: '1', title: 'Kollektion', description: '/shop' },
                  { id: '2', title: 'Om Os', description: '/about' },
                  { id: '3', title: 'Kontakt', description: '/contact' },
                ],
                showCart: true,
              },
              styles: {
                backgroundColor: '#0a0a0a',
                textColor: '#ffffff',
                padding: '20px 48px',
                fontFamily: 'Cormorant Garamond, serif',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Vores Kollektion',
                subtitle: 'Eksklusive Timepieces',
                description: 'Udforsk vores fulde sortiment af håndudvalgte luksusure fra verdens mest prestigefyldte urmagere.',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#0f0f0f',
                textColor: '#ffffff',
                padding: '80px 48px',
                fontFamily: 'Cormorant Garamond, serif',
              },
            },
            {
              id: generateId(),
              type: 'product-grid',
              props: {
                title: '',
                columns: 3,
                productLimit: 12,
                showAddToCart: true,
              },
              styles: {
                backgroundColor: '#0a0a0a',
                textColor: '#ffffff',
                padding: '60px 48px',
                accentColor: '#c9a962',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 LUXE TIMEPIECES. Alle rettigheder forbeholdes.',
                description: 'kontakt@luxetimepieces.dk | Vilkår | Privatlivspolitik',
              },
              styles: {
                backgroundColor: '#0a0a0a',
                textColor: '#6b7280',
                padding: '48px 48px',
              },
            },
          ],
        },
        {
          id: 'about',
          name: 'Om Os',
          path: '/about',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'LUXE TIMEPIECES',
                items: [
                  { id: '1', title: 'Kollektion', description: '/shop' },
                  { id: '2', title: 'Om Os', description: '/about' },
                  { id: '3', title: 'Kontakt', description: '/contact' },
                ],
                showCart: true,
              },
              styles: {
                backgroundColor: '#0a0a0a',
                textColor: '#ffffff',
                padding: '20px 48px',
                fontFamily: 'Cormorant Garamond, serif',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Vores Historie',
                subtitle: 'Passion for Perfektion',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#0f0f0f',
                textColor: '#ffffff',
                padding: '80px 48px',
                fontFamily: 'Cormorant Garamond, serif',
              },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Grundlagt af Passion',
                description: 'LUXE TIMEPIECES blev grundlagt i 2010 af Christian Andersen, en livslang entusiast med en drøm om at bringe de fineste schweiziske ure til Danmark. Fra vores første butik i København har vi vokset til at blive landets mest betroede navn inden for luksusure. Vores filosofi er simpel: Vi sælger ikke bare ure – vi skaber forbindelser mellem mennesker og tidløse mesterværker.',
                imageUrl: 'https://images.unsplash.com/photo-1509048191080-d2984bad6ae5?w=800&h=600&fit=crop',
                imageSide: 'left',
              },
              styles: {
                backgroundColor: '#0a0a0a',
                textColor: '#ffffff',
                padding: '100px 48px',
              },
            },
            {
              id: generateId(),
              type: 'stats-counter',
              props: {
                title: 'Vores Resultater',
                stats: [
                  { id: '1', value: '14', label: 'Års erfaring', suffix: '+' },
                  { id: '2', value: '5000', label: 'Tilfredse kunder', suffix: '+' },
                  { id: '3', value: '25', label: 'Mærkepartnere', suffix: '' },
                  { id: '4', value: '100', label: 'Garanti', suffix: '%' },
                ],
              },
              styles: {
                backgroundColor: '#0f0f0f',
                textColor: '#ffffff',
                padding: '80px 48px',
                accentColor: '#c9a962',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 LUXE TIMEPIECES. Alle rettigheder forbeholdes.',
                description: 'kontakt@luxetimepieces.dk | Vilkår | Privatlivspolitik',
              },
              styles: {
                backgroundColor: '#0a0a0a',
                textColor: '#6b7280',
                padding: '48px 48px',
              },
            },
          ],
        },
        {
          id: 'contact',
          name: 'Kontakt',
          path: '/contact',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'LUXE TIMEPIECES',
                items: [
                  { id: '1', title: 'Kollektion', description: '/shop' },
                  { id: '2', title: 'Om Os', description: '/about' },
                  { id: '3', title: 'Kontakt', description: '/contact' },
                ],
                showCart: true,
              },
              styles: {
                backgroundColor: '#0a0a0a',
                textColor: '#ffffff',
                padding: '20px 48px',
                fontFamily: 'Cormorant Garamond, serif',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Kontakt Os',
                subtitle: 'Vi er her for at hjælpe',
                description: 'Har du spørgsmål om vores ure eller ønsker personlig rådgivning? Vores team af ur-eksperter står klar til at assistere dig.',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#0f0f0f',
                textColor: '#ffffff',
                padding: '80px 48px',
                fontFamily: 'Cormorant Garamond, serif',
              },
            },
            {
              id: generateId(),
              type: 'contact-form',
              props: {
                title: 'Send os en besked',
                description: 'Udfyld formularen, og vi vender tilbage inden for 24 timer.',
                buttonText: 'Send Besked',
                formFields: [
                  { id: '1', label: 'Navn', type: 'text', required: true, placeholder: 'Dit fulde navn' },
                  { id: '2', label: 'Email', type: 'email', required: true, placeholder: 'din@email.dk' },
                  { id: '3', label: 'Telefon', type: 'phone', required: false, placeholder: '+45 12 34 56 78' },
                  { id: '4', label: 'Besked', type: 'textarea', required: true, placeholder: 'Fortæl os hvordan vi kan hjælpe...' },
                ],
              },
              styles: {
                backgroundColor: '#0a0a0a',
                textColor: '#ffffff',
                padding: '80px 48px',
                accentColor: '#c9a962',
                buttonColor: '#c9a962',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 LUXE TIMEPIECES. Alle rettigheder forbeholdes.',
                description: 'kontakt@luxetimepieces.dk | +45 33 12 34 56 | Vilkår | Privatlivspolitik',
              },
              styles: {
                backgroundColor: '#0a0a0a',
                textColor: '#6b7280',
                padding: '48px 48px',
              },
            },
          ],
        },
      ],
      activePage: 'home',
      globalStyles: {
        primaryColor: '#c9a962',
        secondaryColor: '#0a0a0a',
        fontFamily: 'Cormorant Garamond, serif',
        backgroundColor: '#0a0a0a',
      },
    },
  },
  {
    id: 'service-booking',
    name: 'Psykologisk Klinik',
    description: 'Professionel klinik-skabelon til psykologer, terapeuter og sundhedspraksis',
    category: 'services',
    thumbnail: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=300&fit=crop',
    builderState: {
      pages: [
        {
          id: 'home',
          name: 'Hjem',
          path: '/',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Klinik Indre Balance',
                items: [
                  { id: '1', title: 'Behandlinger', description: '/services' },
                  { id: '2', title: 'Om Mig', description: '/about' },
                  { id: '3', title: 'Book Tid', description: '/book' },
                  { id: '4', title: 'Kontakt', description: '/contact' },
                ],
              },
              styles: {
                backgroundColor: '#ffffff',
                textColor: '#1e3a5f',
                padding: '20px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Find Vej til Indre Balance',
                subtitle: 'Professionel Psykologisk Rådgivning',
                description: 'Et trygt rum hvor du kan udforske dine tanker og følelser. Jeg tilbyder evidensbaseret terapi med fokus på din personlige udvikling og trivsel.',
                buttonText: 'Book en Samtale',
                buttonLink: '/book',
                alignment: 'center',
                imageUrl: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1400&h=800&fit=crop',
              },
              styles: {
                backgroundColor: '#e8f4f8',
                textColor: '#1e3a5f',
                padding: '120px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#3b82a6',
                buttonColor: '#3b82a6',
                buttonStyle: 'solid',
              },
            },
            {
              id: generateId(),
              type: 'features',
              props: {
                title: 'Behandlingsområder',
                subtitle: 'Evidensbaseret hjælp til livets udfordringer',
                items: [
                  { id: '1', title: 'Angst & Stress', description: 'Lær teknikker til at håndtere angst, panik og kronisk stress i hverdagen', icon: '🧠' },
                  { id: '2', title: 'Depression', description: 'Støtte og behandling ved nedtrykthed, tab af motivation og livskvalitet', icon: '💙' },
                  { id: '3', title: 'Relationer', description: 'Arbejd med parforhold, familiedynamik og sociale udfordringer', icon: '🤝' },
                  { id: '4', title: 'Personlig Udvikling', description: 'Opbyg selvværd, find retning og skab positive forandringer', icon: '✨' },
                ],
              },
              styles: {
                backgroundColor: '#ffffff',
                textColor: '#1e3a5f',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#3b82a6',
              },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'En Tryg Ramme for Forandring',
                description: 'I mine konsultationer møder jeg dig med nærvær, respekt og professionel indsigt. Sammen udforsker vi de mønstre, der holder dig tilbage, og finder nye veje til trivsel. Jeg arbejder med kognitiv terapi, ACT og mindfulness-baserede tilgange – altid tilpasset dine behov.',
                imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=600&fit=crop',
                imageSide: 'right',
              },
              styles: {
                backgroundColor: '#f0f7fa',
                textColor: '#1e3a5f',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'stats-counter',
              props: {
                title: '',
                stats: [
                  { id: '1', value: '15', label: 'Års erfaring', suffix: '+' },
                  { id: '2', value: '2000', label: 'Klienter hjulpet', suffix: '+' },
                  { id: '3', value: '98', label: 'Tilfredshed', suffix: '%' },
                  { id: '4', value: '24', label: 'Svar inden', suffix: 't' },
                ],
              },
              styles: {
                backgroundColor: '#1e3a5f',
                textColor: '#ffffff',
                padding: '60px 48px',
                accentColor: '#5ba3c9',
              },
            },
            {
              id: generateId(),
              type: 'testimonials',
              props: {
                title: 'Klienter Fortæller',
                items: [
                  { id: '1', title: 'Maria K., 34 år', description: 'Efter måneder med angst fandt jeg endelig ro. Den professionelle og varme tilgang gjorde hele forskellen. Jeg kan varmt anbefale Klinik Indre Balance.', imageUrl: '' },
                  { id: '2', title: 'Thomas L., 42 år', description: 'At turde bede om hjælp var svært, men her følte jeg mig mødt og forstået. Det har ændret mit liv og min familie.', imageUrl: '' },
                  { id: '3', title: 'Sofie M., 28 år', description: 'Jeg kom med stress og lavt selvværd. I dag har jeg redskaber til at navigere livet med større ro og selvtillid.', imageUrl: '' },
                ],
              },
              styles: {
                backgroundColor: '#ffffff',
                textColor: '#1e3a5f',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'cta',
              props: {
                title: 'Klar til at Tage Det Første Skridt?',
                description: 'Den første samtale er uforpligtende. Book en tid, og lad os sammen finde ud af, hvordan jeg bedst kan hjælpe dig.',
                buttonText: 'Book Gratis Forsamtale',
                buttonLink: '/book',
              },
              styles: {
                backgroundColor: '#3b82a6',
                textColor: '#ffffff',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                buttonColor: '#ffffff',
                buttonStyle: 'outline',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Klinik Indre Balance. Alle rettigheder forbeholdes.',
                description: 'kontakt@indrebalance.dk | +45 70 20 30 40 | CVR: 12345678 | Vilkår | Privatlivspolitik',
              },
              styles: {
                backgroundColor: '#1e3a5f',
                textColor: '#94a3b8',
                padding: '48px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
          ],
        },
        {
          id: 'services',
          name: 'Behandlinger',
          path: '/services',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Klinik Indre Balance',
                items: [
                  { id: '1', title: 'Behandlinger', description: '/services' },
                  { id: '2', title: 'Om Mig', description: '/about' },
                  { id: '3', title: 'Book Tid', description: '/book' },
                  { id: '4', title: 'Kontakt', description: '/contact' },
                ],
              },
              styles: {
                backgroundColor: '#ffffff',
                textColor: '#1e3a5f',
                padding: '20px 48px',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Behandlinger',
                subtitle: 'Skræddersyet hjælp til dine behov',
                description: 'Jeg tilbyder et bredt spektrum af terapeutiske tilgange. Alle forløb tilpasses individuelt.',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#e8f4f8',
                textColor: '#1e3a5f',
                padding: '80px 48px',
              },
            },
            {
              id: generateId(),
              type: 'services',
              props: {
                title: 'Behandlingstilbud',
                subtitle: '',
                services: [
                  { id: '1', title: 'Individuel Terapi', description: 'Dybdegående samtaleforløb hvor vi arbejder med dine personlige udfordringer. Varighed: 50-60 minutter. Typisk 6-12 sessioner.', price: '950 kr', icon: '👤' },
                  { id: '2', title: 'Parterapi', description: 'Styrk jeres relation og kommunikation. Sessioner af 90 minutters varighed med fokus på forståelse og nærhed.', price: '1.400 kr', icon: '💑' },
                  { id: '3', title: 'Stresshåndtering', description: 'Intensivt forløb med fokus på at genvinde balance. Inkluderer praktiske værktøjer og øvelser til hverdagen.', price: '950 kr', icon: '🧘' },
                  { id: '4', title: 'Angstbehandling', description: 'Evidensbaseret kognitiv terapi målrettet angst, OCD og panikangst. Gradvis eksponering og tankemæssig omstrukturering.', price: '950 kr', icon: '🌿' },
                  { id: '5', title: 'Online Terapi', description: 'Samme kvalitet hjemmefra. Fleksible tider via sikker videoplatform. Perfekt hvis du bor langt væk eller har travlt.', price: '850 kr', icon: '💻' },
                  { id: '6', title: 'Gratis Forsamtale', description: '15 minutters uforpligtende telefonsamtale hvor vi afklarer dine behov og om vi er et godt match.', price: 'Gratis', icon: '📞' },
                ],
              },
              styles: {
                backgroundColor: '#ffffff',
                textColor: '#1e3a5f',
                padding: '80px 48px',
                accentColor: '#3b82a6',
              },
            },
            {
              id: generateId(),
              type: 'faq',
              props: {
                title: 'Ofte Stillede Spørgsmål',
                subtitle: '',
                items: [
                  { id: '1', title: 'Hvor lang tid tager et forløb?', description: 'Det varierer meget. Nogle har gavn af 4-6 sessioner, mens andre har brug for længere forløb. Vi evaluerer løbende sammen.' },
                  { id: '2', title: 'Dækker min sundhedsforsikring?', description: 'Ja, mange sundhedsforsikringer dækker psykologhjælp. Jeg er godkendt af de fleste forsikringsselskaber. Tjek din police eller kontakt mig.' },
                  { id: '3', title: 'Hvad hvis jeg må aflyse?', description: 'Afbud skal ske senest 24 timer før aftalt tid. Ved senere afbud opkræves fuld pris.' },
                  { id: '4', title: 'Er der ventetid?', description: 'Aktuelt kan jeg tilbyde tid inden for 1-2 uger. Ved akutte behov forsøger jeg altid at finde en hurtig løsning.' },
                ],
              },
              styles: {
                backgroundColor: '#f0f7fa',
                textColor: '#1e3a5f',
                padding: '80px 48px',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Klinik Indre Balance. Alle rettigheder forbeholdes.',
                description: 'kontakt@indrebalance.dk | Vilkår | Privatlivspolitik',
              },
              styles: {
                backgroundColor: '#1e3a5f',
                textColor: '#94a3b8',
                padding: '48px 48px',
              },
            },
          ],
        },
        {
          id: 'about',
          name: 'Om Mig',
          path: '/about',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Klinik Indre Balance',
                items: [
                  { id: '1', title: 'Behandlinger', description: '/services' },
                  { id: '2', title: 'Om Mig', description: '/about' },
                  { id: '3', title: 'Book Tid', description: '/book' },
                  { id: '4', title: 'Kontakt', description: '/contact' },
                ],
              },
              styles: {
                backgroundColor: '#ffffff',
                textColor: '#1e3a5f',
                padding: '20px 48px',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Om Mig',
                subtitle: 'Psykolog Anne Marie Lindberg',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#e8f4f8',
                textColor: '#1e3a5f',
                padding: '80px 48px',
              },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Min Baggrund',
                description: 'Jeg er autoriseret psykolog med over 15 års erfaring i at hjælpe mennesker med at navigere livets udfordringer. Efter min kandidatgrad fra Københavns Universitet specialiserede jeg mig i kognitiv adfærdsterapi og har siden videreuddannet mig i ACT, mindfulness og traumeterapi.\n\nMit arbejde bygger på en grundlæggende tro på, at alle mennesker har ressourcer til forandring. Min rolle er at skabe et trygt rum, hvor disse ressourcer kan folde sig ud.',
                imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=800&fit=crop',
                imageSide: 'left',
              },
              styles: {
                backgroundColor: '#ffffff',
                textColor: '#1e3a5f',
                padding: '100px 48px',
              },
            },
            {
              id: generateId(),
              type: 'features',
              props: {
                title: 'Uddannelse & Kvalifikationer',
                items: [
                  { id: '1', title: 'Autoriseret Psykolog', description: 'Godkendt af Psykolognævnet', icon: '🎓' },
                  { id: '2', title: 'Kognitiv Terapi', description: 'Certificeret kognitiv terapeut', icon: '🧠' },
                  { id: '3', title: 'ACT Terapeut', description: 'Acceptance and Commitment Therapy', icon: '🌱' },
                  { id: '4', title: 'Mindfulness Instruktør', description: 'MBSR certificeret', icon: '🧘' },
                ],
              },
              styles: {
                backgroundColor: '#f0f7fa',
                textColor: '#1e3a5f',
                padding: '80px 48px',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Klinik Indre Balance. Alle rettigheder forbeholdes.',
                description: 'kontakt@indrebalance.dk | Vilkår | Privatlivspolitik',
              },
              styles: {
                backgroundColor: '#1e3a5f',
                textColor: '#94a3b8',
                padding: '48px 48px',
              },
            },
          ],
        },
        {
          id: 'book',
          name: 'Book Tid',
          path: '/book',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Klinik Indre Balance',
                items: [
                  { id: '1', title: 'Behandlinger', description: '/services' },
                  { id: '2', title: 'Om Mig', description: '/about' },
                  { id: '3', title: 'Book Tid', description: '/book' },
                  { id: '4', title: 'Kontakt', description: '/contact' },
                ],
              },
              styles: {
                backgroundColor: '#ffffff',
                textColor: '#1e3a5f',
                padding: '20px 48px',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Book en Tid',
                subtitle: 'Tag det første skridt mod forandring',
                description: 'Vælg den behandling der passer til dig, og find en ledig tid i kalenderen.',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#e8f4f8',
                textColor: '#1e3a5f',
                padding: '60px 48px',
              },
            },
            {
              id: generateId(),
              type: 'booking',
              props: {
                title: 'Vælg Behandling & Tid',
                subtitle: 'Find en tid der passer dig',
                buttonText: 'Bekræft Booking',
              },
              styles: {
                backgroundColor: '#ffffff',
                textColor: '#1e3a5f',
                padding: '80px 48px',
                accentColor: '#3b82a6',
                buttonColor: '#3b82a6',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Klinik Indre Balance. Alle rettigheder forbeholdes.',
                description: 'kontakt@indrebalance.dk | Vilkår | Privatlivspolitik',
              },
              styles: {
                backgroundColor: '#1e3a5f',
                textColor: '#94a3b8',
                padding: '48px 48px',
              },
            },
          ],
        },
        {
          id: 'contact',
          name: 'Kontakt',
          path: '/contact',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Klinik Indre Balance',
                items: [
                  { id: '1', title: 'Behandlinger', description: '/services' },
                  { id: '2', title: 'Om Mig', description: '/about' },
                  { id: '3', title: 'Book Tid', description: '/book' },
                  { id: '4', title: 'Kontakt', description: '/contact' },
                ],
              },
              styles: {
                backgroundColor: '#ffffff',
                textColor: '#1e3a5f',
                padding: '20px 48px',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Kontakt Mig',
                subtitle: 'Jeg ser frem til at høre fra dig',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#e8f4f8',
                textColor: '#1e3a5f',
                padding: '60px 48px',
              },
            },
            {
              id: generateId(),
              type: 'split-section',
              props: {
                title: 'Praktisk Information',
                description: 'Klinikken ligger centralt i København med gode transportmuligheder. Der er elevator i bygningen.',
                bullets: [
                  { text: 'Adresse: Bredgade 42, 3. sal, 1260 København K' },
                  { text: 'Telefon: +45 70 20 30 40 (man-fre 9-16)' },
                  { text: 'Email: kontakt@indrebalance.dk' },
                  { text: 'CVR: 12345678' },
                ],
                imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop',
              },
              styles: {
                backgroundColor: '#ffffff',
                textColor: '#1e3a5f',
                padding: '80px 48px',
              },
            },
            {
              id: generateId(),
              type: 'contact-form',
              props: {
                title: 'Send mig en besked',
                description: 'Udfyld formularen, så vender jeg tilbage hurtigst muligt.',
                buttonText: 'Send Besked',
                formFields: [
                  { id: '1', label: 'Navn', type: 'text', required: true, placeholder: 'Dit fulde navn' },
                  { id: '2', label: 'Email', type: 'email', required: true, placeholder: 'din@email.dk' },
                  { id: '3', label: 'Telefon', type: 'phone', required: false, placeholder: '+45 12 34 56 78' },
                  { id: '4', label: 'Hvad drejer din henvendelse sig om?', type: 'textarea', required: true, placeholder: 'Beskriv kort hvad du søger hjælp til...' },
                ],
              },
              styles: {
                backgroundColor: '#f0f7fa',
                textColor: '#1e3a5f',
                padding: '80px 48px',
                accentColor: '#3b82a6',
                buttonColor: '#3b82a6',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Klinik Indre Balance. Alle rettigheder forbeholdes.',
                description: 'kontakt@indrebalance.dk | +45 70 20 30 40 | CVR: 12345678 | Vilkår | Privatlivspolitik',
              },
              styles: {
                backgroundColor: '#1e3a5f',
                textColor: '#94a3b8',
                padding: '48px 48px',
              },
            },
          ],
        },
      ],
      activePage: 'home',
      globalStyles: {
        primaryColor: '#3b82a6',
        secondaryColor: '#1e3a5f',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#ffffff',
      },
    },
  },
];

export function getTemplateById(id: string): WebsiteTemplate | undefined {
  return websiteTemplates.find(t => t.id === id);
}

export function getTemplatesByCategory(category: WebsiteTemplate['category']): WebsiteTemplate[] {
  return websiteTemplates.filter(t => t.category === category);
}

export function cloneTemplateState(template: WebsiteTemplate): BuilderStateData {
  const clonedState: BuilderStateData = JSON.parse(JSON.stringify(template.builderState));
  
  const pageIdMap: Record<string, string> = {};
  
  clonedState.pages.forEach((page: BuilderPage) => {
    const oldId = page.id;
    const newId = Math.random().toString(36).substring(2, 9);
    pageIdMap[oldId] = newId;
    page.id = newId;
    
    page.components.forEach(component => {
      component.id = Math.random().toString(36).substring(2, 9);
    });
  });
  
  if (clonedState.activePage && pageIdMap[clonedState.activePage]) {
    clonedState.activePage = pageIdMap[clonedState.activePage];
  } else if (clonedState.pages.length > 0) {
    clonedState.activePage = clonedState.pages[0].id;
  }
  
  return clonedState;
}

export type ColorPreset = {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
};

export type FontPreset = {
  id: string;
  name: string;
  fontFamily: string;
  preview: string;
};

export const colorPresets: ColorPreset[] = [
  {
    id: 'indigo',
    name: 'Indigo',
    primaryColor: '#4f46e5',
    secondaryColor: '#06b6d4',
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    accentColor: '#4f46e5',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    primaryColor: '#10b981',
    secondaryColor: '#06b6d4',
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    accentColor: '#10b981',
  },
  {
    id: 'rose',
    name: 'Rose',
    primaryColor: '#f43f5e',
    secondaryColor: '#fb7185',
    backgroundColor: '#ffffff',
    textColor: '#1a1a1a',
    accentColor: '#f43f5e',
  },
  {
    id: 'amber',
    name: 'Amber',
    primaryColor: '#f59e0b',
    secondaryColor: '#fbbf24',
    backgroundColor: '#fffbeb',
    textColor: '#1a1a1a',
    accentColor: '#f59e0b',
  },
  {
    id: 'slate',
    name: 'Slate',
    primaryColor: '#475569',
    secondaryColor: '#64748b',
    backgroundColor: '#f8fafc',
    textColor: '#1e293b',
    accentColor: '#475569',
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    primaryColor: '#6366f1',
    secondaryColor: '#22d3ee',
    backgroundColor: '#0f172a',
    textColor: '#e2e8f0',
    accentColor: '#6366f1',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    primaryColor: '#0ea5e9',
    secondaryColor: '#38bdf8',
    backgroundColor: '#f0f9ff',
    textColor: '#0c4a6e',
    accentColor: '#0ea5e9',
  },
  {
    id: 'forest',
    name: 'Forest',
    primaryColor: '#4a7c59',
    secondaryColor: '#8fbc8f',
    backgroundColor: '#f0f4f0',
    textColor: '#2d3a2d',
    accentColor: '#4a7c59',
  },
];

export const fontPresets: FontPreset[] = [
  { id: 'inter', name: 'Inter', fontFamily: 'Inter, system-ui, sans-serif', preview: 'Modern & Clean' },
  { id: 'poppins', name: 'Poppins', fontFamily: 'Poppins, sans-serif', preview: 'Friendly & Round' },
  { id: 'roboto', name: 'Roboto', fontFamily: 'Roboto, sans-serif', preview: 'Professional' },
  { id: 'playfair', name: 'Playfair Display', fontFamily: 'Playfair Display, serif', preview: 'Elegant & Classic' },
  { id: 'lato', name: 'Lato', fontFamily: 'Lato, sans-serif', preview: 'Warm & Balanced' },
  { id: 'montserrat', name: 'Montserrat', fontFamily: 'Montserrat, sans-serif', preview: 'Bold & Dynamic' },
  { id: 'opensans', name: 'Open Sans', fontFamily: 'Open Sans, sans-serif', preview: 'Highly Readable' },
  { id: 'raleway', name: 'Raleway', fontFamily: 'Raleway, sans-serif', preview: 'Stylish & Thin' },
];

export type TemplateCustomization = {
  businessName?: string;
  colorPreset?: ColorPreset;
  fontPreset?: FontPreset;
};

export function applyCustomizationToTemplate(
  template: WebsiteTemplate,
  customization: TemplateCustomization
): BuilderStateData {
  const state = cloneTemplateState(template);
  
  if (customization.colorPreset) {
    state.globalStyles.primaryColor = customization.colorPreset.primaryColor;
    state.globalStyles.secondaryColor = customization.colorPreset.secondaryColor;
    state.globalStyles.backgroundColor = customization.colorPreset.backgroundColor;
  }
  
  if (customization.fontPreset) {
    state.globalStyles.fontFamily = customization.fontPreset.fontFamily;
  }
  
  state.pages?.forEach(page => {
    page.components?.forEach(component => {
      if (!component.styles) {
        component.styles = {};
      }
      
      if (customization.colorPreset && component.styles.accentColor) {
        component.styles.accentColor = customization.colorPreset.accentColor;
      }
      
      if (customization.fontPreset) {
        component.styles.fontFamily = customization.fontPreset.fontFamily;
      }
      
      if (customization.businessName) {
        if (component.type === 'header' && component.props?.title) {
          component.props.title = customization.businessName;
        }
        if (component.type === 'footer' && component.props?.title) {
          const footerTitle = String(component.props.title || '');
          component.props.title = footerTitle.replace(/©\s*\d{4}\s*[^.]+\.?/, `© ${new Date().getFullYear()} ${customization.businessName}.`);
        }
      }
    });
  });
  
  return state;
}

export type SerializedCustomization = {
  templateId: string;
  businessName?: string;
  colorPresetId?: string;
  fontPresetId?: string;
};

export function applyCustomizationById(
  templateId: string,
  customization: { businessName?: string; colorPresetId?: string; fontPresetId?: string }
): BuilderStateData | null {
  const template = getTemplateById(templateId);
  if (!template) return null;
  
  const colorPreset = customization.colorPresetId 
    ? colorPresets.find(p => p.id === customization.colorPresetId)
    : undefined;
  const fontPreset = customization.fontPresetId
    ? fontPresets.find(p => p.id === customization.fontPresetId)
    : undefined;
  
  return applyCustomizationToTemplate(template, {
    businessName: customization.businessName,
    colorPreset,
    fontPreset,
  });
}
