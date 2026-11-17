"use client";
/** Friendly error page for sign-in. */
export default function LoginError({ reset }: { reset: () => void }) {
  return (
    <main className="empty">
      <h3>Sign-in hit a problem</h3>
      <p className="sm">Try again in a moment.</p>
      <button type="button" className="btn" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
