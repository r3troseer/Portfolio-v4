// Canonical route metadata descriptors for Framework Mode `meta` exports.
// Leaf route meta replaces the full descriptor list (not merged), so each
// helper returns a complete, non-conflicting set for that surface.

export const SITE_ORIGIN = "https://piusagboola.com";

const SITE_TITLE = "Pius Agboola \u2014 Backend Engineer";

const SITE_DESCRIPTION =
  "Backend engineer based in London. I build robust systems in Python (Django, FastAPI) and C# (.NET). MSc Computer Science, UEL. Previously at Touch and Pay Technologies (YC W22).";

const TWITTER_DESCRIPTION =
  "Backend engineer based in London. Python, Django, FastAPI, C#, .NET. MSc CS at UEL. Previously at Touch and Pay Technologies (YC W22).";

const PERSON_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Pius Agboola",
  jobTitle: "Backend Engineer",
  url: SITE_ORIGIN,
  address: {
    "@type": "PostalAddress",
    addressLocality: "London",
    addressCountry: "GB",
  },
  sameAs: [
    "https://linkedin.com/in/pius-agboola",
    "https://github.com/r3troseer",
  ],
};

const PLAYGROUND_TITLE = "Evidence Playground - Pius Agboola";
const PLAYGROUND_DESCRIPTION =
  "Evidence and retrieval interface for exploring grounded matches across Pius Agboola's public portfolio work.";

const NOT_FOUND_TITLE = "Page not found - Pius Agboola";
const NOT_FOUND_DESCRIPTION =
  "That page was not found on Pius Agboola's portfolio.";

function absoluteUrl(pathname = "/") {
  if (!pathname || pathname === "/") return SITE_ORIGIN;
  return `${SITE_ORIGIN}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function coreSocial({ title, description, url, twitterDescription }) {
  const descriptors = [
    { title },
    { name: "description", content: description },
    { name: "author", content: "Pius Agboola" },
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
  ];
  if (url) {
    descriptors.push({ property: "og:url", content: url });
  }
  descriptors.push(
    { property: "og:site_name", content: "Pius Agboola" },
    { property: "og:locale", content: "en_GB" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    {
      name: "twitter:description",
      content: twitterDescription || description,
    }
  );
  if (url) {
    descriptors.push({
      tagName: "link",
      rel: "canonical",
      href: url,
    });
  }
  return descriptors;
}

/** Homepage and safe SPA-fallback identity (not project-specific). */
export function homeMetaDescriptors() {
  return [
    ...coreSocial({
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      url: absoluteUrl("/"),
      twitterDescription: TWITTER_DESCRIPTION,
    }),
    {
      name: "keywords",
      content:
        "backend engineer, Python, Django, FastAPI, C#, .NET, London, software engineer, fintech",
    },
    { "script:ld+json": PERSON_JSON_LD },
  ];
}

/**
 * Project detail metadata from the same presentation object the route loader
 * returns (canonical public project data). Null/unknown -> not-found meta.
 */
export function projectMetaDescriptors(project) {
  if (!project?.id || !project?.header?.title) {
    return notFoundMetaDescriptors();
  }
  const title = `${project.header.title} - Pius Agboola`;
  const description =
    (typeof project.header.overview === "string" &&
      project.header.overview.trim()) ||
    (typeof project.header.subtitle === "string" &&
      project.header.subtitle.trim()) ||
    NOT_FOUND_DESCRIPTION;
  return coreSocial({
    title,
    description,
    url: absoluteUrl(`/projects/${project.id}`),
  });
}

/** Evidence/retrieval interface - distinct from the homepage search identity. */
export function playgroundMetaDescriptors() {
  return coreSocial({
    title: PLAYGROUND_TITLE,
    description: PLAYGROUND_DESCRIPTION,
    url: absoluteUrl("/playground"),
  });
}

/** Unknown route / missing project - no stale project fields. */
export function notFoundMetaDescriptors() {
  return [
    { title: NOT_FOUND_TITLE },
    { name: "description", content: NOT_FOUND_DESCRIPTION },
    { name: "author", content: "Pius Agboola" },
    { property: "og:type", content: "website" },
    { property: "og:title", content: NOT_FOUND_TITLE },
    { property: "og:description", content: NOT_FOUND_DESCRIPTION },
    { property: "og:site_name", content: "Pius Agboola" },
    { property: "og:locale", content: "en_GB" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: NOT_FOUND_TITLE },
    { name: "twitter:description", content: NOT_FOUND_DESCRIPTION },
  ];
}
