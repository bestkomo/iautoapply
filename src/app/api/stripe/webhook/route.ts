import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/stripe";
import Database from "better-sqlite3";
import { resolve } from "path";
import Stripe from "stripe";

export const runtime = "nodejs";

function getDb() {
  return new Database(resolve(process.cwd(), "prisma", "dev.db"));
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  const db = getDb();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan || "PRO";
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!userId) {
          console.error("[Stripe Webhook] No userId in session metadata");
          break;
        }

        // Retrieve the subscription to get the current period end
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPeriodEnd = new Date(
          subscription.current_period_end * 1000
        ).toISOString();

        // Upsert subscription record
        const existing = db
          .prepare("SELECT id FROM Subscription WHERE userId = ?")
          .get(userId) as { id: string } | undefined;

        if (existing) {
          db.prepare(
            `UPDATE Subscription
             SET plan = ?, stripeCustomerId = ?, stripeSubId = ?, currentPeriodEnd = ?
             WHERE userId = ?`
          ).run(plan, customerId, subscriptionId, currentPeriodEnd, userId);
        } else {
          const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
          db.prepare(
            `INSERT INTO Subscription (id, userId, plan, stripeCustomerId, stripeSubId, currentPeriodEnd, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(
            id,
            userId,
            plan,
            customerId,
            subscriptionId,
            currentPeriodEnd,
            new Date().toISOString()
          );
        }

        console.log(
          `[Stripe Webhook] checkout.session.completed: userId=${userId}, plan=${plan}`
        );
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) break;

        // Retrieve the subscription to get updated period end
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPeriodEnd = new Date(
          subscription.current_period_end * 1000
        ).toISOString();

        db.prepare(
          `UPDATE Subscription SET currentPeriodEnd = ? WHERE stripeSubId = ?`
        ).run(currentPeriodEnd, subscriptionId);

        console.log(
          `[Stripe Webhook] invoice.payment_succeeded: subId=${subscriptionId}`
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        db.prepare(
          `UPDATE Subscription SET plan = 'FREE', stripeSubId = NULL, currentPeriodEnd = NULL WHERE stripeSubId = ?`
        ).run(subscriptionId);

        console.log(
          `[Stripe Webhook] customer.subscription.deleted: subId=${subscriptionId}`
        );
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error("[Stripe Webhook] Error processing event:", error);
    db.close();
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  db.close();
  return NextResponse.json({ received: true });
}
