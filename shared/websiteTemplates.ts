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
  {
    id: 'mindful-terapi',
    name: 'Mindful Terapi – Psykologklinik',
    description: 'Professionel psykologklinik med booking, tillids-signaler og GDPR-kompatible formularer',
    category: 'services',
    thumbnail: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop',
    builderState: {
      pages: [
        {
          id: 'home',
          name: 'Forside',
          path: '/',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Mindful Terapi',
                items: [
                  { id: '1', title: 'Om mig', description: '/om-mig' },
                  { id: '2', title: 'Behandlinger', description: '/behandlinger' },
                  { id: '3', title: 'Priser', description: '/priser' },
                  { id: '4', title: 'Kontakt', description: '/kontakt' },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#2D5F5D',
                padding: '20px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Professionel psykologhjælp i trygge rammer',
                subtitle: 'Autoriseret psykolog – Katrine Møller Hansen',
                description: 'Akut krise? Ring 112 eller Livslinien 70 201 201 (24/7). Specialiseret i angst, depression og stress. Modtager sundhedskort og forsikringer. Medlem af Dansk Psykolog Forening.',
                buttonText: 'Book gratis 20 min. samtale',
                buttonLink: '/kontakt',
                alignment: 'center',
                imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&h=800&fit=crop',
              },
              styles: {
                backgroundColor: '#F4F1EA',
                textColor: '#1A1A1A',
                padding: '120px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#2D5F5D',
                buttonColor: '#2D5F5D',
                buttonStyle: 'solid',
              },
            },
            {
              id: generateId(),
              type: 'marquee',
              props: {
                items: [
                  { id: '1', title: 'Dansk Psykolog Forening' },
                  { id: '2', title: 'Sundhedsstyrelsen godkendt' },
                  { id: '3', title: 'Alka Forsikring' },
                  { id: '4', title: '4.9/5 på Trustpilot (127 anmeldelser)' },
                  { id: '5', title: '12 års erfaring' },
                ],
              },
              styles: {
                backgroundColor: '#2D5F5D',
                textColor: '#FFFFFF',
                padding: '16px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'features',
              props: {
                title: 'Behandlingsområder',
                subtitle: 'Evidensbaseret hjælp til livets udfordringer',
                items: [
                  { id: '1', title: 'Angst & bekymringer', description: 'KBT-baseret behandling af generaliseret angst, social angst, panikangst og fobier.', icon: '🧠' },
                  { id: '2', title: 'Depression & tristhed', description: 'Støtte ved depression, udbrændthed og eksistentielle kriser.', icon: '💙' },
                  { id: '3', title: 'Stress & udbrændthed', description: 'Kognitiv adfærdsterapi og mindfulness til stresshåndtering.', icon: '⚡' },
                  { id: '4', title: 'Relationer & kriser', description: 'Parterapi, familiekonflikter og livsomvæltninger.', icon: '🤝' },
                  { id: '5', title: 'Personlig udvikling', description: 'Coaching og terapi for selvværd, grænser og livsmål.', icon: '✨' },
                  { id: '6', title: 'Erhvervspsykologi', description: 'Workshops og individuelle forløb for virksomheder.', icon: '🏢' },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#2D5F5D',
              },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Katrine Møller Hansen',
                description: 'Autoriseret psykolog (aut. 8274). Jeg har arbejdet med psykoterapi siden 2012 og specialiserer mig i kognitiv adfærdsterapi (KBT) og mindfulness-baserede metoder. Mit mål er at skabe et trygt rum, hvor du kan udforske dine tanker og følelser uden at føle dig dømt.',
                imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&h=600&fit=crop',
                imageSide: 'right',
              },
              styles: {
                backgroundColor: '#F4F1EA',
                textColor: '#1A1A1A',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'timeline',
              props: {
                title: 'Sådan kommer du i gang',
                subtitle: '',
                items: [
                  { id: '1', year: '01', title: 'Gratis 20 min. samtale', description: 'Vi taler kort om dine udfordringer og mål. Ingen forpligtelser.' },
                  { id: '2', year: '02', title: 'Første session (50 min.)', description: 'Vi går i dybden med din situation og laver en behandlingsplan.' },
                  { id: '3', year: '03', title: 'Forløb efter behov', description: 'De fleste har mellem 8-15 sessioner. Vi evaluerer løbende.' },
                  { id: '4', year: '04', title: 'Opfølgning', description: 'Opfølgningssamtaler efter 3 og 6 måneder for at sikre varig forandring.' },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#2D5F5D',
              },
            },
            {
              id: generateId(),
              type: 'testimonials',
              props: {
                title: 'Hvad mine klienter siger',
                items: [
                  { id: '1', title: 'Maria, 34 år – Stressbehandling', description: 'Katrine hjalp mig igennem en svær periode med arbejdsstress. Hendes konkrete værktøjer og varme tilgang gjorde, at jeg følte mig hørt.', imageUrl: '' },
                  { id: '2', title: 'Thomas, 42 år – Angstbehandling', description: 'Efter mange års angst tog jeg endelig springet. Bedste beslutning! Hun er empatisk, professionel og formår at skabe et trygt rum.', imageUrl: '' },
                  { id: '3', title: 'Line, 28 år – Generel angst', description: 'Jeg var skeptisk over for terapi, men Katrine gjorde det nemt at åbne op. Hendes praktiske tilgang passede perfekt til mig.', imageUrl: '' },
                ],
              },
              styles: {
                backgroundColor: '#F4F1EA',
                textColor: '#1A1A1A',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#2D5F5D',
              },
            },
            {
              id: generateId(),
              type: 'cta',
              props: {
                title: 'Book din gratis 20 min. samtale',
                description: 'Vælg dato og tidspunkt der passer dig. Du modtager bekræftelse på mail.',
                buttonText: 'Book tid nu',
                buttonLink: '/kontakt',
              },
              styles: {
                backgroundColor: '#2D5F5D',
                textColor: '#FFFFFF',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                buttonColor: '#FFFFFF',
                buttonStyle: 'outline',
              },
            },
            {
              id: generateId(),
              type: 'faq',
              props: {
                title: 'Ofte stillede spørgsmål',
                subtitle: '',
                items: [
                  { id: '1', title: 'Hvad er forskellen på en psykolog og en psykiater?', description: 'En psykolog er uddannet i adfærdsvidenskab og anvender samtaleterapi. En psykiater er læge og kan ordinere medicin.' },
                  { id: '2', title: 'Kan jeg få tilskud til psykolog?', description: 'Ja, du kan søge tilskud via sundhedskort med henvisning fra din læge. Mange forsikringer dækker også.' },
                  { id: '3', title: 'Hvor lang tid tager et forløb?', description: 'Det er meget individuelt. Nogle har gavn af 6-8 sessioner, andre har brug for længere forløb.' },
                  { id: '4', title: 'Er det fortroligt?', description: 'Ja, absolut. Jeg har tavshedspligt som autoriseret psykolog. GDPR-kompatibel opbevaring af alle data.' },
                  { id: '5', title: 'Tilbyder du online-sessioner?', description: 'Ja, både fysiske møder i klinikken og sikre videokonsultationer.' },
                  { id: '6', title: 'Hvad koster en session?', description: '20 min. intro: Gratis. 45 min. session: 800 kr. 90 min. session: 1.400 kr.' },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#2D5F5D',
              },
            },
            {
              id: generateId(),
              type: 'cta',
              props: {
                title: 'Tag det første skridt i dag',
                description: 'Du fortjener at have det godt. Lad os finde ud af, hvordan jeg kan hjælpe dig videre.',
                buttonText: 'Book gratis samtale',
                buttonLink: '/kontakt',
              },
              styles: {
                backgroundColor: '#F4F1EA',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#2D5F5D',
                buttonColor: '#2D5F5D',
                buttonStyle: 'solid',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Mindful Terapi. Alle rettigheder forbeholdes.',
                description: 'kontakt@mindfulterapi.dk | +45 31 24 56 78 | CVR: 12345678 | Aut. 8274 | Dansk Psykolog Forening',
              },
              styles: {
                backgroundColor: '#2D5F5D',
                textColor: '#C8D9D8',
                padding: '48px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
          ],
        },
        {
          id: 'om-mig',
          name: 'Om mig',
          path: '/om-mig',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Mindful Terapi',
                items: [
                  { id: '1', title: 'Om mig', description: '/om-mig' },
                  { id: '2', title: 'Behandlinger', description: '/behandlinger' },
                  { id: '3', title: 'Priser', description: '/priser' },
                  { id: '4', title: 'Kontakt', description: '/kontakt' },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#2D5F5D',
                padding: '20px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Om Katrine Møller Hansen',
                subtitle: 'Autoriseret psykolog (aut. 8274)',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#F4F1EA',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Min baggrund',
                description: 'Jeg har arbejdet med psykoterapi siden 2012 og specialiserer mig i kognitiv adfærdsterapi (KBT) og mindfulness-baserede metoder. Efter min kandidatgrad fra Aarhus Universitet har jeg videreuddannet mig løbende og behandlet over 2.000 klienter.\n\nMit arbejde bygger på en grundlæggende tro på, at alle mennesker har ressourcer til forandring. Min rolle er at skabe et trygt rum, hvor disse ressourcer kan folde sig ud. Jeg kombinerer evidensbaserede metoder med en varm, nærværende tilgang.',
                imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=800&fit=crop',
                imageSide: 'left',
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'features',
              props: {
                title: 'Uddannelse & kvalifikationer',
                subtitle: '',
                items: [
                  { id: '1', title: 'Cand.psych., Aarhus Universitet', description: 'Kandidatgrad i psykologi, 2011', icon: '🎓' },
                  { id: '2', title: 'Autoriseret Psykolog', description: 'Godkendt af Psykolognævnet, aut. 8274', icon: '✅' },
                  { id: '3', title: 'Certificeret KBT-terapeut', description: 'Specialisering via Dansk Psykoterapeutforening', icon: '🧠' },
                  { id: '4', title: 'Mindfulness-instruktør', description: 'MBSR/MBCT certificeret', icon: '🧘' },
                ],
              },
              styles: {
                backgroundColor: '#F4F1EA',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#2D5F5D',
              },
            },
            {
              id: generateId(),
              type: 'timeline',
              props: {
                title: 'Karriereforløb',
                subtitle: '',
                items: [
                  { id: '1', year: '2011', title: 'Kandidatgrad fra Aarhus Universitet', description: 'Cand.psych. med speciale i kognitiv adfærdsterapi.' },
                  { id: '2', year: '2013', title: 'Autorisation som psykolog', description: 'Godkendt af Psykolognævnet efter superviseret praksis.' },
                  { id: '3', year: '2016', title: 'Certificeret mindfulness-instruktør', description: 'MBSR/MBCT uddannelse med fokus på stressreduktion.' },
                  { id: '4', year: '2019', title: 'Mindful Terapi grundlagt', description: 'Åbnede egen klinik i København med fokus på angst og stress.' },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#2D5F5D',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Mindful Terapi. Alle rettigheder forbeholdes.',
                description: 'kontakt@mindfulterapi.dk | +45 31 24 56 78 | Vilkår | Privatlivspolitik',
              },
              styles: {
                backgroundColor: '#2D5F5D',
                textColor: '#C8D9D8',
                padding: '48px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
          ],
        },
        {
          id: 'behandlinger',
          name: 'Behandlinger',
          path: '/behandlinger',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Mindful Terapi',
                items: [
                  { id: '1', title: 'Om mig', description: '/om-mig' },
                  { id: '2', title: 'Behandlinger', description: '/behandlinger' },
                  { id: '3', title: 'Priser', description: '/priser' },
                  { id: '4', title: 'Kontakt', description: '/kontakt' },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#2D5F5D',
                padding: '20px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Behandlinger',
                subtitle: 'Skræddersyet hjælp til dine behov',
                description: 'Alle forløb tilpasses individuelt med evidensbaserede metoder.',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#F4F1EA',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'services',
              props: {
                title: 'Behandlingstilbud',
                subtitle: '',
                services: [
                  { id: '1', title: 'Individuel Terapi', description: 'Dybdegående samtaleforløb med fokus på dine personlige udfordringer. 50-60 minutter per session. Typisk 8-15 sessioner.', price: '800 kr', icon: '👤' },
                  { id: '2', title: 'Parterapi', description: 'Styrk jeres relation og kommunikation. Sessioner af 90 minutters varighed med fokus på forståelse og nærhed.', price: '1.400 kr', icon: '💑' },
                  { id: '3', title: 'Stresshåndtering', description: 'Intensivt forløb med fokus på at genvinde balance. Inkluderer praktiske værktøjer og øvelser til hverdagen.', price: '800 kr', icon: '🧘' },
                  { id: '4', title: 'Angstbehandling', description: 'Evidensbaseret kognitiv terapi målrettet angst, OCD og panikangst. Gradvis eksponering og tankemæssig omstrukturering.', price: '800 kr', icon: '🌿' },
                  { id: '5', title: 'Online Terapi', description: 'Samme kvalitet hjemmefra. Fleksible tider via sikker videoplatform. Perfekt hvis du bor langt væk eller har travlt.', price: '700 kr', icon: '💻' },
                  { id: '6', title: 'Gratis Forsamtale', description: '20 minutters uforpligtende telefonsamtale hvor vi afklarer dine behov og om vi er et godt match.', price: 'Gratis', icon: '📞' },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#2D5F5D',
              },
            },
            {
              id: generateId(),
              type: 'faq',
              props: {
                title: 'Spørgsmål om behandling',
                subtitle: '',
                items: [
                  { id: '1', title: 'Hvor lang tid tager et forløb?', description: 'Det varierer meget. Nogle har gavn af 6-8 sessioner, mens andre har brug for længere forløb. Vi evaluerer løbende sammen.' },
                  { id: '2', title: 'Hvad sker der i den første session?', description: 'Vi taler om din situation, dine mål og laver sammen en behandlingsplan. Du bestemmer altid selv tempoet.' },
                  { id: '3', title: 'Kan jeg skifte behandlingstype undervejs?', description: 'Ja, behandlingen tilpasses altid dine aktuelle behov. Vi justerer løbende.' },
                  { id: '4', title: 'Er der ventetid?', description: 'Aktuelt kan jeg tilbyde tid inden for 1-2 uger. Ved akutte behov forsøger jeg altid at finde en hurtig løsning.' },
                ],
              },
              styles: {
                backgroundColor: '#F4F1EA',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#2D5F5D',
              },
            },
            {
              id: generateId(),
              type: 'cta',
              props: {
                title: 'Klar til at tage det første skridt?',
                description: 'Book en gratis 20 minutters forsamtale og lad os finde ud af, hvordan jeg bedst kan hjælpe dig.',
                buttonText: 'Book gratis forsamtale',
                buttonLink: '/kontakt',
              },
              styles: {
                backgroundColor: '#2D5F5D',
                textColor: '#FFFFFF',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                buttonColor: '#FFFFFF',
                buttonStyle: 'outline',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Mindful Terapi. Alle rettigheder forbeholdes.',
                description: 'kontakt@mindfulterapi.dk | +45 31 24 56 78 | Vilkår | Privatlivspolitik',
              },
              styles: {
                backgroundColor: '#2D5F5D',
                textColor: '#C8D9D8',
                padding: '48px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
          ],
        },
        {
          id: 'priser',
          name: 'Priser',
          path: '/priser',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Mindful Terapi',
                items: [
                  { id: '1', title: 'Om mig', description: '/om-mig' },
                  { id: '2', title: 'Behandlinger', description: '/behandlinger' },
                  { id: '3', title: 'Priser', description: '/priser' },
                  { id: '4', title: 'Kontakt', description: '/kontakt' },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#2D5F5D',
                padding: '20px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Priser & Forsikring',
                subtitle: 'Gennemsigtige priser uden skjulte omkostninger',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#F4F1EA',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'pricing-table',
              props: {
                title: 'Vælg den rette behandling',
                subtitle: '',
                plans: [
                  { id: '1', name: 'Forsamtale', price: 'Gratis', period: '20 min.', features: ['Telefonsamtale', 'Afklaring af behov', 'Uforpligtende', 'Svar inden 24 timer'], highlighted: false },
                  { id: '2', name: 'Individuel session', price: '800 kr', period: '45 min.', features: ['Personlig terapi', 'Evidensbaserede metoder', 'Fleksible tider', 'Online eller fysisk'], highlighted: true },
                  { id: '3', name: 'Udvidet session', price: '1.400 kr', period: '90 min.', features: ['Parterapi', 'Dybdegående samtale', 'Inkl. øvelser', 'Opfølgningsplan'], highlighted: false },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#2D5F5D',
              },
            },
            {
              id: generateId(),
              type: 'split-section',
              props: {
                title: 'Forsikring & tilskud',
                description: 'Mange sundhedsforsikringer dækker psykologbehandling. Jeg er godkendt af de fleste forsikringsselskaber. Du kan også søge tilskud via sundhedskort med henvisning fra din læge.',
                bullets: [
                  { text: 'Godkendt af Sygeforsikringen "danmark"' },
                  { text: 'Dækket af de fleste sundhedsforsikringer' },
                  { text: 'Tilskud via sundhedskort med lægehenvisning' },
                  { text: 'Afbud senest 24 timer før – ellers fuld pris' },
                ],
                imageUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=400&fit=crop',
              },
              styles: {
                backgroundColor: '#F4F1EA',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'faq',
              props: {
                title: 'Spørgsmål om priser',
                subtitle: '',
                items: [
                  { id: '1', title: 'Dækker min sundhedsforsikring?', description: 'Ja, mange sundhedsforsikringer dækker psykologhjælp. Jeg er godkendt af de fleste forsikringsselskaber. Tjek din police eller kontakt mig.' },
                  { id: '2', title: 'Hvad hvis jeg må aflyse?', description: 'Afbud skal ske senest 24 timer før aftalt tid. Ved senere afbud opkræves fuld pris.' },
                  { id: '3', title: 'Kan jeg betale med MobilePay?', description: 'Ja, du kan betale med MobilePay, bankoverførsel eller kort.' },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#2D5F5D',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Mindful Terapi. Alle rettigheder forbeholdes.',
                description: 'kontakt@mindfulterapi.dk | +45 31 24 56 78 | Vilkår | Privatlivspolitik',
              },
              styles: {
                backgroundColor: '#2D5F5D',
                textColor: '#C8D9D8',
                padding: '48px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
          ],
        },
        {
          id: 'kontakt',
          name: 'Kontakt',
          path: '/kontakt',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'Mindful Terapi',
                items: [
                  { id: '1', title: 'Om mig', description: '/om-mig' },
                  { id: '2', title: 'Behandlinger', description: '/behandlinger' },
                  { id: '3', title: 'Priser', description: '/priser' },
                  { id: '4', title: 'Kontakt', description: '/kontakt' },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#2D5F5D',
                padding: '20px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Kontakt',
                subtitle: 'Jeg ser frem til at høre fra dig',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#F4F1EA',
                textColor: '#1A1A1A',
                padding: '60px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'split-section',
              props: {
                title: 'Praktisk information',
                description: 'Klinikken ligger centralt i København med gode transportmuligheder. Der er elevator i bygningen.',
                bullets: [
                  { text: 'Adresse: Studiestræde 38, 2. sal, 1455 København K' },
                  { text: 'Telefon: +45 31 24 56 78 (man-fre 9-17)' },
                  { text: 'Email: kontakt@mindfulterapi.dk' },
                  { text: 'CVR: 12345678' },
                ],
                imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop',
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
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
                backgroundColor: '#F4F1EA',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#2D5F5D',
                buttonColor: '#2D5F5D',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Mindful Terapi. Alle rettigheder forbeholdes.',
                description: 'kontakt@mindfulterapi.dk | +45 31 24 56 78 | CVR: 12345678 | Aut. 8274 | Dansk Psykolog Forening',
              },
              styles: {
                backgroundColor: '#2D5F5D',
                textColor: '#C8D9D8',
                padding: '48px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
          ],
        },
      ],
      activePage: 'home',
      globalStyles: {
        primaryColor: '#2D5F5D',
        secondaryColor: '#F4F1EA',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: '#FFFFFF',
      },
    },
  },
  {
    id: 'aurora-skincare',
    name: 'Aurora Skincare – Premium Serum',
    description: 'Single-product DTC webshop med urgency, social proof og videnskabeligt indhold',
    category: 'ecommerce',
    thumbnail: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=300&fit=crop',
    builderState: {
      pages: [
        {
          id: 'home',
          name: 'Forside',
          path: '/',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'AURORA SKINCARE',
                items: [
                  { id: '1', title: 'Produkt', description: '/produkt' },
                  { id: '2', title: 'Abonnement', description: '/abonnement' },
                  { id: '3', title: 'Om os', description: '/om-os' },
                ],
                showCart: true,
              },
              styles: {
                backgroundColor: '#1A1A1A',
                textColor: '#F7F5F2',
                padding: '20px 48px',
                fontFamily: 'Playfair Display, serif',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Reducer rynker med 34% på 8 uger',
                subtitle: '★★★★★ Over 12.000 tilfredse kunder',
                description: 'Vores prisbelønnede Vitamin C serum til 499 kr (før 649 kr). Kun 47 stk. tilbage på lager. Gratis fragt + 2 gratis prøver ved køb i dag.',
                buttonText: 'Køb nu – 499 kr',
                buttonLink: '/produkt',
                alignment: 'center',
                imageUrl: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1400&h=800&fit=crop',
              },
              styles: {
                backgroundColor: '#1A1A1A',
                textColor: '#F7F5F2',
                padding: '140px 48px',
                fontFamily: 'Playfair Display, serif',
                accentColor: '#C9A86A',
                buttonColor: '#C9A86A',
                buttonStyle: 'solid',
              },
            },
            {
              id: generateId(),
              type: 'marquee',
              props: {
                items: [
                  { id: '1', title: 'Klinisk testet i 12 uger' },
                  { id: '2', title: '15% rent Vitamin C' },
                  { id: '3', title: 'Dermatolog-godkendt' },
                  { id: '4', title: '+12.000 anmeldelser' },
                  { id: '5', title: 'CO2-neutral levering' },
                  { id: '6', title: 'Produceret i Danmark' },
                ],
              },
              styles: {
                backgroundColor: '#C9A86A',
                textColor: '#1A1A1A',
                padding: '16px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'split-section',
              props: {
                title: 'Træthedstegn, rynker og ujævn hudtone?',
                description: 'Hver dag udsættes din hud for sollys, forurening og stress. Aurora Vitamin C Serum bruger 15% L-Ascorbinsyre i en pH-optimeret formel der trænger dybt ind i huden.',
                bullets: [
                  { text: 'Rynkedybde: -34% efter 8 uger' },
                  { text: 'Hudens fasthed: +41% efter 8 uger' },
                  { text: 'Pigmentpletter: -28% efter 8 uger' },
                  { text: 'Klinisk studie med 127 deltagere, 2023' },
                ],
                imageUrl: 'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=600&h=400&fit=crop',
              },
              styles: {
                backgroundColor: '#F7F5F2',
                textColor: '#1A1A1A',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'features',
              props: {
                title: 'Fordele ved Aurora Vitamin C Serum',
                subtitle: 'Videnskabeligt dokumenteret hudpleje',
                items: [
                  { id: '1', title: 'Lysere & mere ensartet hud', description: 'Reducer pigmentpletter og ujævn hudtone med potent Vitamin C.', icon: '☀️' },
                  { id: '2', title: 'Dyb hydrering', description: 'Hyaluronsyre og glycerin låser fugt inde i huden hele dagen.', icon: '💧' },
                  { id: '3', title: 'Beskytter mod frie radikaler', description: 'Potent antioxidant-formel neutraliserer miljøskader.', icon: '🛡️' },
                  { id: '4', title: 'Booster kollagen', description: 'Stimulerer hudens naturlige kollagenproduktion for fastere hud.', icon: '⚡' },
                  { id: '5', title: 'Ren & sikker formel', description: 'Uden parabener, sulfater, silikoner. Vegansk og cruelty-free.', icon: '🌿' },
                  { id: '6', title: 'Stabiliseret formel', description: 'Patenteret forsegling beskytter mod oxidation for længere holdbarhed.', icon: '🧪' },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#C9A86A',
              },
            },
            {
              id: generateId(),
              type: 'timeline',
              props: {
                title: 'Sådan bruger du Aurora Vitamin C Serum',
                subtitle: '',
                items: [
                  { id: '1', year: '01', title: 'Rens din hud', description: 'Start med en mild rensegel for at fjerne snavs og makeup.' },
                  { id: '2', year: '02', title: 'Påfør 3-4 dråber', description: 'Fordel serumet jævnt på ansigt, hals og dekolletage.' },
                  { id: '3', year: '03', title: 'Lås fugt inde', description: 'Følg op med fugtighedscreme og SPF om morgenen.' },
                ],
              },
              styles: {
                backgroundColor: '#F7F5F2',
                textColor: '#1A1A1A',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#C9A86A',
              },
            },
            {
              id: generateId(),
              type: 'testimonials',
              props: {
                title: 'Over 12.000 kvinder elsker Aurora',
                items: [
                  { id: '1', title: 'Sophie, 38 år – Verificeret køb', description: 'Jeg har aldrig troet på serums før, men dette har virkelig forandret min hud! Resultaterne kom allerede efter 2 uger.', imageUrl: '' },
                  { id: '2', title: 'Maria L. – Verificeret køb', description: 'Min hud føles fastere og ser friskere ud. Jeg får konstant komplimenter fra veninder og kolleger!', imageUrl: '' },
                  { id: '3', title: 'Camilla, 42 år – Verificeret køb', description: 'Endelig et serum der ikke irriterer min sensitive hud. Fantastisk produkt.', imageUrl: '' },
                  { id: '4', title: 'Anne K. – Verificeret køb', description: 'Rigtig godt produkt! Lidt dyrt, men kvaliteten er i top og det holder længe.', imageUrl: '' },
                  { id: '5', title: 'Louise, 31 år – Verificeret køb', description: 'Bedste køb i år! Min hud er blevet så meget mere glødende og ensartet.', imageUrl: '' },
                ],
              },
              styles: {
                backgroundColor: '#1A1A1A',
                textColor: '#F7F5F2',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#C9A86A',
              },
            },
            {
              id: generateId(),
              type: 'faq',
              props: {
                title: 'Hvad er der i flasken?',
                subtitle: 'Ingredienser',
                items: [
                  { id: '1', title: 'L-Ascorbinsyre (Vitamin C) – 15%', description: 'Den mest potente og videnskabeligt dokumenterede form for Vitamin C. Lysner huden og booster kollagen.' },
                  { id: '2', title: 'Hyaluronsyre – 2%', description: 'Tiltrækker og binder fugt for plump, hydreret hud hele dagen.' },
                  { id: '3', title: 'Vitamin E (Tocopherol) – 1%', description: 'Antioxidant der forstærker Vitamin C\'s effekt og beskytter mod frie radikaler.' },
                  { id: '4', title: 'Ferulasyre – 0.5%', description: 'Plantebaseret antioxidant fra ris der stabiliserer formlen.' },
                  { id: '5', title: 'Panthenol (ProVitamin B5) – 2%', description: 'Beroligende og fugtighedsgivende ingrediens for sensitiv hud.' },
                ],
              },
              styles: {
                backgroundColor: '#F7F5F2',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#C9A86A',
              },
            },
            {
              id: generateId(),
              type: 'comparison-table',
              props: {
                title: 'Hvorfor Aurora er anderledes',
                subtitle: '',
                tableColumns: [
                  { id: '1', label: 'Aurora (499 kr)', highlighted: true },
                  { id: '2', label: 'Generisk mærke (299 kr)', highlighted: false },
                  { id: '3', label: 'Premium mærke (899 kr)', highlighted: false },
                ],
                features: [
                  { id: '1', name: 'Vitamin C koncentration', values: ['15% L-Ascorbinsyre', '5-10% ustabil', '10-15%'] },
                  { id: '2', name: 'Stabiliseret formel', values: ['✓', '✗', '✓'] },
                  { id: '3', name: 'Klinisk testet', values: ['✓', '✗', 'Delvist'] },
                  { id: '4', name: 'Produceret i Danmark', values: ['✓', '✗', '✗'] },
                  { id: '5', name: 'Pengene-tilbage garanti', values: ['30 dage', '14 dage', '14 dage'] },
                  { id: '6', name: 'Pris per ml', values: ['16,6 kr/ml', '15 kr/ml', '29,9 kr/ml'] },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#C9A86A',
              },
            },
            {
              id: generateId(),
              type: 'split-section',
              props: {
                title: 'Elsker du det ikke? Få pengene tilbage.',
                description: '30 dages pengene-tilbage garanti uden spørgsmål. Vi er så sikre på Aurora Vitamin C Serum, at vi tilbyder fuld refundering.',
                bullets: [
                  { text: 'Prøv risikofrit i 30 dage' },
                  { text: 'Gratis returfragt' },
                  { text: 'Ingen spørgsmål stillet' },
                  { text: 'Fuld refundering inden for 24 timer' },
                ],
                imageUrl: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=600&h=400&fit=crop',
              },
              styles: {
                backgroundColor: '#F7F5F2',
                textColor: '#1A1A1A',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'faq',
              props: {
                title: 'Spørgsmål? Vi har svarene.',
                subtitle: '',
                items: [
                  { id: '1', title: 'Hvor hurtigt ser jeg resultater?', description: 'De fleste ser forbedring i hudtone inden for 2-3 uger. For dybere anti-aging effekter anbefaler vi 8-12 uger.' },
                  { id: '2', title: 'Er det sikkert for sensitiv hud?', description: 'Ja, formlen er dermatolog-testet og pH-optimeret. Start langsomt den første uge.' },
                  { id: '3', title: 'Hvor længe holder en flaske?', description: 'En 30ml flaske holder typisk 2-3 måneder ved daglig brug.' },
                  { id: '4', title: 'Er det testet på dyr?', description: 'Nej, aldrig. Aurora er 100% cruelty-free og certificeret vegansk.' },
                  { id: '5', title: 'Hvad er jeres returpolitik?', description: 'Fuld refundering inden for 30 dage – ingen spørgsmål. Vi betaler returfragten.' },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#C9A86A',
              },
            },
            {
              id: generateId(),
              type: 'cta',
              props: {
                title: 'Klar til yngre, mere strålende hud?',
                description: 'Prøv Aurora risikofrit i 30 dage. 12.000+ kvinder stoler allerede på os. Kun 47 tilbage på lager – gratis fragt + 2 gratis prøver i dag.',
                buttonText: 'Køb nu – 30 dages pengene-tilbage',
                buttonLink: '/produkt',
              },
              styles: {
                backgroundColor: '#1A1A1A',
                textColor: '#F7F5F2',
                padding: '80px 48px',
                fontFamily: 'Playfair Display, serif',
                accentColor: '#C9A86A',
                buttonColor: '#C9A86A',
                buttonStyle: 'solid',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Aurora Skincare. Alle rettigheder forbeholdes.',
                description: 'info@auroraSkincare.dk | CVR: 87654321 | Vegansk | Cruelty-free | Dansk produceret',
              },
              styles: {
                backgroundColor: '#1A1A1A',
                textColor: '#6b7280',
                padding: '48px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
          ],
        },
        {
          id: 'produkt',
          name: 'Produkt',
          path: '/produkt',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'AURORA SKINCARE',
                items: [
                  { id: '1', title: 'Produkt', description: '/produkt' },
                  { id: '2', title: 'Abonnement', description: '/abonnement' },
                  { id: '3', title: 'Om os', description: '/om-os' },
                ],
                showCart: true,
              },
              styles: {
                backgroundColor: '#1A1A1A',
                textColor: '#F7F5F2',
                padding: '20px 48px',
                fontFamily: 'Playfair Display, serif',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Aurora Vitamin C Serum',
                subtitle: '30ml – Klinisk testet',
                description: 'Vores bestseller med 15% L-Ascorbinsyre, Hyaluronsyre og Vitamin E. Dermatolog-godkendt og produceret i Danmark.',
                buttonText: 'Læg i kurv – 499 kr',
                buttonLink: '#',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#F7F5F2',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Playfair Display, serif',
                accentColor: '#C9A86A',
                buttonColor: '#C9A86A',
                buttonStyle: 'solid',
              },
            },
            {
              id: generateId(),
              type: 'product-grid',
              props: {
                title: 'Vores produkter',
                subtitle: '',
                columns: 3,
                productLimit: 6,
                showAddToCart: true,
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#C9A86A',
                cardStyle: 'flat',
              },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Ingredienser du kan stole på',
                description: 'Fuld ingrediensliste: Aqua, L-Ascorbic Acid (15%), Propanediol, Sodium Hyaluronate, Tocopherol, Ferulic Acid, Panthenol, Glycerin, Pentylene Glycol, Citric Acid, Sodium Hydroxide. Alle ingredienser er nøje udvalgt for maksimal effekt og minimal irritation.',
                imageUrl: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&h=600&fit=crop',
                imageSide: 'left',
              },
              styles: {
                backgroundColor: '#F7F5F2',
                textColor: '#1A1A1A',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'testimonials',
              props: {
                title: 'Kunderne taler',
                items: [
                  { id: '1', title: 'Sophie, 38 år', description: 'Jeg har aldrig troet på serums før, men dette har virkelig forandret min hud!', imageUrl: '' },
                  { id: '2', title: 'Maria L.', description: 'Min hud føles fastere og ser friskere ud. Jeg får konstant komplimenter!', imageUrl: '' },
                  { id: '3', title: 'Louise, 31 år', description: 'Bedste køb i år! Min hud er blevet så meget mere glødende.', imageUrl: '' },
                ],
              },
              styles: {
                backgroundColor: '#1A1A1A',
                textColor: '#F7F5F2',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#C9A86A',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Aurora Skincare. Alle rettigheder forbeholdes.',
                description: 'info@auroraSkincare.dk | CVR: 87654321 | Vilkår | Privatlivspolitik',
              },
              styles: {
                backgroundColor: '#1A1A1A',
                textColor: '#6b7280',
                padding: '48px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
          ],
        },
        {
          id: 'abonnement',
          name: 'Abonnement',
          path: '/abonnement',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'AURORA SKINCARE',
                items: [
                  { id: '1', title: 'Produkt', description: '/produkt' },
                  { id: '2', title: 'Abonnement', description: '/abonnement' },
                  { id: '3', title: 'Om os', description: '/om-os' },
                ],
                showCart: true,
              },
              styles: {
                backgroundColor: '#1A1A1A',
                textColor: '#F7F5F2',
                padding: '20px 48px',
                fontFamily: 'Playfair Display, serif',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Abonnement – Spar 15%',
                subtitle: 'Aldrig løb tør for dit yndlingsserum',
                description: 'Fleksibel levering direkte til din dør. Spring over eller pause når som helst.',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#F7F5F2',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Playfair Display, serif',
                accentColor: '#C9A86A',
              },
            },
            {
              id: generateId(),
              type: 'pricing-table',
              props: {
                title: 'Vælg din plan',
                subtitle: '',
                plans: [
                  { id: '1', name: 'Engangskøb', price: '499 kr', period: 'enkelt', features: ['30ml Vitamin C Serum', 'Gratis fragt', '30 dages garanti', '2 gratis prøver'], highlighted: false },
                  { id: '2', name: 'Abonnement', price: '424 kr', period: 'hver 2. måned', features: ['30ml Vitamin C Serum', 'Spar 15% altid', 'Gratis fragt', 'Spring over eller pause', 'Eksklusiv adgang til nye produkter', 'Loyalitetsbelønninger'], highlighted: true },
                  { id: '3', name: '3-pak Bundt', price: '1.197 kr', period: 'engangskøb', features: ['3x 30ml Vitamin C Serum', 'Spar 300 kr', 'Gratis fragt', '30 dages garanti', 'Gratis opbevaringsetui'], highlighted: false },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#C9A86A',
              },
            },
            {
              id: generateId(),
              type: 'features',
              props: {
                title: 'Fordele ved abonnement',
                subtitle: '',
                items: [
                  { id: '1', title: 'Spar 15% hver gang', description: 'Automatisk rabat på alle leveringer som abonnent.', icon: '💰' },
                  { id: '2', title: 'Fleksibel levering', description: 'Vælg leveringsfrekvens der passer til dit forbrug.', icon: '📦' },
                  { id: '3', title: 'Spring over eller pause', description: 'Fuld kontrol – juster, pause eller annuller når som helst.', icon: '⏸️' },
                  { id: '4', title: 'Eksklusiv tidlig adgang', description: 'Vær den første til at prøve nye produkter.', icon: '⭐' },
                ],
              },
              styles: {
                backgroundColor: '#F7F5F2',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#C9A86A',
              },
            },
            {
              id: generateId(),
              type: 'faq',
              props: {
                title: 'Spørgsmål om abonnement',
                subtitle: '',
                items: [
                  { id: '1', title: 'Kan jeg annullere når som helst?', description: 'Ja, du kan annullere, pause eller ændre dit abonnement når som helst med et enkelt klik.' },
                  { id: '2', title: 'Hvor ofte bliver jeg opkrævet?', description: 'Du vælger selv frekvensen – typisk hver 2. eller 3. måned afhængig af dit forbrug.' },
                  { id: '3', title: 'Hvad hvis jeg har for meget produkt?', description: 'Du kan nemt springe en levering over eller ændre frekvensen i din konto.' },
                ],
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#C9A86A',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Aurora Skincare. Alle rettigheder forbeholdes.',
                description: 'info@auroraSkincare.dk | CVR: 87654321 | Vilkår | Privatlivspolitik',
              },
              styles: {
                backgroundColor: '#1A1A1A',
                textColor: '#6b7280',
                padding: '48px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
          ],
        },
        {
          id: 'om-os',
          name: 'Om os',
          path: '/om-os',
          components: [
            {
              id: generateId(),
              type: 'header',
              props: {
                title: 'AURORA SKINCARE',
                items: [
                  { id: '1', title: 'Produkt', description: '/produkt' },
                  { id: '2', title: 'Abonnement', description: '/abonnement' },
                  { id: '3', title: 'Om os', description: '/om-os' },
                ],
                showCart: true,
              },
              styles: {
                backgroundColor: '#1A1A1A',
                textColor: '#F7F5F2',
                padding: '20px 48px',
                fontFamily: 'Playfair Display, serif',
              },
            },
            {
              id: generateId(),
              type: 'hero',
              props: {
                title: 'Vores historie',
                subtitle: 'Videnskab møder natur',
                description: 'Aurora Skincare blev grundlagt med én mission: at skabe hudpleje der virker, baseret på videnskab – ikke tomme løfter.',
                alignment: 'center',
              },
              styles: {
                backgroundColor: '#F7F5F2',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Playfair Display, serif',
              },
            },
            {
              id: generateId(),
              type: 'text-image',
              props: {
                title: 'Fra laboratoriet til din hud',
                description: 'Aurora Skincare blev grundlagt i 2020 af et team af danske dermatologer og kemikere med en fælles frustration: hudplejemarkedet var fyldt med tomme løfter og overprisede produkter. Vi besluttede at gøre det anderledes – at skabe produkter baseret på klinisk forskning, med ærlig kommunikation om hvad de kan og ikke kan.',
                imageUrl: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800&h=600&fit=crop',
                imageSide: 'right',
              },
              styles: {
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                padding: '100px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
            {
              id: generateId(),
              type: 'stats-counter',
              props: {
                title: 'Aurora i tal',
                stats: [
                  { id: '1', value: '12000', label: 'Tilfredse kunder', suffix: '+' },
                  { id: '2', value: '4.8', label: 'Gennemsnitsrating', suffix: '/5' },
                  { id: '3', value: '30', label: 'Dages garanti', suffix: '' },
                  { id: '4', value: '100', label: 'Dansk produceret', suffix: '%' },
                ],
              },
              styles: {
                backgroundColor: '#1A1A1A',
                textColor: '#F7F5F2',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#C9A86A',
              },
            },
            {
              id: generateId(),
              type: 'timeline',
              props: {
                title: 'Milepæle',
                subtitle: '',
                items: [
                  { id: '1', year: '2020', title: 'Aurora grundlagt', description: 'Startet af et team af danske dermatologer og kemikere i København.' },
                  { id: '2', year: '2021', title: 'Vitamin C Serum lanceret', description: 'Vores debutprodukt efter 18 måneders forskning og kliniske tests.' },
                  { id: '3', year: '2023', title: '10.000 kunder', description: 'Passerede 10.000 tilfredse kunder og 4.8/5 i gennemsnitsrating.' },
                  { id: '4', year: '2024', title: 'CO2-neutral produktion', description: 'Alle processer er nu fuldt CO2-neutrale med bæredygtig emballage.' },
                ],
              },
              styles: {
                backgroundColor: '#F7F5F2',
                textColor: '#1A1A1A',
                padding: '80px 48px',
                fontFamily: 'Inter, sans-serif',
                accentColor: '#C9A86A',
              },
            },
            {
              id: generateId(),
              type: 'footer',
              props: {
                title: '© 2024 Aurora Skincare. Alle rettigheder forbeholdes.',
                description: 'info@auroraSkincare.dk | CVR: 87654321 | Vegansk | Cruelty-free | Dansk produceret',
              },
              styles: {
                backgroundColor: '#1A1A1A',
                textColor: '#6b7280',
                padding: '48px 48px',
                fontFamily: 'Inter, sans-serif',
              },
            },
          ],
        },
      ],
      activePage: 'home',
      globalStyles: {
        primaryColor: '#C9A86A',
        secondaryColor: '#1A1A1A',
        fontFamily: 'Playfair Display, serif',
        backgroundColor: '#F7F5F2',
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
