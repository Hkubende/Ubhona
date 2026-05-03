import * as React from "react";

type SeoMetadataInput = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
};

const DEFAULT_SITE_NAME = "Ubhona";
const DEFAULT_IMAGE_PATH = "/hero-ubhona.jpeg";

function getBaseUrl() {
  const explicitSiteUrl = String(import.meta.env.VITE_SITE_URL || "").trim();
  if (explicitSiteUrl) return explicitSiteUrl.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }
  return "https://ubhona.com";
}

function ensureMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
  return element;
}

function ensureLink(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
  return element;
}

export function useSeoMetadata({
  title,
  description,
  path = "/",
  image = DEFAULT_IMAGE_PATH,
  type = "website",
}: SeoMetadataInput) {
  React.useEffect(() => {
    const baseUrl = getBaseUrl();
    const canonicalUrl = new URL(path, `${baseUrl}/`).toString();
    const imageUrl = new URL(image, `${baseUrl}/`).toString();
    const fullTitle = title.includes(DEFAULT_SITE_NAME) ? title : `${title} | ${DEFAULT_SITE_NAME}`;

    document.title = fullTitle;

    ensureMeta('meta[name="description"]', { name: "description", content: description });
    ensureMeta('meta[property="og:type"]', { property: "og:type", content: type });
    ensureMeta('meta[property="og:site_name"]', { property: "og:site_name", content: DEFAULT_SITE_NAME });
    ensureMeta('meta[property="og:title"]', { property: "og:title", content: fullTitle });
    ensureMeta('meta[property="og:description"]', { property: "og:description", content: description });
    ensureMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    ensureMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });
    ensureMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    ensureMeta('meta[name="twitter:title"]', { name: "twitter:title", content: fullTitle });
    ensureMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    ensureMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });
    ensureLink('link[rel="canonical"]', { rel: "canonical", href: canonicalUrl });
  }, [description, image, path, title, type]);
}
