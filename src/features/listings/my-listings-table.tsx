"use client";
/**
 * FEATURE: My listings table [RUBRIC:DATA-DISPLAY] [RUBRIC:CRUD-UPDATE] [RUBRIC:CRUD-DELETE]
 * WHAT: Desktop/tablet: a real data table (TanStack Table) with checkbox,
 *       photo, title, mode, inline-editable price, original price, age,
 *       status, views, saves, last updated and actions (Edit, Pause/Resume,
 *       Mark sold, Delete). Click a header to sort (arrow shows the direction).
 *       Tabs: Active / Paused / Sold / Ended / Deleted (30 days).
 *       Filters: mode, category, text search, 10 / 25 / 50 rows per page.
 *       Everything lives in the URL, so a refresh keeps the view.
 *       Phones: the same rows as stacked cards with a "..." menu.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { ago, ageMonths, ageText, fmt, unitShort } from "@/lib/format";
import { PhotoTile, PriceDrop, hasAge } from "./components/parts";
import { DeleteDialog } from "./delete-dialog";
import { bulkDelete, restoreListing, restoreMany } from "./actions/delete";
import { extendAuction, quickPrice, relistListing, setPaused } from "./actions/update";
import type { ListingCard } from "./types";
import type { MyParams, SortCol, Tab } from "./my-queries";

const STATUS_TXT: Record<string, string> = { active: "Live", paused: "Paused", sold: "Sold", claimed: "Claimed", closed: "Ended", expired: "Expired", deleted: "Deleted", hidden: "Hidden" };
const MODE_TXT: Record<string, string> = { sell: "Sale", rent: "Rent", auction: "Auction", drop: "Drop" };
const TAB_LIST: [Tab, string][] = [["active", "Active"], ["paused", "Paused"], ["sold", "Sold"], ["ended", "Ended"], ["deleted", "Deleted"]];

type Guard = Record<string, { bids: number; booked: boolean }>;
type Props = { rows: ListingCard[]; total: number; counts: Record<Tab, number>; params: MyParams; guards: Guard; categories: { id: string; name: string }[] };

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, ListingCard>();

/** The inline price input: click, type, Enter (or leave the field) to save. */
function PriceCell({ l }: { l: ListingCard }) {
  const router = useRouter();
  const [v, setV] = useState(String(l.price));
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setV(String(l.price)), [l.price]);
  const editable = (l.mode === "sell" || l.mode === "rent") && l.status === "active";
  if (!editable)
    return (
      <span>
        {fmt(l.price)}
        {l.rentUnit ? <small>/{unitShort(l.rentUnit)}</small> : null}
      </span>
    );
  const save = () => {
    const n = Number(v.replace(/\D/g, ""));
    if (n === l.price) return setErr(null);
    start(async () => {
      const r = await quickPrice(l.id, v);
      if (!r.ok) {
        setErr(r.fieldErrors?.price ?? r.formError ?? "Invalid price");
        toast.error(r.fieldErrors?.price ?? r.formError);
        setV(String(l.price));
        return;
      }
      setErr(null);
      toast(r.message);
      router.refresh();
    });
  };
  return (
    <span>
      <input
        className="pin"
        inputMode="numeric"
        value={v}
        aria-label={`Price for ${l.title}`}
        aria-invalid={!!err}
        title="Click to change the price, then press Enter"
        disabled={pending}
        onChange={(e) => setV(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setV(String(l.price));
        }}
        onBlur={save}
      />
      {l.rentUnit ? <small className="faint">/{unitShort(l.rentUnit)}</small> : null}
    </span>
  );
}

