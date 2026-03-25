import { getStripeSync } from './stripeClient';
import { storage } from './storage';
import { emailService } from './email/service';
import { purchaseDomain, addCustomDomain, type DomainContactInfo } from './publisher/vercel';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    
    // Process webhook and get the verified event from stripeSync
    const result = await sync.processWebhook(payload, signature);
    
    // Handle checkout.session.completed to update order payment status
    // Use the verified event from stripeSync result, falling back to parsing the payload
    try {
      // stripeSync returns the Stripe event in result.event
      const event = result?.event || JSON.parse(payload.toString());
      
      if (event.type === 'checkout.session.completed') {
        console.log(`[Stripe Webhook] Processing checkout.session.completed event`);
        const session = event.data?.object;
        if (session?.id) {
          const sessionId = session.id;
          const paymentIntentId = session.payment_intent;
          console.log(`[Stripe Webhook] Session ID: ${sessionId}, Payment Intent: ${paymentIntentId}`);

          // Update order payment status
          const order = await storage.getOrderByStripeSessionId(sessionId);
          if (order) {
            console.log(`[Stripe Webhook] Found order ${order.id} for session ${sessionId}`);
            await storage.updateOrderByStripeSessionId(sessionId, {
              paymentStatus: 'paid',
              status: 'confirmed',
              stripePaymentIntentId: paymentIntentId,
            });
            console.log(`[Stripe Webhook] Order ${order.id} marked as paid`);

            // Decrement stock for tracked products after payment success
            if (order.items && Array.isArray(order.items)) {
              for (const item of order.items as Array<{ id: string; quantity: number }>) {
                if (item.id && item.quantity) {
                  try {
                    await storage.decrementProductStock(item.id, item.quantity);
                    console.log(`[Stripe Webhook] Decremented stock for product ${item.id} by ${item.quantity}`);
                  } catch (stockErr) {
                    console.error(`[Stripe Webhook] Failed to decrement stock for product ${item.id}:`, stockErr);
                  }
                }
              }
            }

            // Send order confirmation email
            if (order.customerEmail) {
              console.log(`[Stripe Webhook] Sending order confirmation email to ${order.customerEmail}`);
              try {
                // Get website to determine published URL for button link
                const website = await storage.getWebsite(order.websiteId);
                const websiteUrl = website?.deploymentUrl || undefined;
                console.log(`[Stripe Webhook] Website URL for order: ${websiteUrl || 'none'}`);
                
                // Get updated order with confirmed status
                const updatedOrder = await storage.getOrderByStripeSessionId(sessionId);
                if (updatedOrder) {
                  const emailSent = await emailService.sendOrderConfirmation(
                    updatedOrder,
                    order.customerEmail,
                    websiteUrl
                  );
                  console.log(`[Stripe Webhook] Order confirmation email ${emailSent ? 'SENT' : 'FAILED'} to ${order.customerEmail}`);
                }
              } catch (emailErr) {
                console.error(`[Stripe Webhook] Failed to send order confirmation email:`, emailErr);
              }
            } else {
              console.log(`[Stripe Webhook] No customer email on order ${order.id}, skipping confirmation email`);
            }
          } else {
            console.log(`[Stripe Webhook] No order found for session ${sessionId}`);
          }

          if (session?.metadata?.type === 'domain_purchase' && session?.payment_status === 'paid') {
            console.log(`[Stripe Webhook] Processing domain purchase for session ${sessionId}`);
            const domainPurchase = await storage.getDomainPurchaseByStripeSessionId(sessionId);
            if (domainPurchase && domainPurchase.status === 'pending') {
              await storage.updateDomainPurchase(domainPurchase.id, {
                status: 'paid',
                stripePaymentIntentId: session.payment_intent || undefined,
              });
              console.log(`[Stripe Webhook] Domain purchase ${domainPurchase.id} marked as paid, starting registration...`);

              try {
                await storage.updateDomainPurchase(domainPurchase.id, { status: 'registering' });

                const registrarToken = process.env.VERCEL_REGISTRAR_TOKEN || process.env.VERCEL_TOKEN;
                if (!registrarToken) {
                  throw new Error('VERCEL_REGISTRAR_TOKEN not configured');
                }

                const vercelConfig = { token: registrarToken, teamId: process.env.VERCEL_TEAM_ID };
                const contact = domainPurchase.contactInfo as DomainContactInfo;

                const purchaseResult = await purchaseDomain(
                  domainPurchase.domain,
                  vercelConfig,
                  contact,
                  domainPurchase.priceCents / 100,
                  domainPurchase.years
                );

                if (!purchaseResult.success) {
                  console.error(`[Stripe Webhook] Vercel domain registration failed for "${domainPurchase.domain}":`, purchaseResult.error);
                  throw new Error(purchaseResult.error || 'Vercel domain registration failed');
                }

                console.log(`[Stripe Webhook] Domain ${domainPurchase.domain} registered successfully via Vercel`);

                if (domainPurchase.connectToWebsite) {
                  const website = await storage.getWebsite(domainPurchase.websiteId);
                  if (website?.deploymentUrl) {
                    const projectName = `site-${domainPurchase.websiteId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                    try {
                      await addCustomDomain(projectName, domainPurchase.domain, vercelConfig);
                    } catch (addErr: any) {
                      console.error('[Stripe Webhook] Failed to auto-connect domain:', addErr);
                    }

                    const domainParts = domainPurchase.domain.split('.');
                    const isSubdomain = domainParts.length > 2 || domainParts[0] === 'www';

                    await storage.createCustomDomain({
                      websiteId: domainPurchase.websiteId,
                      domain: domainPurchase.domain,
                      status: 'verifying',
                      vercelProjectId: projectName,
                      dnsType: isSubdomain ? 'CNAME' : 'A',
                      dnsName: isSubdomain ? domainParts[0] : '@',
                      dnsValue: isSubdomain ? 'cname.vercel-dns.com' : '76.76.21.21',
                    });
                  }
                }

                await storage.updateDomainPurchase(domainPurchase.id, {
                  status: 'completed',
                  completedAt: new Date(),
                });
                console.log(`[Stripe Webhook] Domain purchase ${domainPurchase.id} completed`);
              } catch (regErr: any) {
                console.error(`[Stripe Webhook] Domain registration failed:`, regErr);
                await storage.updateDomainPurchase(domainPurchase.id, {
                  status: 'failed',
                  errorMessage: regErr.message || 'Domain registration failed after payment',
                });
              }
            }
          }
        }
      }
    } catch (parseErr) {
      console.error('Error processing webhook event for order update:', parseErr);
    }
  }
}
