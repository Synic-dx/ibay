/**
 * FEATURE: Root layout
 * WHAT: Fonts (Inter for UI, Plus Jakarta Sans for display, JetBrains Mono for labels/numbers), theme
 *       (next-themes on data-theme, light by default; dark only after the toggle; no flash), toasts, and the
 *       client app context (who is signed in, header counts, feature flags).
 */
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AppProvider } from "@/components/app-context";
import { QueryProvider } from "@/components/query-provider";
import { NavProgress } from "@/components/ui/nav-progress";
import { getViewer } from "@/lib/auth/session";
import { userChannel } from "@/lib/auth/ticket";
import { googleEnabled } from "@/lib/auth";
import { getCounts } from "@/features/shell/queries";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "i-bay · IIM Indore campus marketplace", template: "%s · i-bay" },
  description: "Buy, rent, bid and grab food drops from people in your own hostel. Only for @iimidr.ac.in accounts.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#02505F",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const counts = await getCounts(viewer);
  const flags = {
    google: googleEnabled,
    captchaOff: process.env.CAPTCHA_PROVIDER === "off",
  };
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <NavProgress />
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <QueryProvider>
          <AppProvider
            viewer={
              viewer && {
                id: viewer.id,
                name: viewer.name,
                email: viewer.email,
                hostel: viewer.hostel,
                room: viewer.room,
                avatarUrl: viewer.avatarUrl,
                avatarColor: viewer.avatarColor,
                plume: viewer.plume,
                ratedDeals: viewer.ratedDeals,
                role: viewer.role,
                onboarded: viewer.onboarded,
                channel: userChannel(viewer.id),
              }
            }
            counts={counts}
            flags={flags}
          >
            {children}
            <Toaster position="bottom-center" toastOptions={{ className: "ibay-toast", duration: 4000 }} />
          </AppProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
