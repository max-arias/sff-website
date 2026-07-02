# Build Route And Replayable URL State

The stateful fitment application lives on `/build`, while `/` serves as a launcher into that experience. We treat `/build` query parameters as a stable public contract that fully replays the meaningful application state, including selected parts, table kind, search, sort, kind-specific filters, and pagination, because the product is designed around shareable, inspectable, non-hidden fitment state rather than session-local UI state.
