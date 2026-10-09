-- Community 3D-printed case metadata (creator, source post, files, images, reference build).
-- NULL for commercial cases. Stored as JSON: only the browser artifact reads it.
alter table cases add column printed_json text;
