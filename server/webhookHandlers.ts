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
        const session = event.data?.object;
        if (session?.id) {
          const sessionId = session.id;
          const paymentIntentId = session.payment_intent;

          // Update order payment status
          const order = await storage.getOrderByStripeSessionId(sessionId);
          if (order) {
            await storage.updateOrderByStripeSessionId(sessionId, {
              paymentStatus: 'paid',
              status: 'confirmed',
              stripePaymentIntentId: paymentIntentId,
            });
            console.log(`Order ${order.id} marked as paid via checkout.session.completed`);

            // Decrement stock for tracked products after payment success
            if (order.items && Array.isArray(order.items)) {
              for (const item of order.items as Array<{ id: string; quantity: number }>) {
                if (item.id && item.quantity) {
                  try {
                    await storage.decrementProductStock(item.id, item.quantity);
                    console.log(`Decremented stock for product ${item.id} by ${item.quantity}`);
                  } catch (stockErr) {
                    console.error(`Failed to decrement stock for product ${item.id}:`, stockErr);
                  }
                }
              }
            }

            // Send order confirmation email
            if (order.customerEmail) {
              try {
                // Get website to determine published URL for button link
                const website = await storage.getWebsite(order.websiteId);
                const websiteUrl = website?.deploymentUrl || undefined;
                
                // Get updated order with confirmed status
                const updatedOrder = await storage.getOrderByStripeSessionId(sessionId);
                if (updatedOrder) {
                  await emailService.sendOrderConfirmation(
                    updatedOrder,
                    order.customerEmail,
                    websiteUrl
                  );
                  console.log(`Order confirmation email sent to ${order.customerEmail}`);
                }
              } catch (emailErr) {
                console.error(`Failed to send order confirmation email:`, emailErr);
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
