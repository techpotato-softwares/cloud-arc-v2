# Getting started — Node CloudArc

Copy the **`node-cloud-arc`** folder, then:

1. [ ] `cd` into your copied folder
2. [ ] `docker compose up -d`
3. [ ] `cp api/.env.example api/.env`
4. [ ] `cd api && npm install`
5. [ ] `npm run db:generate && npm run db:push`
6. [ ] `npm run db:seed:admin` (set `ADMIN_EMAIL` / `ADMIN_PASSWORD` if you want)
7. [ ] `npm run build:all && npm run dev:express`
8. [ ] Login: `POST http://localhost:4000/api/login` then try `/api/demo/items`
9. [ ] Configure `cdk/` for **your** AWS account (no sample account IDs)
10. [ ] `cd cdk && npm install && npx cdk deploy ApiStack-dev`
11. [ ] Restrict CORS + set production JWT secrets before go-live
12. [ ] Read [SECURITY.md](SECURITY.md)

Full architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
