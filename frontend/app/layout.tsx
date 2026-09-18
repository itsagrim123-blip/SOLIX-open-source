import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solix — Futuristic AI Assistant",
  description: "Your intelligent conversational workspace powered by local and cloud AI models.",
  keywords: ["Solix", "AI", "Ollama", "Chatbot", "Glassmorphism", "Next.js"],
  icons: {
    icon: "/solix-logo.jpg",
    apple: "/solix-logo.jpg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#03060d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
