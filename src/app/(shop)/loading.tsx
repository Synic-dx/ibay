/** FEATURE: Loading skeleton shown while a shop page streams in. */
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Loading">
      <div className="sk" style={{ height: 46, borderRadius: 999, marginBottom: 16 }} />
      <div className="g2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="pc" style={{ padding: 6 }}>
            <div className="sk" style={{ aspectRatio: "1 / 1" }} />
            <div className="sk" style={{ height: 14, margin: "10px 4px 6px" }} />
            <div className="sk" style={{ height: 18, width: "50%", margin: "0 4px 8px" }} />
          </div>
        ))}
      </div>
    </main>
  );
}
