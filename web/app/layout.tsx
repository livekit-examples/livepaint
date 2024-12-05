import "@livekit/components-styles";
import "./globals.css";
import "98.css";
import { Metadata } from "next";

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
        width: 1200,
        height: 630,
        type: "image/png",
      },
    ],
    url: "https://paint.livekit.io",
  },
  viewport: "width=device-width, initial-scale=1, shrink-to-fit=no",
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
