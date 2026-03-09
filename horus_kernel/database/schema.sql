-- The Nodes: Physical or Digital Entities
CREATE TABLE IF NOT EXISTS intel_nodes (
    node_id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    type TEXT NOT NULL,
    lat REAL,
    lon REAL,
    metadata JSON,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- The Edges: Causal Relationships
CREATE TABLE IF NOT EXISTS intel_edges (
    edge_id TEXT PRIMARY KEY,
    source_node TEXT,
    target_node TEXT,
    relationship TEXT,
    weight REAL DEFAULT 1.0,
    FOREIGN KEY(source_node) REFERENCES intel_nodes(node_id),
    FOREIGN KEY(target_node) REFERENCES intel_nodes(node_id)
);
