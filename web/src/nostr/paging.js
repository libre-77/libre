// Cursor helpers for backwards-paged relay queries. Pure, protocol-agnostic:
// they add a time bound to a filter and derive the next page's cursor from the
// events a query returned. Keeps pagination logic out of the domain modules.

/** Add a backwards `until` bound to a filter (page strictly older than a prior page). */
export function windowed(filter, until) {
  return until ? { ...filter, until } : filter;
}

// Cursor for the next page. Relays were asked for `limit` events; getting that
// many means older ones likely remain. `nextUntil` is the oldest event's time -
// `until` is inclusive, so the next query re-sends boundary events, which the
// caller drops by id (see ui/loadmore.js).
export function pageCursor(events, limit) {
  if (!events.length) return { hasMore: false, nextUntil: null };
  const oldest = events.reduce((m, ev) => Math.min(m, ev.created_at), Infinity);
  return { hasMore: events.length >= limit, nextUntil: oldest };
}
