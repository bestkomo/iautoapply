import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Zap,
  Briefcase,
  MessageSquare,
  BarChart3,
  Users,
  Search,
  Globe,
  ArrowRight,
  CheckCircle2,
  Star,
  Check,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "AI Resume Builder",
    description:
      "Generate ATS-optimized resumes tailored to any job description with multiple professional templates.",
  },
  {
    icon: Zap,
    title: "Auto-Apply Engine",
    description:
      "Automatically apply to hundreds of matching jobs while you sleep. Set your preferences and let AI do the rest.",
  },
  {
    icon: Briefcase,
    title: "Job Aggregation",
    description:
      "Search jobs from Indeed, LinkedIn, Glassdoor, and more -- all in one unified platform.",
  },
  {
    icon: MessageSquare,
    title: "AI Interview Coach",
    description:
      "Practice with realistic AI interviews and get real-time coaching during actual interviews.",
  },
  {
    icon: Search,
    title: "Resume Scanner",
    description:
      "Get instant ATS scores, keyword analysis, and actionable improvement suggestions.",
  },
  {
    icon: Users,
    title: "Networking Assistant",
    description:
      "Generate personalized LinkedIn messages, cold emails, and follow-ups that get responses.",
  },
  {
    icon: Globe,
    title: "Resume Translator",
    description:
      "Translate your resume into 50+ languages for global job applications.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "Track applications, response rates, and interview pipeline with detailed analytics.",
  },
];

const stats = [
  { value: "10x", label: "Faster Applications" },
  { value: "85%", label: "ATS Pass Rate" },
  { value: "3x", label: "More Interviews" },
  { value: "50+", label: "Languages Supported" },
];

const testimonials = [
  {
    quote:
      "Applied to 200+ jobs in my first week. Got 5 interviews and landed a role at a Fortune 500 company.",
    name: "Sarah M.",
    title: "Software Engineer",
  },
  {
    quote:
      "The AI resume builder helped me optimize my resume. My interview rate went from 2% to 15%.",
    name: "James K.",
    title: "Product Manager",
  },
  {
    quote:
      "I was skeptical about auto-apply, but it saved me 40+ hours of manual applications.",
    name: "Maria L.",
    title: "Data Analyst",
  },
];

