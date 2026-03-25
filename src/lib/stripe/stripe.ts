import Stripe from "stripe";

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-03-31.basil" as any,
    });
  }
  return _stripe;
}

// Keep backward-compatible export using lazy proxy
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});

export const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    applicationsPerDay: 5,
    features: [
      "5 auto-applies/day",
      "Job search",
      "Resume upload",
    ],
  },
  PRO: {
    name: "Pro",
    price: 29,
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    applicationsPerDay: 50,
    features: [
      "50 auto-applies/day",
      "Priority job matching",
      "Gmail inbox integration",
      "All ATS platforms",
      "Email support",
    ],
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: 49,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
    applicationsPerDay: 200,
    features: [
      "200 auto-applies/day",
      "Everything in Pro",
      "Custom email domain",
      "Dedicated support",
      "API access",
    ],
  },
};
