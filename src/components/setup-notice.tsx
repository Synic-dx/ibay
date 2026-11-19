/**
 * FEATURE: First-run notice
 * WHAT: Shown instead of the store when the database keys are missing, so a
 *       fresh clone explains what to do instead of crashing.
 */
import { Icon } from "@/components/ui/icon";
import { Peacock } from "@/components/brand";

export function SetupNotice() {
  return (
    <main style={{ maxWidth: 640, margin: "40px auto" }}>
      <div className="panel pad stack" style={{ gap: 12 }}>
        <div className="row">
          <Peacock size={44} />
          <h1>i-bay needs its database keys</h1>
        </div>
        <p className="muted">
          Add <b className="mono">SUPABASE_SERVICE_ROLE_KEY</b> (and the other values in <b className="mono">.env.example</b>) to{" "}
          <b className="mono">.env.local</b>, then restart the dev server.
        </p>
        <div className="note">
          <Icon name="info" />
          <span>The README has the full setup in five commands.</span>
        </div>
      </div>
    </main>
  );
}
