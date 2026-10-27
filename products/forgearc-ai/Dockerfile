# Portable ForgeArc AI image. ECS tasks expect linux/amd64:
#   docker build --platform linux/amd64 -t forgearc-ai .
# Local builds may use the host architecture.

FROM python:3.12-slim-bookworm AS build

COPY --from=ghcr.io/astral-sh/uv:0.12.13 /uv /usr/local/bin/uv
WORKDIR /src
COPY packages ./packages
COPY apps/api ./apps/api
COPY image/pyproject.toml ./pyproject.toml
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy
RUN uv lock && uv sync --all-packages --no-dev --no-editable

FROM python:3.12-slim-bookworm AS runtime

RUN useradd --uid 1000 --create-home --shell /usr/sbin/nologin forgearc \
    && mkdir -p /app /tmp \
    && chown forgearc:forgearc /app /tmp
COPY --from=build /opt/venv /opt/venv
COPY migrations /app/migrations
COPY forgearc-ai.yaml /app/forgearc-ai.yaml
COPY scripts/entrypoint.sh /app/entrypoint.sh
RUN chmod 755 /app/entrypoint.sh
ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FORGEARC_AI_CONFIG=/app/forgearc-ai.yaml \
    PORT=8080 \
    HOME=/tmp \
    TMPDIR=/tmp
WORKDIR /app
USER 1000
EXPOSE 8080
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health')"
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["api"]
