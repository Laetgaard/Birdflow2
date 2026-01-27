import Stripe from 'stripe';
import { getUncachableStripeClient } from '../server/stripeClient';

interface PlanConfig {
  id: string;
  name: string;
  description: string;
  priceMonthlyDKK: number;
  trialDays: number;
  metadata: Record<string, string>;
}

const PLANS: PlanConfig[] = [
  {
    id: 'basic',
    name: 'BirdFlow Basic',
    description: 'Get your business online - 1 website, 4 pages, 2GB storage',
    priceMonthlyDKK: 6900,
    trialDays: 0,
    metadata: {
      planId: 'basic',
      maxWebsites: '1',
      maxPagesPerWebsite: '4',
      storageGB: '2',
    },
  },
  {
    id: 'starter',
    name: 'BirdFlow Starter',
    description: 'Perfect for growing businesses - 1 website, 5 pages, 4GB storage, booking system',
    priceMonthlyDKK: 14900,
    trialDays: 14,
    metadata: {
      planId: 'starter',
      maxWebsites: '1',
      maxPagesPerWebsite: '5',
      storageGB: '4',
      bookingSystem: 'true',
    },
  },
  {
    id: 'professional',
    name: 'BirdFlow Professional',
    description: 'Full-featured for serious businesses - 5 websites, 20 pages each, 15GB storage, webshop',
    priceMonthlyDKK: 24900,
    trialDays: 14,
    metadata: {
      planId: 'professional',
      maxWebsites: '5',
      maxPagesPerWebsite: '20',
      storageGB: '15',
      bookingSystem: 'true',
      ecommerce: 'true',
    },
  },
];

async function findOrCreateProduct(stripe: Stripe, plan: PlanConfig): Promise<Stripe.Product> {
  const existingProducts = await stripe.products.list({
    limit: 100,
    active: true,
  });

  const existing = existingProducts.data.find(p => p.metadata?.planId === plan.id);
  if (existing) {
    console.log(`  Found existing product: ${existing.id}`);
    return existing;
  }

  const product = await stripe.products.create({
    name: plan.name,
    description: plan.description,
    metadata: plan.metadata,
  });

  console.log(`  Created new product: ${product.id}`);
  return product;
}

async function findOrCreatePrice(stripe: Stripe, product: Stripe.Product, plan: PlanConfig): Promise<Stripe.Price> {
  const existingPrices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  });

  const existing = existingPrices.data.find(
    p => p.unit_amount === plan.priceMonthlyDKK && 
         p.currency === 'dkk' && 
         p.recurring?.interval === 'month'
  );

  if (existing) {
    console.log(`  Found existing price: ${existing.id}`);
    return existing;
  }

  const price = await stripe.prices.create({
    product: product.id,
    currency: 'dkk',
    unit_amount: plan.priceMonthlyDKK,
    recurring: {
      interval: 'month',
    },
    metadata: {
      planId: plan.id,
      trialDays: plan.trialDays.toString(),
    },
  });

  console.log(`  Created new price: ${price.id}`);
  return price;
}

async function main() {
  console.log('Seeding Stripe subscription products and prices...\n');

  const stripe = await getUncachableStripeClient();
  
  const priceIds: Record<string, string> = {};

  for (const plan of PLANS) {
    console.log(`\nProcessing plan: ${plan.name}`);
    
    const product = await findOrCreateProduct(stripe, plan);
    const price = await findOrCreatePrice(stripe, product, plan);
    
    priceIds[plan.id] = price.id;
  }

  console.log('\n\n=== Stripe Products and Prices Created ===\n');
  console.log('Add these environment variables to your project:\n');
  console.log(`STRIPE_BASIC_PRICE_ID=${priceIds.basic}`);
  console.log(`STRIPE_STARTER_PRICE_ID=${priceIds.starter}`);
  console.log(`STRIPE_PROFESSIONAL_PRICE_ID=${priceIds.professional}`);
  console.log('\n');
}

main().catch(console.error);
