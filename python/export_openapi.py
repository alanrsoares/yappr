import json

from server import app

# Ensure the OpenAPI schema is generated
schema = app.openapi()

# Write to file
with open("openapi.json", "w") as f:
    json.dump(schema, f, indent=2)

print("openapi.json exported successfully.")
