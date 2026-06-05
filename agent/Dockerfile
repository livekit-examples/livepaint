# Example Dockerfile for deploying a LiveKit Agent.
#
# It uses a multi-stage build: dependencies are installed with uv in a "builder"
# stage, then only the resulting virtualenv and the app source are copied into a
# slim runtime image. This keeps uv and the build toolchain out of the final
# image, producing a smaller and more secure container.
# See https://docs.astral.sh/uv/guides/integration/docker/ for more details.
# syntax=docker/dockerfile:1

ARG PYTHON_VERSION=3.12

# ---- Builder stage: resolve and install dependencies into /app/.venv ----
FROM ghcr.io/astral-sh/uv:python${PYTHON_VERSION}-bookworm-slim AS builder

# Compile bytecode for faster cold starts and copy (rather than symlink) packages
# so the virtualenv is self-contained and can be copied to the runtime stage.
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0

WORKDIR /app

# Install dependencies first, without the project source, so this layer is cached
# and only re-run when pyproject.toml or uv.lock change. --no-dev skips dev-only
# tooling (e.g. ruff); --locked ensures the install matches uv.lock exactly.
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-dev --no-install-project

# ---- Runtime stage: minimal image with just Python, the venv, and the app ----
FROM python:${PYTHON_VERSION}-slim-bookworm

# Keep Python from buffering stdout/stderr (so logs surface immediately) and from
# writing .pyc files at runtime. Put the venv's executables first on PATH so
# `python` resolves to the project's interpreter.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:${PATH}"

# Create a non-privileged user that the app will run under.
# See https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user
ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/home/appuser" \
    --shell "/sbin/nologin" \
    --uid "${UID}" \
    appuser

WORKDIR /app

# Copy the prepared virtualenv from the builder, then the application source.
COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv
COPY --chown=appuser:appuser . .

USER appuser

# Ensure any dependent models (e.g. plugin assets) are downloaded at build time
# rather than on first connection.
RUN python -m livekit.agents download-files

# The agent worker exposes a health check on port 8081 (referenced by fly.toml).
EXPOSE 8081

# Run the application.
CMD ["python", "main.py", "start"]
