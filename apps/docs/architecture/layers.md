# Product architecture layers

<LayerStack />

The layers are a navigation model, not a claim that every product ships every capability. Node and Python use the routing, application, data, infrastructure, and operations layers. ForgeArc AI adds intelligence and retrieval. GCP and advanced orchestration remain roadmap items.

## Dependency rule

Dependencies point inward: transport and cloud adapters call application contracts; application code does not import cloud SDKs. Controllers translate requests, services own use cases, repositories own persistence, and generated manifests connect source registration to infrastructure.

## Local and cloud parity

Local Express or FastAPI entrypoints and AWS Lambda entrypoints call the same controllers. This keeps rapid local feedback without creating a second application implementation.
