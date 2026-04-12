import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - iAutoApply",
  description:
    "Privacy Policy for iAutoApply. Learn how we collect, use, and protect your personal data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to Home
        </Link>

        <h1 className="text-4xl font-bold mt-8 mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">
          Last updated: April 2026
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              1. Introduction
            </h2>
            <p>
              iAutoApply (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
              operates the website at{" "}
              <span className="text-foreground font-medium">
                iautoaply.com
              </span>
              . This Privacy Policy explains how we collect, use, disclose, and
              safeguard your information when you use our job application
              automation platform. By using iAutoApply, you agree to the
              collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              2. Information We Collect
            </h2>
            <h3 className="text-base font-medium text-foreground mt-4 mb-2">
              2.1 Information You Provide
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="text-foreground font-medium">
                  Account information:
                </span>{" "}
                name, email address, and password (or Google OAuth credentials).
              </li>
              <li>
                <span className="text-foreground font-medium">
                  Resume and profile data:
                </span>{" "}
                resumes, cover letters, work history, education, skills, and
                other career-related information you upload or generate.
              </li>
              <li>
                <span className="text-foreground font-medium">
                  Job preferences:
                </span>{" "}
                desired job titles, locations, salary expectations, and other
                search criteria.
              </li>
              <li>
                <span className="text-foreground font-medium">
                  Billing information:
                </span>{" "}
                payment details are collected and processed by Stripe. We do not
                store full credit card numbers on our servers.
              </li>
            </ul>

            <h3 className="text-base font-medium text-foreground mt-4 mb-2">
              2.2 Information Collected Automatically
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Device and browser information (user agent, IP address).
              </li>
              <li>
                Usage data such as pages visited, features used, and time spent
                on the platform.
              </li>
              <li>Cookies and similar tracking technologies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                To operate and provide the iAutoApply service, including
                automatically applying to jobs on your behalf.
              </li>
              <li>
                To generate and optimize resumes and cover letters using AI.
              </li>
              <li>
                To match you with relevant job opportunities based on your
                preferences.
              </li>
              <li>
                To process payments and manage your subscription.
              </li>
              <li>
                To send service-related communications (application status
                updates, account notifications).
              </li>
              <li>
                To improve and personalize your experience on the platform.
              </li>
              <li>
                To comply with legal obligations and enforce our Terms of
                Service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              4. Third-Party Services
            </h2>
            <p className="mb-3">
              We integrate with third-party services to provide our platform.
              These services have their own privacy policies:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="text-foreground font-medium">
                  Google OAuth:
                </span>{" "}
                used for account authentication. We receive your name, email,
                and profile picture from Google.
              </li>
              <li>
                <span className="text-foreground font-medium">Stripe:</span>{" "}
                used for payment processing. Stripe collects and processes your
                payment information securely.
              </li>
              <li>
                <span className="text-foreground font-medium">
                  Job board APIs (Greenhouse, Lever, Workday, Adzuna):
                </span>{" "}
                we submit your application data to these platforms on your
                behalf when auto-applying to jobs.
              </li>
              <li>
                <span className="text-foreground font-medium">
                  AI / language model providers:
                </span>{" "}
                used to generate resumes, cover letters, and interview coaching
                content. Your data may be sent to these providers for
                processing.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              5. Data Security
            </h2>
            <p>
              We implement commercially reasonable technical and organizational
              measures to protect your personal data, including encryption in
              transit (TLS/SSL), secure database storage, and access controls.
              However, no method of transmission over the internet or electronic
              storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              6. Data Retention
            </h2>
            <p>
              We retain your personal data for as long as your account is active
              or as needed to provide services. If you delete your account, we
              will delete or anonymize your personal data within 30 days, except
              where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              7. Your Rights
            </h2>
            <p className="mb-3">
              Depending on your location, you may have the following rights
              regarding your personal data:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="text-foreground font-medium">Access:</span>{" "}
                request a copy of the personal data we hold about you.
              </li>
              <li>
                <span className="text-foreground font-medium">
                  Correction:
                </span>{" "}
                request that we correct inaccurate or incomplete data.
              </li>
              <li>
                <span className="text-foreground font-medium">Deletion:</span>{" "}
                request deletion of your account and associated personal data.
              </li>
              <li>
                <span className="text-foreground font-medium">
                  Data export:
                </span>{" "}
                request a portable copy of your data.
              </li>
              <li>
                <span className="text-foreground font-medium">
                  Opt out of marketing:
                </span>{" "}
                unsubscribe from promotional emails at any time.
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{" "}
              <a
                href="mailto:pskomo123@gmail.com"
                className="text-foreground font-medium underline underline-offset-4 hover:text-primary"
              >
                pskomo123@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              8. Cookies
            </h2>
            <p>
              We use cookies and similar technologies to maintain your session,
              remember your preferences, and analyze usage. Essential cookies are
              required for the platform to function. You can control
              non-essential cookies through your browser settings. Disabling
              cookies may affect the functionality of certain features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              9. Children&apos;s Privacy
            </h2>
            <p>
              iAutoApply is not intended for use by individuals under the age of
              16. We do not knowingly collect personal data from children. If we
              learn that we have collected data from a child under 16, we will
              delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of material changes by posting the updated policy on
              this page and updating the &quot;Last updated&quot; date. Your
              continued use of iAutoApply after changes constitutes acceptance of
              the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              11. Contact Us
            </h2>
            <p>
              If you have questions or concerns about this Privacy Policy,
              contact us at:{" "}
              <a
                href="mailto:pskomo123@gmail.com"
                className="text-foreground font-medium underline underline-offset-4 hover:text-primary"
              >
                pskomo123@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
