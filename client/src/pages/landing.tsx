import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Shield, Zap, Globe } from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-sm z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              <Globe className="w-5 h-5" />
            </div>
            SaaSify
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#about" className="hover:text-foreground transition-colors">About</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/auth?mode=signin">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/auth?mode=signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32 px-4 text-center space-y-8 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 mb-6">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
              v1.0 Now Available
            </div>
            <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6">
              Build your SaaS <br className="hidden md:block" />
              <span className="text-muted-foreground">faster than ever.</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              The complete starter kit for your next big idea. Authentication, dashboard, and billing ready to go. Focus on your product, not the plumbing.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth?mode=signup">
                <Button size="lg" className="h-12 px-8 text-base group">
                  Start Building Free
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                View Documentation
              </Button>
            </div>
          </motion.div>

          {/* Hero Image / Abstract Representation */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="mt-16 rounded-xl border bg-card text-card-foreground shadow-2xl overflow-hidden aspect-[16/9] max-w-4xl mx-auto relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-secondary/20 pointer-events-none" />
            <div className="p-8 md:p-12 flex flex-col items-center justify-center h-full space-y-4">
              <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
                <Zap className="w-12 h-12 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">Ready to Launch</h3>
              <p className="text-muted-foreground">Your dashboard preview goes here.</p>
            </div>
          </motion.div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="py-24 bg-secondary/30 border-y">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-bold tracking-tight mb-4">Everything you need to ship</h2>
              <p className="text-muted-foreground text-lg">We handled the boring stuff so you can build the fun stuff.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Shield,
                  title: "Secure Authentication",
                  desc: "Enterprise-grade security with Supabase Auth. Magic links, social login, and more."
                },
                {
                  icon: Zap,
                  title: "Lightning Fast",
                  desc: "Built on top of Vite and React for instant page loads and smooth interactions."
                },
                {
                  icon: CheckCircle2,
                  title: "Ready for Scale",
                  desc: "Designed to grow with you. From 10 to 10 million users without breaking a sweat."
                }
              ].map((feature, i) => (
                <div key={i} className="bg-background p-8 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-lg bg-primary/5 flex items-center justify-center mb-6 text-primary">
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t bg-background">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 SaaSify Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