const companyNames = [
  "Google",
  "Meta",
  "Netflix",
  "Stripe",
  "Microsoft",
  "Amazon",
  "Apple",
  "Spotify",
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    description: "Get started with the basics",
    features: [
      "3 AI resumes",
      "5 job searches",
      "2 interview sessions",
      "Basic ATS scoring",
      "Email support",
    ],
    cta: "Get Started Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    description: "For serious job seekers",
    features: [
      "Unlimited AI resumes",
      "Unlimited job searches",
      "50 auto-applies/day",
      "Unlimited interview sessions",
      "Priority support",
      "Advanced analytics",
    ],
    cta: "Start Pro Trial",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Enterprise",
    price: "$49",
    period: "/mo",
    description: "Maximum power for your search",
    features: [
      "Everything in Pro",
      "200 auto-applies/day",
      "API access",
      "Dedicated support",
      "Custom resume templates",
      "Team management",
    ],
    cta: "Start Enterprise Trial",
    highlighted: false,
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-16">
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
            iAutoApply
          </span>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">
              Testimonials
            </a>
            <a href="#pricing" className="hover:text-foreground transition-colors">
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero with animated gradient */}
      <section className="relative overflow-hidden py-24 md:py-32">
        {/* Animated gradient background */}
        <div className="absolute inset-0 hero-gradient-bg" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),transparent)]" />

        <div className="max-w-7xl mx-auto px-4 text-center relative">
          <div className="inline-flex items-center rounded-full border border-border bg-background/60 backdrop-blur-sm px-4 py-1.5 text-sm mb-6 shadow-sm">
            <Zap className="h-4 w-4 mr-2 text-yellow-500" />
            AI-Powered Job Search Platform
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.1]">
            Land Your Dream Job{" "}
            <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-shift">
              10x Faster
            </span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            AI-powered resume building, automated job applications, interview
            coaching, and job aggregation from every major platform -- all in one
            place.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button
                size="lg"
                className="text-lg px-8 h-12 shadow-lg shadow-primary/25"
              >
                Start Free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 h-12"
              >
                See Features
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">
              Everything You Need to Get Hired
            </h2>
            <p className="text-muted-foreground mt-4 text-lg max-w-2xl mx-auto">
              From resume creation to auto-applying and interview prep -- we
              cover your entire job search journey.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-card p-6 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 group-hover:bg-primary/15 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section
        id="testimonials"
        className="py-24 bg-card/50 border-y border-border"
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">
              Loved by Job Seekers
            </h2>
            <p className="text-muted-foreground mt-4 text-lg max-w-2xl mx-auto">
              Join thousands who transformed their job search with iAutoApply
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.name}
                className="rounded-xl border border-border bg-background p-6 flex flex-col"
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>
                <blockquote className="text-sm leading-relaxed flex-1">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="font-semibold text-sm">{testimonial.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Company logos */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground mb-8 uppercase tracking-wider font-medium">
            Trusted by job seekers hired at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {companyNames.map((name) => (
              <span
                key={name}
                className="text-xl md:text-2xl font-bold text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors select-none"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-card/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">How It Works</h2>
            <p className="text-muted-foreground mt-4 text-lg">
              Three simple steps to your next role
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
            {[
              {
                step: "1",
                title: "Build Your Profile",
                description:
                  "Add your experience, skills, and preferences. Our AI learns what makes you unique.",
              },
              {
                step: "2",
                title: "Let AI Work For You",
                description:
                  "Generate tailored resumes, find matching jobs, and auto-apply to hundreds of positions.",
              },
              {
                step: "3",
                title: "Ace Your Interviews",
                description:
                  "Practice with AI interviews, get real-time coaching, and track your pipeline to the offer.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold shadow-lg shadow-primary/25">
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">
              Simple, Transparent Pricing
            </h2>
            <p className="text-muted-foreground mt-4 text-lg max-w-2xl mx-auto">
              Start free and scale as you need. No hidden fees, cancel anytime.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-xl border p-6 flex flex-col ${
                  plan.highlighted
                    ? "border-primary bg-primary/[0.02] shadow-lg shadow-primary/10 scale-[1.02] md:scale-105"
                    : "border-border bg-card"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.description}
                  </p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 flex-1 mb-6">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    size="lg"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-card/50 border-t border-border">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to Transform Your Job Search?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join thousands of job seekers who landed their dream jobs faster with
            AI.
          </p>
          <div className="mt-8 space-y-4">
            <Link href="/register">
              <Button
                size="lg"
                className="text-lg px-8 h-12 shadow-lg shadow-primary/25"
              >
                Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mt-4">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> Free tier
                available
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" /> No credit
                card required
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; 2026 iAutoApply. All rights reserved.</p>
        </div>
      </footer>

      {/* Inline styles for the animated gradient */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .hero-gradient-bg {
              background: linear-gradient(
                135deg,
                rgba(59, 130, 246, 0.06) 0%,
                rgba(147, 51, 234, 0.06) 25%,
                rgba(59, 130, 246, 0.03) 50%,
                rgba(147, 51, 234, 0.06) 75%,
                rgba(59, 130, 246, 0.06) 100%
              );
              background-size: 400% 400%;
              animation: gradient-flow 15s ease infinite;
            }
            @keyframes gradient-flow {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            @keyframes gradient-shift {
              0% { background-position: 0% center; }
              50% { background-position: 100% center; }
              100% { background-position: 0% center; }
            }
            .animate-gradient-shift {
              animation: gradient-shift 6s ease infinite;
            }
          `,
        }}
      />
    </div>
  );
}
