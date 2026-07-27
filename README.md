# ArcForge vendor monorepo

Two **self-contained** kits. Copy one folder to start a backend — nothing else required.

| Copy this folder | Stack | Start here |
|------------------|-------|------------|
| [`node-cloud-arc/`](node-cloud-arc/) | TypeScript / AWS Lambda | [node-cloud-arc/README.md](node-cloud-arc/README.md) |
| [`python-cloud-arc/`](python-cloud-arc/) | Python / FastAPI | [python-cloud-arc/README.md](python-cloud-arc/README.md) |

```bash
cp -R node-cloud-arc ~/Projects/my-api
# or
cp -R python-cloud-arc ~/Projects/my-py-api
```

## Vendor helpers

| Path | Purpose |
|------|---------|
| `scripts/pack-node.sh` / `pack-python.sh` | Zip a kit for sale |
| `.github/workflows/` | CI for each kit |

```bash
npm run pack:node     # → releases/arcforge-node-*.zip
npm run pack:python   # → releases/arcforge-python-*.zip
```

## License

[LICENSE](LICENSE)
