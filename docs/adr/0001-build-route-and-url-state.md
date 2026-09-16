# Build Route And Replayable URL State

The stateful fitment application lives on `/build`. The root route `/` rewrites to `/build` so the builder is the primary experience; it may be revisited as a thin landing page if needed in the future. We treat `/build` query parameters as a stable public contract that fully replays the meaningful application state, including selected parts, table kind, search, sort, kind-specific filters, and sparse-row visibility, because the product is designed around shareable, inspectable, non-hidden fitment state rather than session-local UI state.

The table renders the entire filtered result set in a single virtualized list rather than paginated slices. A `page` parameter is therefore not part of the URL contract. The list is windowed, so only the rows near the viewport are mounted; scrolling reaches every matching row without a page step, and the container height stays bounded so the table scrolls internally rather than growing the document.

Rows with no fitment-relevant metric data are hidden from the default table because they do not provide useful evidence for a fitment decision. This is not a verdict filter: `pass`, `conditional`, and `fail` remain visible together. Users can include sparse catalog rows by enabling **Show sparse rows**, which serializes as `show-sparse=1`.
