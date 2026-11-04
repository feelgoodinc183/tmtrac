import express from 'express';
import Stripe from 'stripe';
import { db, insertAuditLog, updateTenantSubscription, adjustTenantEventPasses, getPackageById } from './db';
import { requireAuth } from './gate';
import { PlanTier } from '../types/regatta';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';

export let stripeClient: Stripe | null = null;

if (stripeSecretKey) {
  try {
    stripeClient = new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia' as any,
    });
    console.log('[Stripe] Initialized Stripe SDK with key:', stripeSecretKey.slice(0, 10) + '...');
  } catch (e: any) {
    console.warn('[Stripe] Failed to initialize Stripe client:', e.message);
  }
} else {
  console.log('[Stripe] Notice: No STRIPE_SECRET_KEY defined. Simulator mode enabled.');
}

interface StripeRouteOptions {
  broadcastGlobal?: (event: string, payload: any) => void;
}

export function registerStripeRoutes(app: express.Express, options: StripeRouteOptions = {}) {
  const { broadcastGlobal = () => {} } = options;

  /**
   * 1. Public Stripe Configuration Status
   */
  app.get('/api/stripe/config', (req, res) => {
    const isLive = stripeSecretKey.startsWith('rk_live_') || stripeSecretKey.startsWith('sk_live_');
    res.json({
      success: true,
      configured: !!stripeClient,
      isLive,
      mode: isLive ? 'live' : (stripeSecretKey ? 'test' : 'simulator'),
      publishableKey: stripePublishableKey,
      webhookConfigured: !!stripeWebhookSecret,
      currency: 'USD',
      currencySymbol: '$',
    });
  });

  /**
   * 2. Create Stripe Hosted Checkout Session (Subscriptions or Event Passes)
   */
  app.post('/api/stripe/create-checkout-session', requireAuth(['ADMIN', 'RACE_OFFICER']), async (req, res) => {
    try {
      const user = req.gate!.user!;
      const tenant = req.gate!.tenant!;
      const { packageId, billingInterval = 'month', returnOrigin } = req.body || {};

      // Determine application base URL
      const hostHeader = req.headers.host || 'localhost:3000';
      const protoHeader = (req.headers['x-forwarded-proto'] as string) || (hostHeader.includes('localhost') ? 'http' : 'https');
      const origin = returnOrigin || process.env.APP_URL || `${protoHeader}://${hostHeader}`;

      // Resolve package or fallback
      let pkg: any = null;
      if (packageId) {
        pkg = getPackageById(packageId);
      }

      const isEventPass = billingInterval === 'event' || packageId === 'pkg-event-pass' || packageId === 'EVENT_PASS';
      const targetTier: PlanTier = (pkg?.tierKey as PlanTier) || (isEventPass ? 'CLUB' : 'CLUB');

      // Price determination
      let priceInCents = 4900;
      let displayTitle = 'TMTRAC Club Subscription';
      let description = 'Real-time telemetry, fleet tracking, and race officer management.';

      if (isEventPass) {
        priceInCents = Math.round((pkg?.priceAmount || 29) * 100);
        displayTitle = pkg?.displayTitle || 'TMTRAC Single Regatta Event Pass';
        description = 'One-time unlock for a high-capacity regatta event with live 4G/LoRa tracking.';
      } else if (pkg) {
        const intervalMultiplier = billingInterval === 'year' ? 10 : 1;
        priceInCents = Math.round((pkg.priceAmount * intervalMultiplier) * 100);
        displayTitle = `${pkg.displayTitle} (${billingInterval === 'year' ? 'Annual' : 'Monthly'})`;
        description = pkg.description || description;
      }

      // If Stripe client is unavailable, provide simulator fallback
      if (!stripeClient) {
        console.log('[Stripe Simulator] Generating simulation checkout session for tenant:', tenant.id);
        const simSessionId = 'sim_cs_' + Math.random().toString(36).substring(2, 12);
        const simUrl = `${origin}/?stripe=simulated&session_id=${simSessionId}&type=${isEventPass ? 'EVENT_PASS' : 'SUBSCRIPTION'}&target_tier=${targetTier}`;
        return res.json({
          success: true,
          simulator: true,
          checkoutUrl: simUrl,
          sessionId: simSessionId,
        });
      }

      // Ensure customer exists in Stripe
      let customerId = tenant.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeClient.customers.create({
          email: user.email,
          name: tenant.name,
          metadata: {
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            createdByUserId: user.id,
          },
        });
        customerId = customer.id;
        updateTenantSubscription(tenant.id, { stripeCustomerId: customerId });
      }

      const successUrl = `${origin}/?stripe=success&session_id={CHECKOUT_SESSION_ID}&type=${isEventPass ? 'EVENT_PASS' : 'SUBSCRIPTION'}`;
      const cancelUrl = `${origin}/?stripe=cancelled`;

      let session: Stripe.Checkout.Session;

      if (isEventPass) {
        // One-time payment mode for Single Regatta Pass
        session = await stripeClient.checkout.sessions.create({
          customer: customerId,
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: displayTitle,
                  description,
                  images: ['https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80'],
                },
                unit_amount: priceInCents,
              },
              quantity: 1,
            },
          ],
          metadata: {
            tenantId: tenant.id,
            userId: user.id,
            userEmail: user.email,
            packageId: pkg?.id || 'pkg-event-pass',
            type: 'EVENT_PASS',
            targetTier,
          },
          success_url: successUrl,
          cancel_url: cancelUrl,
        });
      } else {
        // Recurring subscription mode for Club / Event Pro tiers
        session = await stripeClient.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: displayTitle,
                  description,
                  images: ['https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=80'],
                },
                unit_amount: priceInCents,
                recurring: {
                  interval: billingInterval === 'year' ? 'year' : 'month',
                },
              },
              quantity: 1,
            },
          ],
          metadata: {
            tenantId: tenant.id,
            userId: user.id,
            userEmail: user.email,
            packageId: pkg?.id || 'pkg-club',
            type: 'SUBSCRIPTION',
            targetTier,
            billingInterval,
          },
          success_url: successUrl,
          cancel_url: cancelUrl,
        });
      }

      insertAuditLog({
        tenantId: tenant.id,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'STRIPE_CHECKOUT_CREATED',
        details: {
          sessionId: session.id,
          type: isEventPass ? 'EVENT_PASS' : 'SUBSCRIPTION',
          targetTier,
          priceAmount: priceInCents / 100,
        },
      });

      res.json({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    } catch (e: any) {
      console.error('[Stripe Checkout Error]:', e);
      res.status(500).json({ error: 'Failed to initiate Stripe Checkout: ' + e.message });
    }
  });

  /**
   * 3. Instant Return Session Verification & Activation
   * Called by client immediately upon redirect back (?stripe=success&session_id=...)
   */
  app.get('/api/stripe/verify-session', async (req, res) => {
    try {
      const sessionId = req.query.session_id as string;
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      // Handle simulator test session
      if (sessionId.startsWith('sim_cs_')) {
        const type = (req.query.type as string) || 'SUBSCRIPTION';
        const targetTier = (req.query.target_tier as PlanTier) || 'CLUB';
        const user = req.gate?.user;
        const tenantId = req.gate?.tenant?.id || user?.tenantId;

        if (tenantId) {
          if (type === 'EVENT_PASS') {
            const newBal = adjustTenantEventPasses(tenantId, 1);
            return res.json({ success: true, activated: true, type: 'EVENT_PASS', eventPassesBalance: newBal });
          } else {
            updateTenantSubscription(tenantId, {
              planTier: targetTier,
              subscriptionStatus: 'active',
              subscriptionCurrentPeriodEnd: Date.now() + 30 * 24 * 3600 * 1000,
            });
            broadcastGlobal('TENANT_UPDATED', { tenantId, planTier: targetTier });
            return res.json({ success: true, activated: true, type: 'SUBSCRIPTION', targetTier });
          }
        }
        return res.json({ success: true, activated: true, simulator: true });
      }

      if (!stripeClient) {
        return res.status(400).json({ error: 'Stripe client is not configured' });
      }

      const session = await stripeClient.checkout.sessions.retrieve(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Checkout session not found' });
      }

      const isPaid = session.payment_status === 'paid' || session.status === 'complete';
      const metadata = session.metadata || {};
      const tenantId = metadata.tenantId;

      if (!tenantId) {
        return res.json({ success: true, sessionStatus: session.status, isPaid });
      }

      if (isPaid) {
        if (metadata.type === 'EVENT_PASS') {
          const newBalance = adjustTenantEventPasses(tenantId, 1);
          insertAuditLog({
            tenantId,
            userId: metadata.userId,
            userEmail: metadata.userEmail,
            action: 'EVENT_PASS_ACTIVATED',
            details: { sessionId, newBalance },
          });
          broadcastGlobal('TENANT_UPDATED', { tenantId, eventPassesBalance: newBalance });
          return res.json({ success: true, activated: true, type: 'EVENT_PASS', eventPassesBalance: newBalance });
        } else {
          const targetTier = (metadata.targetTier as PlanTier) || 'CLUB';
          const subId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as any)?.id;
          updateTenantSubscription(tenantId, {
            planTier: targetTier,
            stripeSubscriptionId: subId || undefined,
            subscriptionStatus: 'active',
            subscriptionCurrentPeriodEnd: Date.now() + 30 * 24 * 3600 * 1000,
          });
          insertAuditLog({
            tenantId,
            userId: metadata.userId,
            userEmail: metadata.userEmail,
            action: 'SUBSCRIPTION_ACTIVATED',
            details: { sessionId, targetTier, subscriptionId: subId },
          });
          broadcastGlobal('TENANT_UPDATED', { tenantId, planTier: targetTier });
          return res.json({ success: true, activated: true, type: 'SUBSCRIPTION', targetTier });
        }
      }

      res.json({ success: true, activated: false, paymentStatus: session.payment_status });
    } catch (e: any) {
      console.error('[Stripe Verify Error]:', e);
      res.status(500).json({ error: 'Failed to verify Stripe session: ' + e.message });
    }
  });

  /**
   * 4. Create Stripe Customer Portal Session
   */
  app.post('/api/stripe/create-portal-session', requireAuth(['ADMIN']), async (req, res) => {
    try {
      const tenant = req.gate!.tenant!;
      const hostHeader = req.headers.host || 'localhost:3000';
      const protoHeader = (req.headers['x-forwarded-proto'] as string) || (hostHeader.includes('localhost') ? 'http' : 'https');
      const origin = process.env.APP_URL || `${protoHeader}://${hostHeader}`;

      if (!stripeClient) {
        return res.status(400).json({ error: 'Stripe is currently operating in simulation mode.' });
      }

      if (!tenant.stripeCustomerId) {
        return res.status(400).json({
          error: 'No active Stripe billing profile found for this organization. Please subscribe first to open the customer portal.',
        });
      }

      const portalSession = await stripeClient.billingPortal.sessions.create({
        customer: tenant.stripeCustomerId,
        return_url: `${origin}/`,
      });

      res.json({ success: true, portalUrl: portalSession.url });
    } catch (e: any) {
      console.error('[Stripe Customer Portal Error]:', e);
      res.status(500).json({ error: 'Failed to create Customer Portal session: ' + e.message });
    }
  });

  /**
   * 5. Asynchronous Stripe Webhook Handler
   */
  app.post('/api/stripe/webhook', async (req, res) => {
    let event: Stripe.Event;

    if (!stripeClient) {
      return res.status(200).json({ received: true, note: 'simulator_mode' });
    }

    const sig = req.headers['stripe-signature'];

    try {
      if (stripeWebhookSecret && sig) {
        event = stripeClient.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
      } else {
        const rawBody = typeof req.body === 'string' ? req.body : (req.body?.toString?.('utf-8') || JSON.stringify(req.body));
        event = JSON.parse(rawBody);
      }
    } catch (err: any) {
      console.error(`[Stripe Webhook Signature Error]:`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`[Stripe Webhook Event]: ${event.type} (ID: ${event.id})`);

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const metadata = session.metadata || {};
          const tenantId = metadata.tenantId;

          if (tenantId) {
            if (metadata.type === 'EVENT_PASS') {
              const newBal = adjustTenantEventPasses(tenantId, 1);
              insertAuditLog({
                tenantId,
                userId: metadata.userId,
                userEmail: metadata.userEmail,
                action: 'WEBHOOK_EVENT_PASS_CREDITED',
                details: { sessionId: session.id, newBalance: newBal },
              });
              broadcastGlobal('TENANT_UPDATED', { tenantId, eventPassesBalance: newBal });
            } else {
              const targetTier = (metadata.targetTier as PlanTier) || 'CLUB';
              const subId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as any)?.id;
              updateTenantSubscription(tenantId, {
                planTier: targetTier,
                stripeSubscriptionId: subId || undefined,
                subscriptionStatus: 'active',
                subscriptionCurrentPeriodEnd: Date.now() + 30 * 24 * 3600 * 1000,
              });
              insertAuditLog({
                tenantId,
                userId: metadata.userId,
                userEmail: metadata.userEmail,
                action: 'WEBHOOK_SUBSCRIPTION_ACTIVATED',
                details: { sessionId: session.id, targetTier, subscriptionId: subId },
              });
              broadcastGlobal('TENANT_UPDATED', { tenantId, planTier: targetTier });
            }
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          const tenantRow = db.prepare('SELECT id FROM tenants WHERE stripe_subscription_id = ? OR stripe_customer_id = ?').get(sub.id, sub.customer as string) as any;
          if (tenantRow) {
            updateTenantSubscription(tenantRow.id, {
              subscriptionStatus: sub.status,
              subscriptionCurrentPeriodEnd: (sub as any).current_period_end ? (sub as any).current_period_end * 1000 : undefined,
            });
            broadcastGlobal('TENANT_UPDATED', { tenantId: tenantRow.id, subscriptionStatus: sub.status });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const tenantRow = db.prepare('SELECT id FROM tenants WHERE stripe_subscription_id = ? OR stripe_customer_id = ?').get(sub.id, sub.customer as string) as any;
          if (tenantRow) {
            updateTenantSubscription(tenantRow.id, {
              planTier: 'FREE',
              subscriptionStatus: 'canceled',
            });
            insertAuditLog({
              tenantId: tenantRow.id,
              action: 'SUBSCRIPTION_CANCELED_DOWNGRADED',
              details: { subscriptionId: sub.id },
            });
            broadcastGlobal('TENANT_UPDATED', { tenantId: tenantRow.id, planTier: 'FREE', subscriptionStatus: 'canceled' });
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;
          const tenantRow = db.prepare('SELECT id FROM tenants WHERE stripe_customer_id = ?').get(customerId) as any;
          if (tenantRow) {
            updateTenantSubscription(tenantRow.id, {
              subscriptionStatus: 'past_due',
            });
            insertAuditLog({
              tenantId: tenantRow.id,
              action: 'INVOICE_PAYMENT_FAILED',
              details: { invoiceId: invoice.id, amountDue: invoice.amount_due },
            });
            broadcastGlobal('TENANT_UPDATED', { tenantId: tenantRow.id, subscriptionStatus: 'past_due' });
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (e: any) {
      console.error('[Stripe Webhook Processing Error]:', e);
      res.status(500).json({ error: 'Webhook processing error: ' + e.message });
    }
  });
}
