FROM python:3.12-slim
WORKDIR /app
HEALTHCHECK CMD wget -qO- http://127.0.0.1:8000/health || exit 1
EXPOSE 8000
CMD ["python", "-c", "print('ai-service stub')"]
