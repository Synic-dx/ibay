/** FEATURE: Loading skeleton for Chat (shown instantly after a click). */
import { Sk, SkList, SkPage } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <SkPage className="withbar" label="Loading chat">
      <SkList n={1} />
      <div className="skp" style={{ marginTop: 16 }}>
        {[60, 45, 70, 35, 55].map((w, i) => (
          <Sk key={i} w={w + "%"} h={44} r={18} style={{ justifySelf: i % 2 ? "end" : "start" }} />
        ))}
      </div>
    </SkPage>
  );
}
