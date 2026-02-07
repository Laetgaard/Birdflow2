/**
 * Danish-language website templates for SaaSify builder.
 *
 * Template 1: Mindful Terapi – Psychology Clinic
 * Template 2: Aurora Skincare – Single-Product Ecommerce
 */

import type { DesignPreset } from "./designPresets";

// ── Design presets for the two templates ────────────────────────────

export const psychologyClinicDesign: DesignPreset = {
  id: "psychology-clinic",
  name: "Mindful Terapi",
  description: "Warm, professional design for mental health services",
  designSystem: {
    colors: {
      primary: "#2D5F5D",
      secondary: "#F4F1EA",
      accent: "#D4A574",
      background: "#FFFFFF",
      surface: "#F4F1EA",
      text: "#1A1A1A",
    },
    typography: {
      headingFont: "Inter",
      bodyFont: "Inter",
      scale: "modern" as const,
    },
    spacing: {
      section: "airy" as const,
      component: "normal" as const,
    },
    radius: "soft" as const,
    shadow: "subtle" as const,
    motion: {
      style: "subtle" as const,
      speed: "normal" as const,
    },
    tone: "corporate" as const,
  },
};

export const auroraSkincareDesign: DesignPreset = {
  id: "aurora-skincare",
  name: "Aurora Skincare",
  description: "Luxurious, science-driven design for premium DTC ecommerce",
  designSystem: {
    colors: {
      primary: "#1A1A1A",
      secondary: "#F7F5F2",
      accent: "#C9A86A",
      background: "#FFFFFF",
      surface: "#F7F5F2",
      text: "#1A1A1A",
    },
    typography: {
      headingFont: "Playfair Display",
      bodyFont: "Inter",
      scale: "editorial" as const,
    },
    spacing: {
      section: "airy" as const,
      component: "normal" as const,
    },
    radius: "none" as const,
    shadow: "subtle" as const,
    motion: {
      style: "subtle" as const,
      speed: "slow" as const,
    },
    tone: "luxury" as const,
  },
};

// ── Template page & section definitions ─────────────────────────────

export interface TemplateSectionDef {
  type: string;
  component: string;
  headline?: string;
  content: Record<string, unknown>;
}

export interface TemplatePageDef {
  name: string;
  path: string;
  sections: TemplateSectionDef[];
}

export interface DanishTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  design: DesignPreset;
  pages: TemplatePageDef[];
}

// ── Template 1: Mindful Terapi ──────────────────────────────────────

