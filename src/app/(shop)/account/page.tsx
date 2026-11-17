/** FEATURE: /account, hostel, contact, photo, notifications and account deletion. */
import type { Metadata } from "next";
import { SubBar } from "@/components/shell/mobile-bars";
import { requireViewer } from "@/lib/auth/session";
import { AccountForm } from "@/features/profile/account-form";

export const metadata: Metadata = { title: "Hostel & contact" };

export default async function AccountPage() {
  const me = await requireViewer("/account");
  return (
    <>
      <SubBar title="Hostel & contact" backHref="/you" />
      <main className="withtabs formpage">
        <AccountForm me={{ name: me.name, hostel: me.hostel, room: me.room, whatsapp: me.whatsapp, showWhatsapp: me.showWhatsapp, avatarUrl: me.avatarUrl, avatarColor: me.avatarColor, notifyPrefs: me.notifyPrefs }} />
      </main>
    </>
  );
}
