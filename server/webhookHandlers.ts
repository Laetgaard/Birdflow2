import { getStripeSync } from './stripeClient';
import { storage } from './storage';
import { emailService } from './email/service';

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

        // Onboarding subscription completed → the user is now onboarded.
        // Deliberately here and not at session creation: an abandoned
        // checkout must NOT lock the user out of /onboarding.
        if (session?.metadata?.type === 'onboarding' && session.metadata.userId) {
          try {
            await storage.completeOnboarding(session.metadata.userId);
            console.log(`[Stripe Webhook] Onboarding completed for user ${session.metadata.userId}`);
          } catch (err) {
            console.error('[Stripe Webhook] Failed to mark onboarding complete:', err);
          }
        }

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
        }
      }
    } catch (parseErr) {
      console.error('Error processing webhook event for order update:', parseErr);
    }
  }
}
