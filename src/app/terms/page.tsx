import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - iAutoApply",
  description:
    "Terms of Service for iAutoApply. Review the terms governing your use of our job application automation platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to Home
        </Link>

        <h1 className="text-4xl font-bold mt-8 mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-12">
          Last updated: April 2026
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              1. Agreement to Terms
            </h2>
            <p>
              By accessing or using iAutoApply (&quot;the Service&quot;),
              operated at{" "}
              <span className="text-foreground font-medium">
                iautoaply.com
              </span>
              , you agree to be bound by these Terms of Service. If you do not
              agree, do not use the Service. We may modify these Terms at any
              time; continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              2. Service Description
            </h2>
            <p>
              iAutoApply is a job application automation platform that uses AI to
              help users create resumes, search for jobs, and automatically apply
              to job postings on supported platforms (including Greenhouse,
              Lever, and Workday). The Service also provides AI-powered interview
              coaching, resume scanning, and job tracking features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              3. User Accounts
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                You must create an account to use iAutoApply. You may register
                using an email address or through Google OAuth.
              </li>
              <li>
                You are responsible for maintaining the confidentiality of your
                account credentials and for all activity under your account.
              </li>
              <li>
                You must provide accurate and complete information when creating
                your account and keep it up to date.
              </li>
              <li>
                You must be at least 16 years old to use the Service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              4. Subscriptions and Billing
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                iAutoApply offers a{" "}
                <span className="text-foreground font-medium">Free tier</span>{" "}
                with limited features and a{" "}
                <span className="text-foreground font-medium">
                  Pro plan at $29/month
                </span>{" "}
                with full access to auto-apply and all premium features.
              </li>
              <li>
                Pro subscriptions are billed monthly through Stripe. By
                subscribing, you authorize recurring charges until you cancel.
              </li>
              <li>
                You may cancel your subscription at any time. Cancellation takes
                effect at the end of the current billing cycle. No partial
                refunds are provided for the remaining period.
              </li>
              <li>
                We reserve the right to change pricing with 30 days&apos; notice.
                Continued use after a price change constitutes acceptance.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              5. Auto-Apply Disclaimer
            </h2>
            <p>
              iAutoApply submits job applications to third-party platforms on
              your behalf using information you provide (resumes, cover letters,
              profile data). By using the auto-apply feature, you acknowledge and
              agree that:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>
                <span className="text-foreground font-medium">
                  No guarantees:
                </span>{" "}
                We do not guarantee that you will receive interviews, job offers,
                or any specific outcome from applications submitted through our
                platform.
              </li>
              <li>
                <span className="text-foreground font-medium">
                  Third-party platforms:
                </span>{" "}
                Applications are subject to the terms, policies, and
                availability of third-party job boards and applicant tracking
                systems. We are not responsible for how those platforms handle
                your data or applications.
              </li>
              <li>
                <span className="text-foreground font-medium">
                  Accuracy of submissions:
                </span>{" "}
                You are responsible for ensuring the information in your profile
                and resumes is accurate and truthful. We are not liable for
                applications submitted with incorrect information.
              </li>
              <li>
                <span className="text-foreground font-medium">
                  Application volume:
                </span>{" "}
                Auto-apply limits and availability may vary. We do not guarantee
                a specific number of applications per day.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              6. Acceptable Use
            </h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Use the Service for any unlawful purpose or in violation of any
                applicable laws.
              </li>
              <li>
                Submit false, misleading, or fraudulent information in
                applications.
              </li>
              <li>
                Create multiple accounts to circumvent usage limits.
              </li>
              <li>
                Attempt to reverse-engineer, decompile, or extract source code
                from the Service.
              </li>
              <li>
                Use automated tools (other than the Service itself) to scrape,
                access, or interact with the platform.
              </li>
              <li>
                Interfere with or disrupt the integrity or performance of the
                Service.
              </li>
              <li>
                Resell, redistribute, or sublicense access to the Service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              7. Intellectual Property
            </h2>
            <p>
              The Service, including its design, features, code, and content, is
              owned by iAutoApply and protected by intellectual property laws.
              You retain ownership of the content you upload (resumes, profile
              data). By using the Service, you grant us a limited license to use
              your content solely to provide and improve the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              8. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, iAutoApply and its
              owners, employees, and affiliates shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages,
              including loss of profits, data, or employment opportunities,
              arising out of or related to your use of the Service. Our total
              liability for any claim related to the Service shall not exceed the
              amount you paid us in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              9. Disclaimer of Warranties
            </h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as
              available&quot; without warranties of any kind, whether express or
              implied, including but not limited to implied warranties of
              merchantability, fitness for a particular purpose, and
              non-infringement. We do not warrant that the Service will be
              uninterrupted, error-free, or secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              10. Termination
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                You may delete your account at any time by contacting us or
                through account settings.
              </li>
              <li>
                We may suspend or terminate your account at our discretion if
                you violate these Terms, engage in fraudulent activity, or for
                any other reason with reasonable notice.
              </li>
              <li>
                Upon termination, your right to use the Service ceases
                immediately. We may delete your data in accordance with our
                Privacy Policy.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              11. Indemnification
            </h2>
            <p>
              You agree to indemnify and hold harmless iAutoApply and its
              owners, employees, and affiliates from any claims, damages, or
              expenses (including reasonable legal fees) arising from your use of
              the Service, your violation of these Terms, or your violation of
              any rights of a third party.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              12. Governing Law
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with
              the laws of the United States. Any disputes arising from these
              Terms or the Service shall be resolved through binding arbitration,
              except where prohibited by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              13. Contact Us
            </h2>
            <p>
              If you have questions about these Terms of Service, contact us at:{" "}
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
