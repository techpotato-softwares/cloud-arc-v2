# Repository architecture

```mermaid
flowchart TB
  subgraph Internal["ForgeArc internal workspace"]
    Docs["apps/docs · VitePress"]
    Marketing["apps/marketing · Vue"]
    Commerce["services/commerce · FastAPI"]
    Catalog["packages/commercial-catalog"]
  end
  subgraph Products["Independent products"]
    Node["products/forgearc-node"]
    Python["products/forgearc-python"]
    AI["products/forgearc-ai"]
  end
  Marketing --> Commerce
  Commerce --> Catalog
  Docs -. documents .-> Products
  Node --> NodeZip["standalone Node ZIP"]
  Python --> PythonZip["standalone Python ZIP"]
```

pnpm and Turborepo govern JavaScript packages. A single root uv workspace
governs commerce and the Python product packages. Node and Python implement the
same product contract independently; neither runtime imports the other.

Within each product, `apps/api` is the host, `packages/shared` is reusable
runtime infrastructure, `modules` contains sellable capabilities, and
`infra/cdk` deploys generated contracts and assets.
