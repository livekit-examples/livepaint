import "@livekit/components-styles";
import "./globals.css";
import "98.css";
import { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "LivePaint",
  description: "A realtime AI drawing game powered by LiveKit",
  openGraph: {
    title: "LivePaint",
    description: "A realtime AI drawing game powered by LiveKit",
    type: "website",
    images: [
      {
        url: "https://paint.livekit.io/og-image.png",
        width: 1118,
        height: 630,
        type: "image/png",
        alt: "LivePaint",
      },
    ],
    url: "https://paint.livekit.io",
  },
};

// As of Next.js 14, viewport and themeColor must be declared in a separate
// `viewport` export rather than inside `metadata`.
// See https://nextjs.org/docs/app/api-reference/functions/generate-viewport
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ fontSize: "18px" }}>
      <body className="overflow-hidden bg-[#00807F]">{children}</body>
    </html>
  );
}
