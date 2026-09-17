import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solix — Futuristic AI Assistant",
  description: "Your intelligent conversational workspace powered by local and cloud AI models.",
  keywords: ["Solix", "AI", "Ollama", "Chatbot", "Glassmorphism", "Next.js"],
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
