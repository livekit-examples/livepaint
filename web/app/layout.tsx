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
        <title>LivePaint</title>
      </head>
      <body className="overflow-hidden bg-[#00807F]">{children}</body>
    </html>
  );
}
