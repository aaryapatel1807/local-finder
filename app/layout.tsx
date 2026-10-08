import type { Metadata } from "next";
import "./globals.css";
import Providers from "../components/Providers";
import LayoutShell from "../components/shared/LayoutShell";
import PwaRegister from "../components/PwaRegister";

export const metadata: Metadata = {
  title: "Local Finder — find it nearby, right now",
  description:
    "Search nearby places with live Google Maps data: ratings, hours, distance and directions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0F766E" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=clash-display@700,600&f[]=satoshi@400,500,700&display=swap"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('localfinder_theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <div style={{ backgroundColor: "var(--bg-primary)", minHeight: "100vh" }}>
          {/* Frosted-glass page backdrop: color wash + frost veil + grain + sheen */}
          <div className="frosted-backdrop" aria-hidden="true">
            <div className="frost-orb frost-orb-a" />
            <div className="frost-orb frost-orb-b" />
            <div className="frost-orb frost-orb-c" />
            <div className="frost-orb frost-orb-d" />
            <div className="frost-veil" />
            <div className="frost-grain" />
            <div className="frost-sheen" />
            <div className="frost-vignette" />
          </div>
          <Providers>
            <PwaRegister />
            <LayoutShell>{children}</LayoutShell>
          </Providers>
        </div>
      </body>
    </html>
  );
}
