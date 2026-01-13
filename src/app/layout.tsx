import type { Metadata } from "next";
import { Playfair_Display, Montserrat } from "next/font/google";
import "./globals.css";
import { NuqsAdapter } from 'nuqs/adapters/next/app'

// Editorial/Tech Font Hybrid (Brand_Identity.md §4.2)
// Headline: Playfair Display - Expressive, high-contrast serif (luxury/romance)
// Body: Montserrat - Geometric sans-serif (modern/legible)

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TransHere | Curated Connection",
  description: "Discernment is a Virtue. Your Private World.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${montserrat.variable} ${playfair.variable} font-sans antialiased bg-background text-foreground`}>
        <NuqsAdapter>
          {/* Main content wrapper - gets blurred when story opens */}
          <div id="main-content">
            {children}
          </div>
          {/* Portal target for story viewer - outside blur scope */}
          <div id="story-portal" />
        </NuqsAdapter>
      </body>
    </html>
  );
}