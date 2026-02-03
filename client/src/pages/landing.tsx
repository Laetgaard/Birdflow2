import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  Globe, 
  Calendar, 
  ShoppingCart, 
  Sparkles, 
  Edit3,
  Layout,
  BarChart3,
  Mail,
  CreditCard,
  ChevronDown,
  Users,
  Star,
} from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import HeroIllustration from "@/components/animated/HeroIllustration";
import SparklesBackground from "@/components/animated/Sparkles";
import WaveDivider from "@/components/animated/WaveDivider";
import CountUp from "@/components/animated/CountUp";
import AnimatedBuilderDemo from "@/components/animated/AnimatedBuilderDemo";
import AnimatedStepProgress from "@/components/animated/AnimatedStepProgress";
import { getTotalCreators } from "@/lib/stats";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function LandingPage() {
  const [totalCreators, setTotalCreators] = useState(0);
  
  useEffect(() => {
    getTotalCreators().then(setTotalCreators);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <img src="/logo.png" alt="BirdFlow" className="w-8 h-8" />
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              BirdFlow
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth?mode=signin">
              <Button variant="ghost" size="sm" data-testid="button-signin">Sign In</Button>
            </Link>
            <Link href="/auth?mode=signup">
              <Button size="sm" className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700" data-testid="button-get-started-nav">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative py-20 md:py-32 px-4 overflow-hidden">
          <SparklesBackground count={30} />
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/50 to-transparent dark:from-indigo-950/20 pointer-events-none" />
          
          <div className="container mx-auto max-w-6xl relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center lg:text-left"
              >
                <div className="inline-flex items-center rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-6">
                  <Sparkles className="w-3 h-3 mr-1.5" />
                  AI-Powered Website Builder
                </div>
                
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
                  Build stunning websites
                  <span className="block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                    in minutes, not months.
                  </span>
                </h1>
                
                <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
                  The all-in-one platform to create, launch, and grow your online business. 
                  Booking system, e-commerce, AI assistant — everything you need.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-8">
                  <Link href="/auth?mode=signup">
                    <Button size="lg" className="h-12 px-8 text-base bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 group" data-testid="button-start-building">
                      Start Building Free
                      <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
                
                <div className="flex items-center justify-center lg:justify-start gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <span>Join</span>
                  <span className="font-semibold text-foreground">
                    <CountUp end={totalCreators} suffix="+" />
                  </span>
                  <span>creators already building with BirdFlow</span>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="hidden lg:block"
              >
                <AnimatedBuilderDemo />
              </motion.div>
            </div>
          </div>
        </section>

        <WaveDivider />

        <section id="how-it-works" className="py-20 md:py-28 px-4 bg-secondary/30">
          <div className="container mx-auto max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Launch your website in 3 simple steps
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                No coding required. Just describe what you want and watch it come to life.
              </p>
            </motion.div>
            
            <AnimatedStepProgress />
          </div>
        </section>

        <WaveDivider flip />

        <section id="features" className="py-20 md:py-28 px-4">
          <div className="container mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Everything you need to succeed online
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Powerful features that help you build, grow, and manage your business.
              </p>
            </motion.div>
            
            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {[
                {
                  icon: Calendar,
                  title: "Booking System",
                  desc: "Let customers book appointments directly on your website. Set your availability, manage time slots, and receive instant notifications. Perfect for consultants, therapists, and service businesses.",
                  color: "bg-blue-500",
                },
                {
                  icon: ShoppingCart,
                  title: "E-Commerce",
                  desc: "Build a complete online store with product catalogs, inventory tracking, variant support, and secure Stripe checkout. Manage orders, shipping, and customer data all in one place.",
                  color: "bg-green-500",
                },
                {
                  icon: Sparkles,
                  title: "AI Assistant",
                  desc: "Describe what you want in plain language and watch your website transform. Our AI understands design, layout, and content — making professional web design accessible to everyone.",
                  color: "bg-purple-500",
                },
                {
                  icon: Edit3,
                  title: "Inline Editing",
                  desc: "Click directly on any text, image, or element to edit it in real-time. No complicated menus or settings — just click, type, and see your changes instantly like Webflow.",
                  color: "bg-orange-500",
                },
                {
                  icon: BarChart3,
                  title: "Analytics",
                  desc: "Privacy-first analytics that respect your visitors. Track page views, conversion rates, and sales without cookies or personal data. GDPR compliant by design.",
                  color: "bg-pink-500",
                },
                {
                  icon: Mail,
                  title: "Email Notifications",
                  desc: "Automated transactional emails for every customer touchpoint. Booking confirmations, order receipts, and shipping updates — all branded with your logo and colors.",
                  color: "bg-cyan-500",
                },
                {
                  icon: CreditCard,
                  title: "Payment Processing",
                  desc: "Connect your own Stripe account in seconds. Accept credit cards, Apple Pay, and Google Pay from customers worldwide. Funds go directly to your bank account.",
                  color: "bg-indigo-500",
                },
                {
                  icon: Globe,
                  title: "Custom Domains",
                  desc: "Use your own domain name for a professional presence. SSL certificates are automatically configured and renewed. Your brand, your URL, completely seamless.",
                  color: "bg-red-500",
                },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="bg-card p-6 rounded-xl border hover:border-primary/50 hover:shadow-md transition-all group"
                >
                  <div className={`w-10 h-10 rounded-lg ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section className="py-20 md:py-28 px-4">
          <div className="container mx-auto max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Loved by creators worldwide
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Join thousands of entrepreneurs who've launched their dream websites.
              </p>
            </motion.div>
            
            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid md:grid-cols-3 gap-6"
            >
              {[
                {
                  name: "Sarah Chen",
                  role: "Yoga Instructor",
                  quote: "I built my entire booking website in an afternoon. My clients love how easy it is to schedule sessions.",
                  rating: 5,
                },
                {
                  name: "Marcus Johnson",
                  role: "E-commerce Owner",
                  quote: "The AI assistant is incredible. I just describe what I want and it builds it. No more hiring developers!",
                  rating: 5,
                },
                {
                  name: "Emma Larsson",
                  role: "Photographer",
                  quote: "Beautiful templates, easy customization, and the analytics help me understand my visitors. Perfect combo.",
                  rating: 5,
                },
              ].map((testimonial, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="bg-card p-6 rounded-xl border"
                >
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-6 italic">"{testimonial.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                      {testimonial.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="faq" className="py-20 md:py-28 px-4 bg-secondary/30">
          <div className="container mx-auto max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Frequently asked questions
              </h2>
              <p className="text-lg text-muted-foreground">
                Everything you need to know about BirdFlow.
              </p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Accordion type="single" collapsible className="space-y-4">
                {[
                  {
                    q: "Do I need coding skills to use BirdFlow?",
                    a: "No! BirdFlow is designed for everyone. Use our visual editor or AI assistant to build your site. Just describe what you want in plain English.",
                  },
                  {
                    q: "Can I accept payments on my website?",
                    a: "Yes! Connect your Stripe account to accept credit cards, Apple Pay, and Google Pay. We handle everything securely.",
                  },
                  {
                    q: "How does the booking system work?",
                    a: "Set your availability, add your services, and customers can book directly on your site. You'll get email notifications and can manage everything from your dashboard.",
                  },
                  {
                    q: "Can I use my own domain?",
                    a: "Absolutely! Add your custom domain with just a few clicks. SSL certificates are included automatically and for free.",
                  },
                  {
                    q: "What happens if I need help?",
                    a: "We're here for you! Reach out via chat or email. Our support team typically responds within a few hours.",
                  },
                ].map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="bg-background rounded-lg border px-6">
                    <AccordionTrigger className="text-left font-medium hover:no-underline">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </div>
        </section>

        <section className="py-20 md:py-28 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600" />
          <SparklesBackground count={20} />
          
          <div className="container mx-auto max-w-3xl relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
                Ready to build something amazing?
              </h2>
              <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
                Join <CountUp end={totalCreators} className="font-semibold text-white" /> creators who've already launched their websites with BirdFlow.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/auth?mode=signup">
                  <Button size="lg" variant="secondary" className="h-12 px-8 text-base group" data-testid="button-get-started-cta">
                    Get Started Free
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
              <p className="text-sm text-white/60 mt-6">
                No credit card required. Free forever for basic sites.
              </p>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t bg-background">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 font-bold text-xl mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                  <Globe className="w-5 h-5" />
                </div>
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  BirdFlow
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Build stunning websites in minutes. The all-in-one platform for creators and entrepreneurs.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#templates" className="hover:text-foreground transition-colors">Templates</a></li>
                <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} BirdFlow. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
