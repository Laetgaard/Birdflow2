import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="w-full px-6 lg:px-12 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight cursor-pointer">
              <img src="/logo.png" alt="BirdFlow" className="w-8 h-8" />
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                BirdFlow
              </span>
            </div>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Tilbage
            </Button>
          </Link>
        </div>
      </header>

      <main className="py-16 px-6 lg:px-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Servicevilkår</h1>
          <p className="text-muted-foreground mb-12">Sidst opdateret: Februar 2026</p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Accept af vilkår</h2>
              <p className="text-muted-foreground leading-relaxed">
                Ved at oprette en konto eller bruge BirdFlow accepterer du at være bundet af disse servicevilkår. 
                Hvis du ikke accepterer alle vilkårene, må du ikke bruge vores tjenester.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Beskrivelse af tjenesten</h2>
              <p className="text-muted-foreground leading-relaxed">
                BirdFlow er en software-as-a-service (SaaS) platform, der giver brugere mulighed for at oprette, 
                tilpasse og publicere websites. Tjenesten inkluderer:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Website builder med drag-and-drop funktionalitet</li>
                <li>AI-assisteret website-opbygning</li>
                <li>Booking- og e-commerce-funktionalitet</li>
                <li>Hosting og publicering af websites</li>
                <li>Analytics og email-notifikationer</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Konto og registrering</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                For at bruge BirdFlow skal du oprette en konto. Du accepterer at:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Angive nøjagtige og fuldstændige oplysninger ved registrering</li>
                <li>Holde dine loginoplysninger fortrolige</li>
                <li>Være ansvarlig for al aktivitet på din konto</li>
                <li>Straks underrette os om uautoriseret brug af din konto</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Abonnementer og betaling</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">4.1 Abonnementsplaner</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Vi tilbyder forskellige abonnementsplaner: Basis, Starter og Professionel. Hver plan har 
                    forskellige funktioner og begrænsninger som beskrevet på vores prisside.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">4.2 Prøveperiode</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Starter og Professionel planer inkluderer en gratis prøveperiode på 1 måned. Efter 
                    prøveperioden vil dit abonnement automatisk fornyes, medmindre du annullerer.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">4.3 Fakturering</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Abonnementer faktureres månedligt forud. Alle priser er i danske kroner (DKK) og er 
                    eksklusive moms, medmindre andet er angivet.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">4.4 Fortrydelsesret</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Du kan annullere dit abonnement når som helst. Annullering træder i kraft ved slutningen 
                    af den aktuelle faktureringsperiode. Der ydes ikke refusion for delvist brugte perioder.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Acceptabel brug</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Du accepterer ikke at bruge BirdFlow til at:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Overtræde gældende love eller regler</li>
                <li>Krænke andres intellektuelle ejendomsrettigheder</li>
                <li>Distribuere malware, spam eller skadeligt indhold</li>
                <li>Publicere ulovligt, stødende eller diskriminerende indhold</li>
                <li>Forsøge at få uautoriseret adgang til vores systemer</li>
                <li>Genbruge eller videresælge vores tjenester uden tilladelse</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Vi forbeholder os retten til at suspendere eller opsige konti, der overtræder disse vilkår.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Intellektuel ejendom</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">6.1 Vores rettigheder</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    BirdFlow-platformen, herunder software, design, logoer og indhold, tilhører BirdFlow og 
                    er beskyttet af ophavsret og andre immaterielle rettigheder.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium mb-2">6.2 Dit indhold</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Du beholder alle rettigheder til det indhold, du opretter og uploader på BirdFlow. Ved at 
                    bruge vores tjeneste giver du os en begrænset licens til at hoste og vise dit indhold som 
                    en del af tjenesten.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Tredjepartstjenester</h2>
              <p className="text-muted-foreground leading-relaxed">
                BirdFlow integrerer med tredjepartstjenester såsom Stripe til betalinger og Vercel til hosting. 
                Brugen af disse tjenester er underlagt deres respektive vilkår og privatlivspolitikker. Vi er 
                ikke ansvarlige for tredjepartstjenesters handlinger eller funktionalitet.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Ansvarsfraskrivelse</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                BirdFlow leveres "som den er" og "som tilgængelig". Vi giver ingen garantier, hverken udtrykkelige 
                eller underforståede, vedrørende:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Tjenestens uafbrudte eller fejlfri drift</li>
                <li>Sikkerheden af dit indhold</li>
                <li>Opfyldelse af specifikke forventninger eller krav</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Ansvarsbegrænsning</h2>
              <p className="text-muted-foreground leading-relaxed">
                I det omfang det er tilladt ved lov, er BirdFlow ikke ansvarlig for indirekte, tilfældige, 
                særlige eller følgeskader, herunder tab af data, omsætning eller forretning, der opstår som 
                følge af brug af vores tjeneste.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Vores samlede ansvar over for dig er begrænset til det beløb, du har betalt til os i de 
                foregående 12 måneder.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Skadesløsholdelse</h2>
              <p className="text-muted-foreground leading-relaxed">
                Du accepterer at skadesløsholde og forsvare BirdFlow mod alle krav, ansvar, skader og 
                omkostninger, der opstår som følge af din brug af tjenesten eller overtrædelse af disse vilkår.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Opsigelse</h2>
              <p className="text-muted-foreground leading-relaxed">
                Vi kan opsige eller suspendere din adgang til tjenesten med øjeblikkelig virkning, hvis du 
                overtræder disse vilkår. Ved opsigelse vil dit indhold blive slettet efter 30 dage, medmindre 
                andet er aftalt.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Du kan til enhver tid opsige din konto ved at kontakte os eller gennem dine kontoindstillinger.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">12. Ændringer af vilkår</h2>
              <p className="text-muted-foreground leading-relaxed">
                Vi forbeholder os retten til at ændre disse vilkår til enhver tid. Ved væsentlige ændringer 
                vil vi underrette dig mindst 30 dage i forvejen. Fortsat brug af tjenesten efter ændringer 
                udgør accept af de nye vilkår.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">13. Lovvalg og værneting</h2>
              <p className="text-muted-foreground leading-relaxed">
                Disse vilkår er underlagt dansk ret. Eventuelle tvister skal afgøres ved de danske domstole 
                med Københavns Byret som første instans.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">14. Kontakt</h2>
              <p className="text-muted-foreground leading-relaxed">
                Hvis du har spørgsmål til disse servicevilkår, kan du kontakte os på:
              </p>
              <ul className="list-none text-muted-foreground mt-2 space-y-1">
                <li>Email: support@birdflow.dk</li>
                <li>Adresse: København, Danmark</li>
              </ul>
            </section>
          </div>
        </div>
      </main>

      <footer className="py-8 border-t bg-background">
        <div className="w-full px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 BirdFlow. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <span className="text-foreground font-medium">Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
