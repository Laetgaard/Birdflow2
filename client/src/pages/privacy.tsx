import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-bold mb-2">Privatlivspolitik</h1>
          <p className="text-muted-foreground mb-12">Sidst opdateret: Februar 2026</p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Introduktion</h2>
              <p className="text-muted-foreground leading-relaxed">
                BirdFlow ("vi", "os", "vores") respekterer dit privatliv og er forpligtet til at beskytte dine personoplysninger. 
                Denne privatlivspolitik forklarer, hvordan vi indsamler, bruger og beskytter dine data, når du bruger vores 
                website builder platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Dataansvarlig</h2>
              <p className="text-muted-foreground leading-relaxed">
                BirdFlow er dataansvarlig for behandlingen af dine personoplysninger. Du kan kontakte os på:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Email: privacy@birdflow.dk</li>
                <li>Adresse: København, Danmark</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Hvilke data indsamler vi?</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Vi indsamler følgende kategorier af personoplysninger:
              </p>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Kontooplysninger</h3>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Navn og email-adresse</li>
                    <li>Adgangskode (krypteret)</li>
                    <li>Profilbillede (valgfrit)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Betalingsoplysninger</h3>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Faktureringsadresse</li>
                    <li>Betalingsmetode (behandlet sikkert via Stripe)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Brugsdata</h3>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Log-data og IP-adresser</li>
                    <li>Enhedsoplysninger</li>
                    <li>Brugeradfærd på platformen (anonymiseret)</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Hvordan bruger vi dine data?</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Vi bruger dine personoplysninger til følgende formål:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>At levere og vedligeholde vores tjenester</li>
                <li>At behandle betalinger og abonnementer</li>
                <li>At sende vigtige meddelelser om din konto</li>
                <li>At forbedre vores platform og brugeroplevelse</li>
                <li>At yde kundesupport</li>
                <li>At overholde lovmæssige forpligtelser</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Retsgrundlag for behandling</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Vi behandler dine personoplysninger baseret på følgende retsgrundlag:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Kontrakt:</strong> For at opfylde vores aftale med dig som bruger</li>
                <li><strong>Samtykke:</strong> Når du har givet dit udtrykkelige samtykke</li>
                <li><strong>Legitime interesser:</strong> For at forbedre vores tjenester</li>
                <li><strong>Lovmæssig forpligtelse:</strong> For at overholde gældende lovgivning</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Deling af data</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Vi deler kun dine personoplysninger med tredjeparter i følgende tilfælde:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Stripe:</strong> For sikker betalingsbehandling</li>
                <li><strong>Supabase:</strong> For database-hosting og autentificering</li>
                <li><strong>Vercel:</strong> For hosting af publicerede websites</li>
                <li><strong>Resend:</strong> For afsendelse af transaktionelle emails</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Alle vores databehandlere er GDPR-kompatible og har indgået databehandleraftaler med os.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Datasikkerhed</h2>
              <p className="text-muted-foreground leading-relaxed">
                Vi implementerer passende tekniske og organisatoriske sikkerhedsforanstaltninger for at beskytte 
                dine personoplysninger, herunder:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>SSL/TLS-kryptering på alle forbindelser</li>
                <li>Krypterede adgangskoder</li>
                <li>Regelmæssige sikkerhedsaudits</li>
                <li>Adgangskontrol og autorisering</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Dine rettigheder</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                I henhold til GDPR har du følgende rettigheder:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Indsigt:</strong> Ret til at få adgang til dine personoplysninger</li>
                <li><strong>Berigtigelse:</strong> Ret til at få rettet unøjagtige oplysninger</li>
                <li><strong>Sletning:</strong> Ret til at få slettet dine data ("retten til at blive glemt")</li>
                <li><strong>Begrænsning:</strong> Ret til at begrænse behandlingen</li>
                <li><strong>Dataportabilitet:</strong> Ret til at modtage dine data i et struktureret format</li>
                <li><strong>Indsigelse:</strong> Ret til at gøre indsigelse mod behandling</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                For at udøve disse rettigheder, kontakt os på privacy@birdflow.dk.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                Vi bruger kun nødvendige cookies til at sikre platformens funktionalitet. Vi bruger ikke 
                tracking-cookies eller tredjeparts-cookies til markedsføring. Vores analytics er privacy-first 
                og indsamler ikke personligt identificerbare oplysninger.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Opbevaring af data</h2>
              <p className="text-muted-foreground leading-relaxed">
                Vi opbevarer dine personoplysninger så længe det er nødvendigt for at opfylde de formål, 
                de blev indsamlet til. Når du sletter din konto, vil dine personoplysninger blive slettet 
                inden for 30 dage, medmindre vi er forpligtet til at opbevare dem af lovmæssige årsager.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Ændringer til denne politik</h2>
              <p className="text-muted-foreground leading-relaxed">
                Vi kan opdatere denne privatlivspolitik fra tid til anden. Ved væsentlige ændringer vil vi 
                underrette dig via email eller en meddelelse på platformen. Vi opfordrer dig til regelmæssigt 
                at gennemgå denne politik.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">12. Kontakt og klage</h2>
              <p className="text-muted-foreground leading-relaxed">
                Hvis du har spørgsmål eller bekymringer om vores behandling af dine personoplysninger, 
                er du velkommen til at kontakte os på privacy@birdflow.dk.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Du har også ret til at indgive en klage til Datatilsynet:
              </p>
              <ul className="list-none text-muted-foreground mt-2 space-y-1">
                <li>Datatilsynet</li>
                <li>Carl Jacobsens Vej 35</li>
                <li>2500 Valby</li>
                <li>dt@datatilsynet.dk</li>
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
              <span className="text-foreground font-medium">Privacy Policy</span>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
