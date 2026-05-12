"""
Export OpenAPI JSON for TS codegen (`bun run openapi:export`).

Route handlers and Pydantic models in ``server.py`` own summaries/descriptions;
keep those docstrings and ``Field`` / ``File`` descriptions—they flow into
``openapi.json`` and ``packages/sdk/src/schema.d.ts``.
"""

import json

from server import app

schema = app.openapi()

with open("openapi.json", "w") as f:
    json.dump(schema, f, indent=2)

print("openapi.json exported successfully.")