const psychologyPages: TemplatePageDef[] = [
  {
    name: "Forside",
    path: "/",
    sections: [
      {
        type: "hero",
        component: "Hero",
        headline: "Professionel psykologhjælp i trygge rammer",
        content: {
          alertText:
            "Akut krise? Ring 112 eller Livslinien 70 201 201 (24/7)",
          subheadline:
            "Autoriseret psykolog med 12 års erfaring. Specialiseret i angst, depression og stress. Modtager sundhedskort og forsikringer.",
          primaryCTA: "Book gratis 20 min. samtale",
          secondaryCTA: "Se mine specialer",
          trustBadge: "Medlem af Dansk Psykolog Forening",
        },
      },
      {
        type: "trust-bar",
        component: "LogoGrid",
        content: {
          items: [
            "Dansk Psykolog Forening",
            "Sundhedsstyrelsen",
            "Alka forsikring",
          ],
          rating: "4.9/5 på Trustpilot (127 anmeldelser)",
        },
      },
      {
        type: "features",
        component: "FeatureGrid",
        headline: "Behandlingsområder",
        content: {
          columns: 3,
          items: [
            {
              icon: "brain",
              headline: "Angst & bekymringer",
              text: "KBT-baseret behandling af generaliseret angst, social angst, panikangst og fobier.",
            },
            {
              icon: "message-circle",
              headline: "Depression & tristhed",
              text: "Støtte ved depression, udbrændthed og eksistentielle kriser.",
            },
            {
              icon: "zap",
              headline: "Stress & udbrændthed",
              text: "Kognitiv adfærdsterapi og mindfulness til stresshåndtering.",
            },
            {
              icon: "heart",
              headline: "Relationer & kriser",
              text: "Parterapi, familiekonflikter og livsomvæltninger.",
            },
            {
              icon: "target",
              headline: "Personlig udvikling",
              text: "Coaching og terapi for selvværd, grænser og livsmål.",
            },
            {
              icon: "building",
              headline: "Erhvervspsykologi",
              text: "Workshops og individuelle forløb for virksomheder.",
            },
          ],
        },
      },
      {
        type: "about",
        component: "ContentBlock",
        headline: "Katrine Møller Hansen",
        content: {
          eyebrow: "Om mig",
          subheadline: "Autoriseret psykolog (aut. 8274)",
          body: "Jeg har arbejdet med psykoterapi siden 2012 og specialiserer mig i kognitiv adfærdsterapi (KBT) og mindfulness-baserede metoder.",
          credentials: [
            "Cand.psych., Aarhus Universitet (2011)",
            "Specialisering i KBT, Dansk Psykoterapeutforening",
            "Certificeret mindfulness-instruktør (MBSR/MBCT)",
            "12 års erfaring med angst, depression og trauma",
          ],
          cta: "Book en uforpligtende samtale",
          layout: "split-50-50",
        },
      },
      {
        type: "process",
        component: "ProcessSteps",
        headline: "Sådan kommer du i gang",
        content: {
          steps: [
            {
              number: "01",
              headline: "Gratis 20 min. samtale",
              text: "Vi taler kort om dine udfordringer og mål. Ingen forpligtelser.",
            },
            {
              number: "02",
              headline: "Første session (50 min.)",
              text: "Vi går i dybden med din situation og laver en behandlingsplan.",
            },
            {
              number: "03",
              headline: "Forløb efter behov",
              text: "De fleste har mellem 8-15 sessioner. Vi evaluerer løbende.",
            },
            {
              number: "04",
              headline: "Opfølgning",
              text: "Opfølgningssamtaler efter 3 og 6 måneder.",
            },
          ],
        },
      },
      {
        type: "testimonials",
        component: "TestimonialSlider",
        headline: "Hvad mine klienter siger",
        content: {
          items: [
            {
              quote:
                "Katrine hjalp mig igennem en svær periode med arbejdsstress. Hendes konkrete værktøjer og varme tilgang gjorde, at jeg følte mig hørt.",
              name: "Maria, 34 år",
              context: "Stressbehandling, 12 sessioner",
              rating: 5,
            },
            {
              quote:
                "Efter mange års angst tog jeg endelig springet. Bedste beslutning! Hun er empatisk, professionel og formår at skabe et trygt rum.",
              name: "Thomas, 42 år",
              context: "Angstbehandling, 10 sessioner",
              rating: 5,
            },
            {
              quote:
                "Jeg var skeptisk over for terapi, men Katrine gjorde det nemt at åbne op. Hendes praktiske tilgang passede perfekt til mig.",
              name: "Line, 28 år",
              context: "Generel angst, 8 sessioner",
              rating: 5,
            },
          ],
        },
      },
      {
        type: "booking",
        component: "BookingForm",
        headline: "Book din gratis 20 min. samtale",
        content: {
          subheadline:
            "Vælg dato og tidspunkt der passer dig. Du modtager bekræftelse på mail.",
          fields: ["name", "email", "phone", "sessionType", "message"],
          sessionTypes: [
            "Første gratis samtale",
            "Almindelig session (50 min.)",
            "Parbehandling",
          ],
          pricing: [
            { label: "Første samtale", price: "Gratis" },
            { label: "Session (45 min.)", price: "800 kr" },
          ],
          gdprConsent: true,
        },
      },
      {
        type: "faq",
        component: "FAQ",
        headline: "Ofte stillede spørgsmål",
        content: {
          items: [
            {
              question:
                "Hvad er forskellen på en psykolog og en psykiater?",
              answer:
                "En psykolog er uddannet i adfærdsvidenskab og anvender samtaleterapi. En psykiater er læge og kan ordinere medicin.",
            },
            {
              question: "Kan jeg få tilskud til psykolog?",
              answer:
                "Ja, du kan søge tilskud via sundhedskort med henvisning fra din læge. Mange forsikringer dækker også.",
            },
            {
              question: "Hvor lang tid tager et forløb?",
              answer:
                "Det er meget individuelt. Nogle har gavn af 6-8 sessioner, andre har brug for længere forløb.",
            },
            {
              question: "Er det fortroligt?",
              answer:
                "Ja, absolut. Jeg har tavshedspligt som autoriseret psykolog. GDPR-kompatibel opbevaring.",
            },
            {
              question: "Tilbyder du online-sessioner?",
              answer:
                "Ja, både fysiske møder i klinikken og sikre videokonsultationer.",
            },
            {
              question: "Hvad koster en session?",
              answer:
                "20 min. intro: Gratis. 45 min. session: 800 kr. 90 min. session: 1.400 kr.",
            },
          ],
        },
      },
      {
        type: "cta-banner",
        component: "CTABanner",
        headline: "Tag det første skridt i dag",
        content: {
          text: "Du fortjener at have det godt. Lad os finde ud af, hvordan jeg kan hjælpe dig videre.",
          primaryCTA: "Book gratis samtale",
          secondaryLink: "Ring til mig: +45 31 24 56 78",
        },
      },
      {
        type: "footer",
        component: "Footer",
        content: {
          brand: {
            tagline: "Professionel psykologhjælp i trygge rammer",
          },
          contact: {
            address: "Studiestræde 38, 2. sal, 1455 København K",
            phone: "+45 31 24 56 78",
            email: "kontakt@mindfulterapi.dk",
            hours: "Man-Fre: 9-18 | Weekend efter aftale",
          },
          legal: {
            cvr: "12345678",
            authNumber: "8274",
            membership: "Dansk Psykolog Forening",
          },
        },
      },
    ],
  },
  {
    name: "Om mig",
    path: "/om-mig",
    sections: [
      {
        type: "about-extended",
        component: "ContentBlock",
        headline: "Om Katrine Møller Hansen",
        content: {
          includes: [
            "extended-biography",
            "education-timeline",
            "professional-memberships",
            "philosophy-approach",
          ],
        },
      },
    ],
  },
  {
    name: "Behandlinger",
    path: "/behandlinger",
    sections: [
      {
        type: "services-detail",
        component: "FeatureGrid",
        headline: "Behandlingsområder",
        content: {
          specialties: [
            "anxiety",
            "depression",
            "stress",
            "relationships",
            "personal-growth",
            "corporate",
          ],
        },
      },
    ],
  },
  {
    name: "Priser & Forsikring",
    path: "/priser",
    sections: [
      {
        type: "pricing",
        component: "PricingTable",
        headline: "Priser & Forsikring",
        content: {
          prices: [
            { service: "Intro (20 min.)", price: "Gratis" },
            { service: "Session (45 min.)", price: "800 kr" },
            { service: "Session (90 min.)", price: "1.400 kr" },
          ],
          insuranceInfo: true,
          cancellationPolicy: "24 timer",
        },
      },
    ],
  },
  {
    name: "Kontakt",
    path: "/kontakt",
    sections: [
      {
        type: "contact",
        component: "ContactForm",
        headline: "Kontakt",
        content: {
          mapEmbed: true,
          directions: true,
          accessibility: true,
        },
      },
    ],
  },
];

