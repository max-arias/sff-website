-- Autocomplete is a public hot path. Trigram FTS makes normalized substring
-- matching bounded instead of scanning every per-kind catalog table.
-- Fans were omitted from the earlier normalized-search migration even though
-- autocomplete includes them. Backfill every pre-existing blank value before
-- materializing the FTS index; subsequent seeds write these values directly.
ALTER TABLE fans ADD COLUMN normalized_search_text TEXT NOT NULL DEFAULT '';
UPDATE cases SET normalized_search_text = lower(replace(replace(replace(replace(replace(seller || name, ' ', ''), '-', ''), '.', ''), '/', ''), '_', '')) WHERE normalized_search_text = '';
UPDATE gpus SET normalized_search_text = lower(replace(replace(replace(replace(replace(brand || name || model || chipset, ' ', ''), '-', ''), '.', ''), '/', ''), '_', '')) WHERE normalized_search_text = '';
UPDATE cpu_coolers SET normalized_search_text = lower(replace(replace(replace(replace(replace(brand || name || type, ' ', ''), '-', ''), '.', ''), '/', ''), '_', '')) WHERE normalized_search_text = '';
UPDATE fans SET normalized_search_text = lower(replace(replace(replace(replace(replace(brand || model, ' ', ''), '-', ''), '.', ''), '/', ''), '_', '')) WHERE normalized_search_text = '';
UPDATE motherboards SET normalized_search_text = lower(replace(replace(replace(replace(replace(brand || name || cpu || chipset || socket, ' ', ''), '-', ''), '.', ''), '/', ''), '_', '')) WHERE normalized_search_text = '';
UPDATE psus SET normalized_search_text = lower(replace(replace(replace(replace(replace(brand || name || form_factor || psu_tier, ' ', ''), '-', ''), '.', ''), '/', ''), '_', '')) WHERE normalized_search_text = '';
UPDATE ram SET normalized_search_text = lower(replace(replace(replace(replace(replace(brand || model || memory_type, ' ', ''), '-', ''), '.', ''), '/', ''), '_', '')) WHERE normalized_search_text = '';

CREATE VIRTUAL TABLE IF NOT EXISTS catalog_search USING fts5(
  id UNINDEXED,
  kind UNINDEXED,
  display_name,
  normalized_search_text,
  tokenize = 'trigram'
);

INSERT INTO catalog_search (id, kind, display_name, normalized_search_text)
SELECT id, 'case', trim(seller || ' ' || name), normalized_search_text FROM cases;
INSERT INTO catalog_search (id, kind, display_name, normalized_search_text)
SELECT id, 'gpu', trim(brand || ' ' || name), normalized_search_text FROM gpus;
INSERT INTO catalog_search (id, kind, display_name, normalized_search_text)
SELECT id, 'cpu-cooler', trim(brand || ' ' || name), normalized_search_text FROM cpu_coolers;
INSERT INTO catalog_search (id, kind, display_name, normalized_search_text)
SELECT id, 'fan', trim(brand || ' ' || model), normalized_search_text FROM fans;
INSERT INTO catalog_search (id, kind, display_name, normalized_search_text)
SELECT id, 'motherboard', trim(brand || ' ' || name), normalized_search_text FROM motherboards;
INSERT INTO catalog_search (id, kind, display_name, normalized_search_text)
SELECT id, 'psu', trim(brand || ' ' || name), normalized_search_text FROM psus;
INSERT INTO catalog_search (id, kind, display_name, normalized_search_text)
SELECT id, 'ram', trim(brand || ' ' || model), normalized_search_text FROM ram;

CREATE TRIGGER IF NOT EXISTS catalog_search_cases_ai AFTER INSERT ON cases BEGIN
  INSERT INTO catalog_search VALUES (new.id, 'case', trim(new.seller || ' ' || new.name), new.normalized_search_text);
END;
CREATE TRIGGER IF NOT EXISTS catalog_search_cases_ad AFTER DELETE ON cases BEGIN
  DELETE FROM catalog_search WHERE id = old.id AND kind = 'case';
END;
CREATE TRIGGER IF NOT EXISTS catalog_search_cases_au AFTER UPDATE ON cases BEGIN
  DELETE FROM catalog_search WHERE id = old.id AND kind = 'case';
  INSERT INTO catalog_search VALUES (new.id, 'case', trim(new.seller || ' ' || new.name), new.normalized_search_text);
END;

CREATE TRIGGER IF NOT EXISTS catalog_search_gpus_ai AFTER INSERT ON gpus BEGIN
  INSERT INTO catalog_search VALUES (new.id, 'gpu', trim(new.brand || ' ' || new.name), new.normalized_search_text);
END;
CREATE TRIGGER IF NOT EXISTS catalog_search_gpus_ad AFTER DELETE ON gpus BEGIN
  DELETE FROM catalog_search WHERE id = old.id AND kind = 'gpu';