export function MyListingsTable({ rows, total, counts, params, guards, categories }: Props) {
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [del, setDel] = useState<ListingCard | null>(null);
  const [manage, setManage] = useState<ListingCard | null>(null);
  const [q, setQ] = useState(params.q);

  useEffect(() => setSelected(new Set()), [params.tab, params.page]);

  /** Updates the URL (and so the server data) with new table state. */
  const go = (patch: Partial<MyParams>) => {
    const p = { ...params, page: 1, ...patch };
    const s = new URLSearchParams();
    if (p.tab !== "active") s.set("tab", p.tab);
    if (p.mode) s.set("mode", p.mode);
    if (p.cat) s.set("cat", p.cat);
    if (p.q) s.set("q", p.q);
    if (p.sort !== "updated" || p.dir !== "desc") (s.set("sort", p.sort), s.set("dir", p.dir));
    if (p.page > 1) s.set("page", String(p.page));
    if (p.size !== 10) s.set("size", String(p.size));
    start(() => router.replace(`${path}${s.size ? `?${s}` : ""}`, { scroll: false }));
  };
  // Debounced text search.
  useEffect(() => {
    if (q === params.q) return;
    const t = setTimeout(() => go({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go() changes every render; we only react to typing
  }, [q]);

  const act = (fn: () => Promise<{ ok: boolean; message?: string; formError?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast(r.message ?? "Done");
      else toast.error(r.formError);
      setManage(null);
      router.refresh();
    });
  const restore = (id: string) => act(() => restoreListing(id));
  const bulk = () =>
    start(async () => {
      const ids = [...selected];
      const r = await bulkDelete(ids);
      if (!r.ok) return void toast.error(r.formError);
      setSelected(new Set());
      toast(r.message, {
        duration: 10_000,
        action: r.data.deleted.length ? { label: "Undo", onClick: async () => (await restoreMany(r.data.deleted), toast("Restored"), router.refresh()) } : undefined,
      });
      router.refresh();
    });

  const sortHead = (k: SortCol, label: string) => (
    <button type="button" className={`thb ${params.sort === k ? "on" : ""}`} onClick={() => go({ sort: k, dir: params.sort === k && params.dir === "desc" ? "asc" : "desc" })} aria-label={`Sort by ${label}`}>
      {label}
      {params.sort === k && <Icon name={params.dir === "asc" ? "up" : "down"} className="icon i14" />}
    </button>
  );

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const actions = (l: ListingCard) =>
    l.status === "deleted" ? (
      <button type="button" className="btn sec small" onClick={() => restore(l.id)} disabled={pending}>
        <Icon name="undo" />
        Restore
      </button>
    ) : ["active", "paused"].includes(l.status) ? (
      <span className="ract">
        <Link className="ib sm" title="Edit" aria-label={`Edit ${l.title}`} href={`/listings/${l.id}/edit`}>
          <Icon name="edit" className="icon i16" />
        </Link>
        <button type="button" className="ib sm" title={l.status === "paused" ? "Resume" : "Pause"} aria-label={`${l.status === "paused" ? "Resume" : "Pause"} ${l.title}`} onClick={() => act(() => setPaused(l.id, l.status !== "paused"))}>
          <Icon name={l.status === "paused" ? "play" : "pause"} className="icon i16" />
        </button>
        <Link className="ib sm" title={l.mode === "auction" ? "End auction" : "Mark sold"} aria-label={`${l.mode === "auction" ? "End auction" : "Mark sold"}: ${l.title}`} href={`/item/${l.id}?sheet=${l.mode === "auction" ? "close" : "sold"}`}>
          <Icon name={l.mode === "auction" ? "hammer" : "check"} className="icon i16" />
        </Link>
        {l.mode === "auction" && l.bidCount === 0 && l.status === "active" && (
          <button type="button" className="ib sm" title="Extend auction by 1 day" aria-label={`Extend auction: ${l.title}`} onClick={() => act(() => extendAuction(l.id, 24))}>
            <Icon name="hourglass" className="icon i16" />
          </button>
        )}
        <button type="button" className="ib sm danger" title="Delete" aria-label={`Delete ${l.title}`} onClick={() => setDel(l)}>
          <Icon name="trash" className="icon i16" />
        </button>
      </span>
    ) : (
      <button type="button" className="btn sec small" onClick={() => act(() => relistListing(l.id))} disabled={pending || l.mode === "drop"} title="Post a fresh copy">
        <Icon name="repeat" />
        Relist
      </button>
    );

  const columns = useMemo(
    () =>
      helper.columns([
        helper.display({
          id: "select",
          header: () => (
            <input type="checkbox" aria-label="Select all on this page" checked={allChecked} onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} />
          ),
          cell: ({ row }) => (
            <input
              type="checkbox"
              aria-label={`Select ${row.original.title}`}
              checked={selected.has(row.original.id)}
              onChange={(e) => {
                const s = new Set(selected);
                if (e.target.checked) s.add(row.original.id);
                else s.delete(row.original.id);
                setSelected(s);
              }}
            />
          ),
        }),
        helper.accessor("title", {
          header: () => sortHead("title", "Listing"),
          cell: ({ row }) => (
            <Link className="tcell" href={`/item/${row.original.id}`}>
              <span className="tph">
                <PhotoTile l={row.original} style={{ width: 44, height: 44 }} />
              </span>
              <b>{row.original.title}</b>
            </Link>
          ),
        }),
        helper.accessor("mode", { header: "Type", cell: ({ getValue }) => <span className="badge b-neutral">{MODE_TXT[getValue()]}</span> }),
        helper.accessor("price", {
          header: () => sortHead("price", "Price"),
          cell: ({ row }) => (
            <>
              <PriceCell l={row.original} />
              <PriceDrop l={row.original} short />
            </>
          ),
        }),
        helper.accessor("mrp", { header: () => sortHead("mrp", "Original"), cell: ({ getValue }) => (getValue() ? fmt(getValue()!) : <span className="faint">n/a</span>) }),
        helper.accessor("purchasedOn", {
          header: () => sortHead("age", "Age"),
          cell: ({ row }) => (hasAge(row.original) && row.original.purchasedOn ? ageText(ageMonths(row.original.purchasedOn)) : <span className="faint">n/a</span>),
        }),
        helper.accessor("status", { header: "Status", cell: ({ getValue }) => <span className={`st st-${getValue()}`}>{STATUS_TXT[getValue()] ?? getValue()}</span> }),
        helper.accessor("views", { header: () => sortHead("views", "Views") }),
        helper.accessor("saves", { header: () => sortHead("saves", "Saves") }),
        helper.accessor("updatedAt", { header: () => sortHead("updated", "Updated"), cell: ({ getValue }) => <span className="faint">{ago(getValue())}</span> }),
        helper.display({ id: "actions", header: () => <span className="r">Actions</span>, cell: ({ row }) => actions(row.original) }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt when the data or selection changes
    [rows, selected, params, pending],
  );
  const table = useTable({ features, columns, data: rows });
  const pages = Math.max(1, Math.ceil(total / params.size));

  return (
    <>
      <div className="tbar">
        <div className="seg" role="tablist" aria-label="Status">
          {TAB_LIST.map(([k, n]) => (
            <button key={k} type="button" role="tab" aria-selected={params.tab === k} className={params.tab === k ? "on" : ""} onClick={() => go({ tab: k })}>
              {n} ({counts[k]})
            </button>
          ))}
        </div>
        <div className="iwrap tsearch">
          <Icon name="search" className="icon i16" />
          <input className="input" placeholder="Search your listings" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search your listings" />
        </div>
      </div>
      <div className="row" style={{ flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <select className="input" style={{ minHeight: 40, width: "auto", padding: "6px 12px", fontSize: 14 }} value={params.mode} onChange={(e) => go({ mode: e.target.value })} aria-label="Filter by type">
          <option value="">All types</option>
          <option value="sell">Sale</option>
          <option value="rent">Rent</option>
          <option value="auction">Auction</option>
          <option value="drop">Food drop</option>
        </select>
        <select className="input" style={{ minHeight: 40, width: "auto", padding: "6px 12px", fontSize: 14 }} value={params.cat} onChange={(e) => go({ cat: e.target.value })} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input" style={{ minHeight: 40, width: "auto", padding: "6px 12px", fontSize: 14 }} value={params.size} onChange={(e) => go({ size: Number(e.target.value) as 10 | 25 | 50 })} aria-label="Rows per page">
          {[10, 25, 50].map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>
        {pending && <span className="spin" aria-label="Loading" />}
      </div>

      {params.tab === "deleted" && rows.length > 0 && (
        <div className="note" style={{ marginBottom: 10 }}>
          <Icon name="info" />
          <span>Deleted listings stay here for 30 days so you can restore them, then they are removed for good.</span>
        </div>
      )}
      {selected.size > 0 && params.tab !== "deleted" && (
        <div className="bulkbar" role="region" aria-label="Bulk actions">
          <span>{selected.size} selected</span>
          <span className="row">
            <button type="button" className="btn quiet small" onClick={() => setSelected(new Set())}>
              Clear
            </button>
            <button type="button" className="btn danger small" onClick={bulk} disabled={pending}>
              <Icon name="trash" />
              Delete selected
            </button>
          </span>
        </div>
      )}

      {rows.length ? (
        <>
          <div className="tblwrap panel">
            <table className="tbl">
              <caption className="vh">Your listings, {total} in this view</caption>
              <thead>
                {table.getHeaderGroups().map((g) => (
                  <tr key={g.id}>
                    {g.headers.map((h) => (
                      <th key={h.id} className={h.id === "actions" ? "r" : ""} scope="col" aria-sort={["title", "price", "mrp", "purchasedOn", "views", "saves", "updatedAt"].includes(h.id) && params.sort === ({ purchasedOn: "age", updatedAt: "updated" } as Record<string, string>)[h.id] ? (params.dir === "asc" ? "ascending" : "descending") : undefined}>
                        {h.isPlaceholder ? null : <table.FlexRender header={h} />}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((r) => (
                  <tr key={r.id} className={r.original.status === "deleted" ? "gone" : ""}>
                    {r.getAllCells().map((c) => (
                      <td key={c.id} className={c.column.id === "actions" ? "r" : ""}>
                        <table.FlexRender cell={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lgroup mcards">
            {rows.map((l) => (
              <div className="lrow" key={l.id}>
                <input type="checkbox" aria-label={`Select ${l.title}`} checked={selected.has(l.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(l.id); else n.delete(l.id); return n; })} />
                <Link href={`/item/${l.id}`} style={{ width: 52, height: 52, borderRadius: 12, overflow: "hidden", flex: "none" }} aria-hidden="true" tabIndex={-1}>
                  <PhotoTile l={l} style={{ width: 52, height: 52 }} />
                </Link>
                <Link className="lt plain" href={`/item/${l.id}`}>
                  <b style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.title}</b>
                  <span>
                    {fmt(l.price)}
                    {l.rentUnit ? "/" + unitShort(l.rentUnit) : ""} · {l.views} views · <span className={`st st-${l.status}`}>{STATUS_TXT[l.status]}</span>
                  </span>
                </Link>
                {["active", "paused"].includes(l.status) ? (
                  <button type="button" className="btn sec small" aria-label={`Manage ${l.title}`} onClick={() => setManage(l)}>
                    <Icon name="more" />
                  </button>
                ) : (
                  actions(l)
                )}
              </div>
            ))}
          </div>
          {pages > 1 && (
            <nav className="pager" aria-label="Pages">
              <span>
                {(params.page - 1) * params.size + 1} to {Math.min(params.page * params.size, total)} of {total}
              </span>
              <span className="row">
                <button type="button" className="btn sec small" disabled={params.page <= 1} onClick={() => go({ page: params.page - 1 })}>
                  Previous
                </button>
                <span className="mono">
                  {params.page} / {pages}
                </span>
                <button type="button" className="btn sec small" disabled={params.page >= pages} onClick={() => go({ page: params.page + 1 })}>
                  Next
                </button>
              </span>
            </nav>
          )}
        </>
      ) : (
        <div className="empty">
          <span className="ei">
            <Icon name="store" />
          </span>
          <h3>{params.tab === "active" && !params.q ? "Nothing listed yet" : "Nothing here"}</h3>
          <p className="sm">{params.tab === "active" && !params.q ? "Moving out or have something lying around? Listing takes a minute." : "Try another tab or clear the filters."}</p>
          {params.tab === "active" && !params.q && (
            <Link className="btn" href="/sell">
              <Icon name="plus" />
              List your first item
            </Link>
          )}
        </div>
      )}

      {del && <DeleteDialog open onOpenChange={(o) => !o && setDel(null)} listing={del} bids={guards[del.id]?.bids ?? del.bidCount} bookedAhead={guards[del.id]?.booked ?? false} />}
      {manage && (
        <Sheet open onOpenChange={(o) => !o && setManage(null)} icon="settings" title="Manage listing" subtitle={manage.title}>
          <div className="lgroup" style={{ boxShadow: "none" }}>
            <Link className="lrow" href={`/item/${manage.id}?sheet=${manage.mode === "auction" ? "close" : "sold"}`}>
              <span className="li">
                <Icon name={manage.mode === "auction" ? "hammer" : "check"} />
              </span>
              <span className="lt">
                <b>{manage.mode === "auction" ? "End auction and choose a buyer" : "Mark as sold"}</b>
                <span>{manage.mode === "auction" ? `${manage.bidCount} bids` : "Pick the buyer to rate each other"}</span>
              </span>
              <Icon name="chev" />
            </Link>
            <Link className="lrow" href={`/listings/${manage.id}/edit`}>
              <span className="li">
                <Icon name="edit" />
              </span>
              <span className="lt">
                <b>Edit listing</b>
                <span>Change price, photos, details</span>
              </span>
              <Icon name="chev" />
            </Link>
            <button type="button" className="lrow" onClick={() => act(() => setPaused(manage.id, manage.status !== "paused"))}>
              <span className="li">
                <Icon name={manage.status === "paused" ? "play" : "pause"} />
              </span>
              <span className="lt">
                <b>{manage.status === "paused" ? "Resume listing" : "Pause listing"}</b>
                <span>{manage.status === "paused" ? "Show it in search again" : "Hide from search without deleting"}</span>
              </span>
            </button>
            {manage.mode === "auction" && manage.bidCount === 0 && (
              <button type="button" className="lrow" onClick={() => act(() => extendAuction(manage.id, 24))}>
                <span className="li">
                  <Icon name="hourglass" />
                </span>
                <span className="lt">
                  <b>Extend auction by 1 day</b>
                  <span>Only while nobody has bid</span>
                </span>
              </button>
            )}
            <button type="button" className="lrow" onClick={() => (setDel(manage), setManage(null))}>
              <span className="li" style={{ color: "var(--bad)" }}>
                <Icon name="trash" />
              </span>
              <span className="lt">
                <b style={{ color: "var(--bad)" }}>Delete listing</b>
                <span>You can undo this for 30 days</span>
              </span>
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
