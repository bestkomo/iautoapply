"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Brain,
  CreditCard,
  AlertTriangle,
  Save,
  Loader2,
  Check,
  Crown,
  Sparkles,
  Zap,
} from "lucide-react";

interface UserProfile {
  name: string;
  email: string;
}

interface Subscription {
  plan: "FREE" | "PRO" | "ENTERPRISE";
  currentPeriodEnd: string | null;
}

const AI_FEATURES = [
  { key: "resume", label: "Resume Builder" },
  { key: "coverLetter", label: "Cover Letters" },
  { key: "scanner", label: "Job Scanner" },
  { key: "translate", label: "Translate" },
  { key: "interview", label: "Interview Practice" },
  { key: "interviewBuddy", label: "Interview Buddy" },
  { key: "networking", label: "Networking" },
];

const PROVIDERS = [
  { value: "claude", label: "Claude (Anthropic)" },
  { value: "openai", label: "GPT-4o (OpenAI)" },
];

const PLAN_DETAILS: Record<
  string,
  { label: string; color: string; price: number; features: string[] }
> = {
  FREE: {
    label: "Free",
    color: "bg-muted text-muted-foreground",
    price: 0,
    features: [
      "Job search & browsing",
      "Resume upload",
      "Basic ATS scoring",
    ],
  },
  PRO: {
    label: "Pro",
    color: "bg-primary text-primary-foreground",
    price: 29,
    features: [
      "50 auto-applies/day",
      "Priority job matching",
      "Gmail inbox integration",
      "All ATS platforms",
      "Email support",
    ],
  },
  ENTERPRISE: {
    label: "Enterprise",
    color: "bg-amber-500 text-white",
    price: 49,
    features: [
      "200 auto-applies/day",
      "Everything in Pro",
      "Custom email domain",
      "Dedicated support",
      "API access",
    ],
  },
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    email: "",
  });
  const [subscription, setSubscription] = useState<Subscription>({
    plan: "FREE",
    currentPeriodEnd: null,
  });
  const [aiPreferences, setAiPreferences] = useState<Record<string, string>>(
    {}
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [managingBilling, setManagingBilling] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile({ name: data.name || "", email: data.email || "" });
          if (data.subscription) {
            setSubscription(data.subscription);
          }
        }
      } catch {
        // Profile may not exist yet
      }

      // Load AI preferences from localStorage
      try {
        const stored = localStorage.getItem("iautoapply_ai_prefs");
        if (stored) setAiPreferences(JSON.parse(stored));
      } catch {
        // Ignore
      }

      setLoading(false);
    }
    load();
  }, []);

  // Check for payment status in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      // Reload subscription data after successful payment
      fetch("/api/profile")
        .then((res) => res.json())
        .then((data) => {
          if (data.subscription) setSubscription(data.subscription);
        })
        .catch(() => {});
      // Clean URL
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  const saveProfile = useCallback(async () => {
    setSaving("profile");
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
        }),
      });
      setSaved("profile");
      setTimeout(() => setSaved(null), 2000);
    } catch {
      console.error("Failed to save profile");
    } finally {
      setSaving(null);
    }
  }, [profile]);

  const saveAiPreferences = useCallback(() => {
    setSaving("ai");
    try {
      localStorage.setItem(
        "iautoapply_ai_prefs",
        JSON.stringify(aiPreferences)
      );
      setSaved("ai");
      setTimeout(() => setSaved(null), 2000);
    } catch {
      console.error("Failed to save AI preferences");
    } finally {
      setSaving(null);
    }
  }, [aiPreferences]);

  const handleUpgrade = async (plan: "PRO" | "ENTERPRISE") => {
    setUpgrading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Failed to create checkout session:", error);
    } finally {
      setUpgrading(null);
    }
  };

  const handleManageBilling = async () => {
    setManagingBilling(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No portal URL returned");
      }
    } catch (error) {
      console.error("Failed to open billing portal:", error);
    } finally {
      setManagingBilling(false);
    }
  };

  const planInfo = PLAN_DETAILS[subscription.plan] || PLAN_DETAILS.FREE;

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-xl bg-muted ring-1 ring-foreground/10"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>
            Update your personal information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={profile.name}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="your@email.com"
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={saveProfile} disabled={saving === "profile"}>
            {saving === "profile" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved === "profile" ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saved === "profile" ? "Saved" : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>

      {/* AI Provider Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Preferences
          </CardTitle>
          <CardDescription>
            Choose your default AI provider for each feature
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {AI_FEATURES.map((feature) => (
            <div
              key={feature.key}
              className="flex items-center justify-between"
            >
              <Label className="text-sm">{feature.label}</Label>
              <div className="flex gap-2">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider.value}
                    type="button"
                    onClick={() =>
                      setAiPreferences((prev) => ({
                        ...prev,
                        [feature.key]: provider.value,
                      }))
                    }
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      (aiPreferences[feature.key] || "claude") ===
                      provider.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {provider.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={saveAiPreferences} disabled={saving === "ai"}>
            {saving === "ai" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved === "ai" ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saved === "ai" ? "Saved" : "Save Preferences"}
          </Button>
        </CardFooter>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
          <CardDescription>
            Manage your subscription and billing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Current Plan</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`${planInfo.color} border-0`}>
                  {subscription.plan === "PRO" && (
                    <Crown className="mr-1 h-3 w-3" />
                  )}
                  {subscription.plan === "ENTERPRISE" && (
                    <Sparkles className="mr-1 h-3 w-3" />
                  )}
                  {planInfo.label}
                </Badge>
                {subscription.currentPeriodEnd && (
                  <span className="text-xs text-muted-foreground">
                    Renews{" "}
                    {new Date(
                      subscription.currentPeriodEnd
                    ).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            {subscription.plan !== "FREE" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleManageBilling}
                disabled={managingBilling}
              >
                {managingBilling ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-1 h-4 w-4" />
                )}
                Manage Billing
              </Button>
            )}
          </div>

          <Separator />

          {/* Plan features for current plan */}
          <div>
            <p className="text-sm font-medium mb-2">Your Plan Features</p>
            <ul className="space-y-1.5">
              {planInfo.features.map((feature, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Upgrade options for FREE users */}
          {subscription.plan === "FREE" && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-3">Upgrade Your Plan</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Pro Plan */}
                  <div className="rounded-lg border-2 border-primary p-4 relative">
                    <div className="absolute -top-2.5 left-3">
                      <Badge className="bg-primary text-primary-foreground border-0 text-xs">
                        Most Popular
                      </Badge>
                    </div>
                    <div className="mt-1">
                      <h4 className="font-semibold flex items-center gap-1">
                        <Crown className="h-4 w-4" />
                        Pro
                      </h4>
                      <p className="text-2xl font-bold mt-1">
                        $29<span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {PLAN_DETAILS.PRO.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Check className="h-3 w-3 text-green-500 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="w-full mt-3"
                        size="sm"
                        onClick={() => handleUpgrade("PRO")}
                        disabled={upgrading === "PRO"}
                      >
                        {upgrading === "PRO" ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="mr-1 h-4 w-4" />
                        )}
                        Upgrade to Pro
                      </Button>
                    </div>
                  </div>

                  {/* Enterprise Plan */}
                  <div className="rounded-lg border p-4">
                    <h4 className="font-semibold flex items-center gap-1">
                      <Sparkles className="h-4 w-4" />
                      Enterprise
                    </h4>
                    <p className="text-2xl font-bold mt-1">
                      $49<span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      {PLAN_DETAILS.ENTERPRISE.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Check className="h-3 w-3 text-green-500 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full mt-3"
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpgrade("ENTERPRISE")}
                      disabled={upgrading === "ENTERPRISE"}
                    >
                      {upgrading === "ENTERPRISE" ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 h-4 w-4" />
                      )}
                      Upgrade to Enterprise
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Upgrade option for PRO users to Enterprise */}
          {subscription.plan === "PRO" && (
            <>
              <Separator />
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">Need more?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Upgrade to Enterprise for 200 auto-applies/day, API access, and dedicated support.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpgrade("ENTERPRISE")}
                  disabled={upgrading === "ENTERPRISE"}
                >
                  {upgrading === "ENTERPRISE" ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-4 w-4" />
                  )}
                  $49/mo
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-4">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently delete your account and all associated data. This
                action cannot be undone.
              </p>
            </div>
            <Button variant="destructive" size="sm">
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