END;
CREATE TRIGGER IF NOT EXISTS catalog_search_gpus_au AFTER UPDATE ON gpus BEGIN
  DELETE FROM catalog_search WHERE id = old.id AND kind = 'gpu';
  INSERT INTO catalog_search VALUES (new.id, 'gpu', trim(new.brand || ' ' || new.name), new.normalized_search_text);
END;

CREATE TRIGGER IF NOT EXISTS catalog_search_cpu_coolers_ai AFTER INSERT ON cpu_coolers BEGIN
  INSERT INTO catalog_search VALUES (new.id, 'cpu-cooler', trim(new.brand || ' ' || new.name), new.normalized_search_text);
END;
CREATE TRIGGER IF NOT EXISTS catalog_search_cpu_coolers_ad AFTER DELETE ON cpu_coolers BEGIN
  DELETE FROM catalog_search WHERE id = old.id AND kind = 'cpu-cooler';
END;
CREATE TRIGGER IF NOT EXISTS catalog_search_cpu_coolers_au AFTER UPDATE ON cpu_coolers BEGIN
  DELETE FROM catalog_search WHERE id = old.id AND kind = 'cpu-cooler';
  INSERT INTO catalog_search VALUES (new.id, 'cpu-cooler', trim(new.brand || ' ' || new.name), new.normalized_search_text);
END;

CREATE TRIGGER IF NOT EXISTS catalog_search_fans_ai AFTER INSERT ON fans BEGIN
  INSERT INTO catalog_search VALUES (new.id, 'fan', trim(new.brand || ' ' || new.model), new.normalized_search_text);
END;
CREATE TRIGGER IF NOT EXISTS catalog_search_fans_ad AFTER DELETE ON fans BEGIN
  DELETE FROM catalog_search WHERE id = old.id AND kind = 'fan';
END;
CREATE TRIGGER IF NOT EXISTS catalog_search_fans_au AFTER UPDATE ON fans BEGIN
  DELETE FROM catalog_search WHERE id = old.id AND kind = 'fan';
  INSERT INTO catalog_search VALUES (new.id, 'fan', trim(new.brand || ' ' || new.model), new.normalized_search_text);
END;

CREATE TRIGGER IF NOT EXISTS catalog_search_motherboards_ai AFTER INSERT ON motherboards BEGIN
  INSERT INTO catalog_search VALUES (new.id, 'motherboard', trim(new.brand || ' ' || new.name), new.normalized_search_text);
END;
CREATE TRIGGER IF NOT EXISTS catalog_search_motherboards_ad AFTER DELETE ON motherboards BEGIN
  DELETE FROM catalog_search WHERE id = old.id AND kind = 'motherboard';
END;
CREATE TRIGGER IF NOT EXISTS catalog_search_motherboards_au AFTER UPDATE ON motherboards BEGIN
  DELETE FROM catalog_search WHERE id = old.id AND kind = 'motherboard';
  INSERT INTO catalog_search VALUES (new.id, 'motherboard', trim(new.brand || ' ' || new.name), new.normalized_search_text);
END;

CREATE TRIGGER IF NOT EXISTS catalog_search_psus_ai AFTER INSERT ON psus BEGIN
  INSERT INTO catalog_search VALUES (new.id, 'psu', trim(new.brand || ' ' || new.name), new.normalized_search_text);
END;
CREATE TRIGGER IF NOT EXISTS catalog_search_psus_ad AFTER DELETE ON psus BEGIN
  DELETE FROM catalog_search WHERE id = old.id AND kind = 'psu';
END;
CREATE TRIGGER IF NOT EXISTS catalog_search_psus_au AFTER UPDATE ON psus BEGIN
  DELETE FROM catalog_search WHERE id = old.id AND kind = 'psu';
  INSERT INTO catalog_search VALUES (new.id, 'psu', trim(new.brand || ' ' || new.name), new.normalized_search_text);
END;

CREATE TRIGGER IF NOT EXISTS catalog_search_ram_ai AFTER INSERT ON ram BEGIN
  INSERT INTO catalog_search VALUES (new.id, 'ram', trim(new.brand || ' ' || new.model), new.normalized_search_text);
END;
CREATE TRIGGER IF NOT EXISTS catalog_search_ram_ad AFTER DELETE ON ram BEGIN
  DELETE FROM catalog_search WHERE id = old.id AND kind = 'ram';
END;
CREATE TRIGGER IF NOT EXISTS catalog_search_ram_au AFTER UPDATE ON ram BEGIN
  DELETE FROM catalog_search WHERE id = old.id AND kind = 'ram';
  INSERT INTO catalog_search VALUES (new.id, 'ram', trim(new.brand || ' ' || new.model), new.normalized_search_text);
END;

PRAGMA optimize;