// ── Template 2: Aurora Skincare ─────────────────────────────────────

const skincarePages: TemplatePageDef[] = [
  {
    name: "Forside",
    path: "/",
    sections: [
      {
        type: "product-hero",
        component: "ProductHero",
        headline: "Reducer rynker med 34% på 8 uger",
        content: {
          eyebrow: "★★★★★ Over 12.000 tilfredse kunder",
          subheadline:
            "Vores prisbelønnede Vitamin C serum forynger din hud med videnskabeligt dokumenterede ingredienser.",
          price: 499,
          originalPrice: 649,
          urgency: "Kun 47 stk. tilbage på lager",
          limitedOffer: "Gratis fragt + 2 gratis prøver ved køb i dag",
          trustBadges: [
            "30 dages pengene-tilbage",
            "Dyrefri & vegansk",
            "Lavet i Danmark",
            "Gratis fragt",
          ],
          primaryCTA: "Køb nu – 499 kr",
          secondaryCTA: "Se ingredienser",
        },
      },
      {
        type: "trust-bar",
        component: "TrustBar",
        content: {
          autoScroll: true,
          items: [
            "Klinisk testet i 12 uger",
            "15% rent Vitamin C",
            "Dermatolog-godkendt",
            "+12.000 anmeldelser",
            "CO2-neutral levering",
            "Produceret i Danmark",
          ],
        },
      },
      {
        type: "problem",
        component: "ContentBlock",
        headline: "Træthedstegn, rynker og ujævn hudtone?",
        content: {
          body: "Hver dag udsættes din hud for sollys, forurening og stress. Aurora Vitamin C Serum bruger 15% L-Ascorbinsyre i en pH-optimeret formel.",
          stats: [
            { label: "Rynkedybde", value: "-34%", period: "8 uger" },
            { label: "Hudens fasthed", value: "+41%", period: "8 uger" },
            { label: "Pigmentpletter", value: "-28%", period: "8 uger" },
          ],
          studyNote: "Klinisk studie, 127 deltagere, 2023",
        },
      },
      {
        type: "benefits",
        component: "FeatureGrid",
        headline: "Fordele",
        content: {
          columns: 3,
          items: [
            {
              icon: "sun",
              headline: "Lysere & mere ensartet hud",
              text: "Reducer pigmentpletter og ujævn hudtone.",
            },
            {
              icon: "droplet",
              headline: "Dyb hydrering",
              text: "Hyaluronsyre og glycerin låser fugt inde.",
            },
            {
              icon: "shield",
              headline: "Beskytter mod frie radikaler",
              text: "Potent antioxidant-formel neutraliserer miljøskader.",
            },
            {
              icon: "zap",
              headline: "Booster kollagen",
              text: "Stimulerer hudens naturlige kollagenproduktion.",
            },
            {
              icon: "leaf",
              headline: "Ren & sikker formel",
              text: "Uden parabener, sulfater, silikoner. Vegansk og cruelty-free.",
            },
            {
              icon: "flask-conical",
              headline: "Stabiliseret formel",
              text: "Patenteret forsegling beskytter mod oxidation.",
            },
          ],
        },
      },
      {
        type: "how-to",
        component: "ProcessSteps",
        headline: "Sådan bruger du Aurora Vitamin C Serum",
        content: {
          steps: [
            {
              number: "01",
              headline: "Rens din hud",
              text: "Start med en mild rensegel for at fjerne snavs og makeup.",
            },
            {
              number: "02",
              headline: "Påfør 3-4 dråber",
              text: "Fordel serumet jævnt på ansigt, hals og dekolletage.",
            },
            {
              number: "03",
              headline: "Lås fugt inde",
              text: "Følg op med fugtighedscreme og SPF om morgenen.",
            },
          ],
        },
      },
      {
        type: "reviews",
        component: "TestimonialGrid",
        headline: "Over 12.000 kvinder elsker Aurora",
        content: {
          aggregateRating: { score: 4.8, count: 12347 },
          layout: "masonry",
          items: [
            {
              stars: 5,
              text: "Jeg har aldrig troet på serums før, men dette har virkelig forandret min hud!",
              name: "Sophie, 38 år",
              badge: "Verificeret køb",
            },
            {
              stars: 5,
              text: "Min hud føles fastere og ser friskere ud. Jeg får konstant komplimenter!",
              name: "Maria L.",
              badge: "Verificeret køb",
            },
            {
              stars: 5,
              text: "Endelig et serum der ikke irriterer min sensitive hud.",
              name: "Camilla, 42 år",
              badge: "Verificeret køb",
            },
            {
              stars: 4,
              text: "Rigtig godt produkt! Lidt dyrt, men kvaliteten er i top.",
              name: "Anne K.",
              badge: "Verificeret køb",
            },
            {
              stars: 5,
              text: "Bedste køb i år! Min hud er blevet så meget mere glødende.",
              name: "Louise, 31 år",
              badge: "Verificeret køb",
            },
          ],
        },
      },
      {
        type: "ingredients",
        component: "AccordionList",
        headline: "Hvad er der i flasken?",
        content: {
          items: [
            {
              name: "L-Ascorbinsyre (Vitamin C)",
              concentration: "15%",
              summary:
                "Den mest potente og videnskabeligt dokumenterede form for Vitamin C.",
            },
            {
              name: "Hyaluronsyre",
              concentration: "2%",
              summary:
                "Tiltrækker og binder fugt for plump, hydreret hud.",
            },
            {
              name: "Vitamin E (Tocopherol)",
              concentration: "1%",
              summary:
                "Antioxidant der forstærker Vitamin C's effekt.",
            },
            {
              name: "Ferulasyre",
              concentration: "0.5%",
              summary:
                "Plantebaseret antioxidant fra ris.",
            },
            {
              name: "Panthenol (ProVitamin B5)",
              concentration: "2%",
              summary: "Beroligende og fugtighedsgivende.",
            },
          ],
          fullIngredients:
            "Aqua, L-Ascorbic Acid (15%), Propanediol, Sodium Hyaluronate, Tocopherol, Ferulic Acid, Panthenol, Glycerin, Pentylene Glycol, Citric Acid, Sodium Hydroxide.",
        },
      },
      {
        type: "comparison",
        component: "ComparisonTable",
        headline: "Hvorfor Aurora er anderledes",
        content: {
          columns: [
            { label: "Aurora (499 kr)", highlighted: true },
            { label: "Generisk mærke (299 kr)", highlighted: false },
            { label: "Premium mærke (899 kr)", highlighted: false },
          ],
          rows: [
            {
              feature: "Vitamin C koncentration",
              values: ["15% L-Ascorbinsyre", "5-10% ustabil", "10-15%"],
            },
            {
              feature: "Stabiliseret formel",
              values: [true, false, true],
            },
            {
              feature: "Klinisk testet",
              values: [true, false, "Delvist"],
            },
            {
              feature: "Produceret i Danmark",
              values: [true, false, false],
            },
            {
              feature: "Pengene-tilbage garanti",
              values: ["30 dage", "14 dage", "14 dage"],
            },
            {
              feature: "Pris per ml",
              values: ["16,6 kr/ml", "15 kr/ml", "29,9 kr/ml"],
            },
          ],
        },
      },
      {
        type: "guarantee",
        component: "GuaranteeSection",
        headline: "Elsker du ikke det? Få pengene tilbage.",
        content: {
          badge: "30 DAGES GARANTI",
          bullets: [
            "Prøv risikofrit i 30 dage",
            "Gratis returfragt",
            "Ingen spørgsmål stillet",
            "Fuld refundering inden for 24 timer",
          ],
          cta: "Bestil nu uden risiko",
        },
      },
      {
        type: "faq",
        component: "FAQ",
        headline: "Spørgsmål? Vi har svarene.",
        content: {
          items: [
            {
              question: "Hvor hurtigt ser jeg resultater?",
              answer:
                "De fleste ser forbedring i hudtone inden for 2-3 uger. For dybere anti-aging effekter anbefaler vi 8-12 uger.",
            },
            {
              question: "Er det sikkert for sensitiv hud?",
              answer:
                "Ja, formlen er dermatolog-testet og pH-optimeret. Start langsomt den første uge.",
            },
            {
              question: "Hvor længe holder en flaske?",
              answer:
                "En 30ml flaske holder typisk 2-3 måneder ved daglig brug.",
            },
            {
              question: "Er det testet på dyr?",
              answer:
                "Nej, aldrig. Aurora er 100% cruelty-free og certificeret vegansk.",
            },
            {
              question: "Hvad er jeres returpolitik?",
              answer:
                "Fuld refundering inden for 30 dage – ingen spørgsmål. Vi betaler returfragten.",
            },
          ],
        },
      },
      {
        type: "final-cta",
        component: "FinalCTA",
        headline: "Klar til yngre, mere strålende hud?",
        content: {
          subheadline:
            "Prøv Aurora risikofrit i 30 dage. 12.000+ kvinder stoler allerede på os.",
          price: 499,
          urgency: "Kun 47 tilbage på lager",
          limitedOffer: "Gratis fragt + 2 gratis prøver i dag",
          cta: "Køb nu – 30 dages pengene-tilbage",
          paymentIcons: ["MobilePay", "Visa", "Mastercard", "Klarna"],
        },
      },
      {
        type: "footer",
        component: "Footer",
        content: {
          brand: {
            tagline: "Videnskabeligt dokumenteret hudpleje",
            newsletter: "Få 10% rabat på første køb",
            social: ["instagram", "facebook", "tiktok"],
          },
          legal: {
            cvr: "87654321",
            certifications: ["Vegansk", "Cruelty-free", "Dansk produceret"],
          },
        },
      },
    ],
  },
  {
    name: "Produkt",
    path: "/produkt",
    sections: [
      {
        type: "product-detail",
        component: "ProductHero",
        headline: "Aurora Vitamin C Serum",
        content: {
          includes: [
            "extended-ingredients",
            "before-after-photos",
            "dermatologist-endorsement",
            "clinical-study-pdf",
          ],
        },
      },
    ],
  },
  {
    name: "Abonnement",
    path: "/abonnement",
    sections: [
      {
        type: "subscription",
        component: "PricingTable",
        headline: "Abonnement – spar 15%",
        content: {
          discount: 15,
          features: [
            "Fleksibel levering",
            "Spring over eller pause",
            "Loyalitetsbelønninger",
          ],
        },
      },
    ],
  },
  {
    name: "Om os",
    path: "/om-os",
    sections: [
      {
        type: "brand-story",
        component: "ContentBlock",
        headline: "Vores historie",
        content: {
          includes: [
            "brand-story",
            "lab-photos",
            "sustainability",
            "team",
          ],
        },
      },
    ],
  },
];

// ── Exported template catalogue ─────────────────────────────────────

export const danishTemplates: DanishTemplate[] = [
  {
    id: "mindful-terapi",
    name: "Mindful Terapi – Psykologklinik",
    description:
      "Professional psychology clinic template with booking, trust signals, and GDPR-compliant forms. Danish language.",
    category: "services",
    design: psychologyClinicDesign,
    pages: psychologyPages,
  },
  {
    id: "aurora-skincare",
    name: "Aurora Skincare – Premium Serum",
    description:
      "Single-product DTC ecommerce template with urgency, social proof, and science-backed content. Danish language.",
    category: "ecommerce",
    design: auroraSkincareDesign,
    pages: skincarePages,
  },
];
