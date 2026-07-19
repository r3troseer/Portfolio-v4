import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { homeMetaDescriptors } from "./lib/routeMetadata";
import "./index.css";
import "./styles/fonts.css";
import "./styles/profile/base.css";

// SPA fallback / unmatched shell uses the homepage identity so raw fallback
// HTML never retains stale project metadata. Leaf routes replace this list.
export function meta() {
  return homeMetaDescriptors();
}

export function Layout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link
          rel="icon"
          type="image/png"
          href="/favicon-96x96.png"
          sizes="96x96"
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <meta name="apple-mobile-web-app-title" content="Pius Agboola" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0f1e" />

        <Meta />
        <Links />
      </head>
      <body>
        <noscript>
          <p>
            Hi, I'm Pius Agboola {"\u2014"} a backend engineer based in London. This
            portfolio requires JavaScript to display. You can reach me at{" "}
            <a href="mailto:peecody1@gmail.com">peecody1@gmail.com</a> or view
            my profile on{" "}
            <a href="https://linkedin.com/in/pius-agboola">LinkedIn</a>.
          </p>
        </noscript>
        <div id="root">{children}</div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}
