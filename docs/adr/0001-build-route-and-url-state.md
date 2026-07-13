# Build Route And Replayable URL State

The stateful fitment application lives on `/build`. The root route `/` rewrites to `/build` so the builder is the primary experience; it may be revisited as a thin landing page if needed in the future. We treat `/build` query parameters as a stable public contract that fully replays the meaningful application state, including selected parts, table kind, search, sort, kind-specific filters, sparse-row visibility, and pagination, because the product is designed around shareable, inspectable, non-hidden fitment state rather than session-local UI state.

Rows with no fitment-relevant metric data are hidden from the default table because they do not provide useful evidence for a fitment decision. This is not a verdict filter: `pass`, `conditional`, and `fail` remain visible together. Users can include sparse catalog rows by enabling **Show sparse rows**, which serializes as `show-sparse=1`.
