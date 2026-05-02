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

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  useSeoMetadata({
    title: "Privacy Policy",
    description:
      "Read how Ubhona collects, uses, protects, and retains restaurant and guest data across menus, ordering, analytics, and operations.",
    path: "/privacy",
    type: "article",
  });

  return (
    <main className="min-h-screen bg-app-bg text-text-primary">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-surface p-5">
          <div>
            <div className="text-2xl font-black">
              <span className="text-primary">Privacy</span> Policy
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
          <Section title="Overview">
            <p>
              Ubhona provides restaurant software for visual menus, ordering, analytics,
              operations, and related business workflows. This policy explains what information we
              collect, how we use it, and how we protect restaurant and guest data.
            </p>
          </Section>

          <Section title="Information We Collect">
            <p>
              We may collect account details such as name, email, business contact information,
              restaurant profile details, menu data, operational activity, billing records, and
              technical usage data required to run the service.
            </p>
            <p>
              For guest-facing ordering flows, restaurants may collect customer information such as
              name, phone number, order details, table number, and payment-related references.
            </p>
          </Section>

          <Section title="How We Use Information">
            <p>
              We use information to provide the product, authenticate users, support restaurant
              operations, process billing, improve reliability, investigate abuse, and communicate
              important service updates.
            </p>
          </Section>

          <Section title="Data Sharing">
            <p>
              We do not sell personal information. We may share data with service providers that
              support hosting, storage, analytics, messaging, payments, and customer support where
              needed to operate Ubhona.
            </p>
          </Section>

          <Section title="Security">
            <p>
              We use reasonable administrative, technical, and organizational safeguards to protect
              information, including authentication controls, tenant-aware access boundaries, and
              service-level monitoring. No internet service can guarantee absolute security.
            </p>
          </Section>

          <Section title="Data Retention">
            <p>
              We retain information for as long as needed to operate the service, comply with legal
              obligations, resolve disputes, and enforce agreements. Restaurants remain responsible
              for the data they collect from their guests through their storefronts and ordering
              flows.
            </p>
          </Section>

          <Section title="Your Choices">
            <p>
              You may request updates to your account information or contact us about privacy
              questions at{" "}
              <a className="text-primary hover:text-primary/80" href="mailto:support@ubhona.com">
                support@ubhona.com
              </a>
              .
            </p>
          </Section>

          <Section title="Related Documents">
            <p>
              Review our{" "}
              <Link className="text-primary hover:text-primary/80" to="/terms">
                Terms of Service
              </Link>{" "}
              for the rules that govern use of the platform.
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}
