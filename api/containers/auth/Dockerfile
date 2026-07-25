# ECS Express — auth-service (Fastify). Phase 2: wire module entrypoint.
FROM node:20-alpine
WORKDIR /app
HEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/health || exit 1
EXPOSE 3000
CMD ["node", "-e", "require('http').createServer((q,s)=>s.end('ok')).listen(3000)"]
