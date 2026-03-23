import { prisma } from "@/lib/db/prisma";
import { PLANS } from "./stripe";

export async function getUserPlan(
  userId: string
): Promise<"FREE" | "PRO" | "ENTERPRISE"> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId },
  });

  if (!subscription) return "FREE";

  // Check if subscription is still active (currentPeriodEnd in the future)
  if (
    subscription.plan !== "FREE" &&
    subscription.currentPeriodEnd &&
    new Date(subscription.currentPeriodEnd) < new Date()
  ) {
    return "FREE";
  }

  return subscription.plan as "FREE" | "PRO" | "ENTERPRISE";
}

export async function canAutoApply(
  userId: string
): Promise<{ allowed: boolean; remaining: number; plan: string }> {
  const plan = await getUserPlan(userId);
  const planConfig = PLANS[plan];
  const limit = planConfig.applicationsPerDay;

  // Count today's auto-applied applications
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const appliedToday = await prisma.application.count({
    where: {
      userId,
      autoApplied: true,
      appliedAt: { gte: todayStart },
    },
  });

  const remaining = Math.max(0, limit - appliedToday);

  return {
    allowed: remaining > 0,
    remaining,
    plan,
  };
}
