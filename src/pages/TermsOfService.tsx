import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useSeoMetadata } from "../lib/seo";

const UPDATED_AT = "April 24, 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface p-5">
      <h2 className="text-lg font-black text-text-primary">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-text-secondary/82">{children}</div>
    </section>
  );
}

export default function TermsOfService() {
  const navigate = useNavigate();

  useSeoMetadata({
    title: "Terms of Service",
    description:
      "Review the Ubhona terms governing restaurant use, billing, acceptable use, service availability, and account responsibilities.",
    path: "/terms",
    type: "article",
  });

  return (
    <main className="min-h-screen bg-app-bg text-text-primary">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-surface p-5">
          <div>
            <div className="text-2xl font-black">
              <span className="text-primary">Terms</span> of Service
            </div>
            <div className="mt-1 text-sm text-text-secondary/72">Last updated {UPDATED_AT}</div>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="ui-button-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="space-y-4">
          <Section title="Use of the Service">
            <p>
              Ubhona is provided for lawful business use by restaurants and authorized staff. You
              are responsible for maintaining the security of your account and for activities that
              occur under your credentials.
            </p>
          </Section>

          <Section title="Restaurant Responsibilities">
            <p>
              You are responsible for the accuracy of your menu, pricing, availability, branding,
              customer communications, and any guest data collected through your storefront or
              operational workflows.
            </p>
          </Section>

          <Section title="Billing and Subscription">
            <p>
              Paid plans, invoice handling, renewals, and billing status are governed by the plan
              and billing details presented in the platform. Failure to pay may result in feature
              restrictions, suspension, or cancellation where permitted.
            </p>
          </Section>

          <Section title="Acceptable Use">
            <p>
              You may not misuse the platform, interfere with security, attempt unauthorized access,
              violate tenant boundaries, or use the service to store or transmit unlawful or harmful
              material.
            </p>
          </Section>

          <Section title="Availability">
            <p>
              We aim to operate Ubhona reliably, but availability is not guaranteed. Features may
              change, improve, or be discontinued as the product evolves.
            </p>
          </Section>

          <Section title="Limitation of Liability">
            <p>
              To the maximum extent permitted by law, Ubhona is provided on an as-available basis
              and we are not liable for indirect, incidental, special, consequential, or punitive
              damages arising from use of the service.
            </p>
          </Section>

          <Section title="Termination">
            <p>
              We may suspend or terminate access where accounts violate these terms, create security
              risk, or fail to meet billing obligations. You may stop using the service at any time.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms can be sent to{" "}
              <a className="text-primary hover:text-primary/80" href="mailto:support@ubhona.com">
                support@ubhona.com
              </a>
              .
            </p>
          </Section>

          <Section title="Related Documents">
            <p>
              Review our{" "}
              <Link className="text-primary hover:text-primary/80" to="/privacy">
                Privacy Policy
              </Link>{" "}
              for information about how data is handled.
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}
