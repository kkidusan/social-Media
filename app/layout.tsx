import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./contexts/AuthContext";
import Sidebar from "./components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Social Media App",
  description: "A Next.js social media app with Firebase",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-100`}>
        <AuthProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main
              id="main-content"
              className="flex-1 transition-all duration-300 ease-in-out min-h-screen"
            >
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}