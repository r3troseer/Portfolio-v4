"""Layer 1 evidence indexing (first slice: backend-owned public evidence index).

Reads approved Layer 0 content (apps/web/src/content/public/) and produces
deterministic, fail-closed-gated evidence records. No LLM calls, no embeddings,
no retrieval endpoint in this slice - see docs/agent/layer1-evidence-index.md.
"""
