import * as React from "react";
import { ArrowLeft, LifeBuoy, Mail, MessageSquareQuote } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useSeoMetadata } from "../lib/seo";

function SupportCard({
  icon,
  title,
  body,
  href,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  href: string;
  action: string;
}) {
  return (
    <a
      href={href}
      className="rounded-3xl border border-border bg-surface p-5 transition duration-200 hover:border-primary/35 hover:bg-[color:var(--ui-note-icon-bg)]"
    >
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        {icon}
      </div>
      <h2 className="mt-4 text-lg font-black text-text-primary">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-text-secondary/82">{body}</p>
      <div className="mt-4 text-sm font-semibold text-primary">{action}</div>
    </a>
  );
}

export default function ContactSupport() {
  const navigate = useNavigate();

  useSeoMetadata({
    title: "Support and Contact",
    description:
      "Contact Ubhona for launch help, onboarding questions, billing support, and product guidance before or after signup.",
    path: "/contact",
  });

  return (
    <main className="min-h-screen bg-app-bg text-text-primary">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-surface p-5">
          <div>
            <div className="text-2xl font-black">
              <span className="text-primary">Support</span> & Contact
            </div>
            <div className="mt-1 text-sm text-text-secondary/72">
              Reach Ubhona for launch help, product questions, billing help, or onboarding support.
            </div>
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

        <div className="mb-6 rounded-3xl border border-primary/20 bg-primary/10 p-5">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-surface text-primary">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-text-primary">Primary support channel for launch</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-text-secondary/82">
                For launch, the primary support path is email. This keeps support simple, reliable,
                and accessible to first-time visitors without requiring an account.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SupportCard
            icon={<Mail className="h-5 w-5" />}
            title="Email support"
            body="Use email for product questions, onboarding help, account recovery questions, and launch support."
            href="mailto:support@ubhona.com?subject=Ubhona%20Support%20Request"
            action="Email support@ubhona.com"
          />
          <SupportCard
            icon={<MessageSquareQuote className="h-5 w-5" />}
            title="Book launch help"
            body="If you are preparing to launch with Ubhona, send a note with your restaurant name, timeline, and what you need help with."
            href="mailto:support@ubhona.com?subject=Ubhona%20Launch%20Help"
            action="Request launch help"
          />
        </div>

        <div className="mt-6 rounded-3xl border border-border bg-surface p-5">
          <h2 className="text-lg font-black text-text-primary">What to include</h2>
          <div className="mt-3 space-y-2 text-sm leading-7 text-text-secondary/82">
            <p>Restaurant name and contact email</p>
            <p>What you are trying to do</p>
            <p>Any error message or blocker you are seeing</p>
            <p>Your preferred response timeline if launch is time-sensitive</p>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-text-secondary/72">
          Return to the{" "}
          <Link className="font-semibold text-primary transition-colors hover:text-primary/80" to="/">
            Ubhona homepage
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
