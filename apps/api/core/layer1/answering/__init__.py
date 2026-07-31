"""Layer 1 grounded-answer service.

Retrieves public evidence (via the unchanged lexical retrieval service), calls a
server-side model provider, and strictly validates the model's JSON output
against the retrieved evidence before serving a grounded, cited answer. See
``service.py`` for the flow and ``docs/agent/layer1-playground.md`` for context.
"""
