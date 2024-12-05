import "@livekit/components-styles";
import "./globals.css";
import "98.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ fontSize: "18px" }}>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="theme-color" content="#000000" />
        <meta property="og:title" content="LivePaint" />
        <meta
          property="og:description"
          content="A realtime AI drawing game powered by LiveKit"
        />
        <meta property="og:image" content="/og-image.png" />
        <meta property="og:url" content="https://paint.livekit.io" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@livekit" />
        <meta name="twitter:title" content="LivePaint" />
        <meta
          name="twitter:description"
          content="A realtime AI drawing game powered by LiveKit"
        />
        <meta name="twitter:image" content="/og-image.png" />
        <title>LivePaint</title>
      </head>
      <body className="overflow-hidden bg-[#00807F]">{children}</body>
    </html>
  );
}
