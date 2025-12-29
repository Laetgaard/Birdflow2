import { getStripeSync } from './stripeClient';
import { storage } from './storage';

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
    
    // Process webhook and get the event from stripeSync
    const result = await sync.processWebhook(payload, signature);
    
    // Handle checkout.session.completed to update order payment status
    // stripeSync already validated the event, so we parse it directly
    try {
      const event = JSON.parse(payload.toString());
      
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
          }
        }
      }
    } catch (parseErr) {
      console.error('Error parsing webhook event for order update:', parseErr);
    }
  }
}
