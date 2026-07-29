FROM oven/bun:1@sha256:0733e50325078969732ebe3b15ce4c4be5082f18c4ac1a0f0ca4839c2e4e42a7 AS builder

WORKDIR /build/web
COPY web/package.json web/bun.lock ./
COPY web/default/package.json ./default/package.json
COPY web/classic/package.json ./classic/package.json
RUN bun install --frozen-lockfile
COPY ./web/default ./default
COPY ./VERSION /build/VERSION
RUN cd default \
    && VERSION=$(tr -d '\r\n' < /build/VERSION) \
    && DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION="$VERSION" bun run build \
    && bun scripts/verify-build-version.mjs --dist dist --version "$VERSION"

FROM oven/bun:1@sha256:0733e50325078969732ebe3b15ce4c4be5082f18c4ac1a0f0ca4839c2e4e42a7 AS builder-classic

WORKDIR /build/web
COPY web/package.json web/bun.lock ./
COPY web/default/package.json ./default/package.json
COPY web/classic/package.json ./classic/package.json
RUN bun install --filter ./classic --frozen-lockfile
COPY ./web/classic ./classic
COPY ./VERSION /build/VERSION
RUN cd classic && VITE_REACT_APP_VERSION=$(tr -d '\r\n' < /build/VERSION) bun run build

FROM golang:1.26.5-alpine@sha256:0178a641fbb4858c5f1b48e34bdaabe0350a330a1b1149aabd498d0699ff5fb2 AS go-base

FROM go-base AS builder2
ENV GO111MODULE=on CGO_ENABLED=0

ARG TARGETOS
ARG TARGETARCH
ARG GO_DOWNLOAD_GODEBUG=
ARG GO_DOWNLOAD_GOPROXY=
ENV GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64}
ENV GOEXPERIMENT=greenteagc

WORKDIR /build

ADD go.mod go.sum ./
RUN if [ -n "${GO_DOWNLOAD_GOPROXY}" ]; then export GOPROXY="${GO_DOWNLOAD_GOPROXY}"; fi \
    && GODEBUG="${GO_DOWNLOAD_GODEBUG}" go mod download

COPY . .
COPY --from=builder /build/web/default/dist ./web/default/dist
COPY --from=builder-classic /build/web/classic/dist ./web/classic/dist
RUN VERSION=$(tr -d '\r\n' < VERSION) \
    && go build -trimpath -ldflags "-s -w -X github.com/QuantumNous/new-api/common.Version=${VERSION}" -o new-api \
    && go build -trimpath -ldflags "-s -w" -o healthcheck ./cmd/healthcheck \
    && mkdir -p runtime/data runtime/logs runtime/tmp \
    && chmod 1777 runtime/tmp

FROM gcr.io/distroless/static-debian12:nonroot@sha256:f5b485ea962d9bd1186b2f6b3a061191539b905b82ec395de78cbfae51f20e35

LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.source="https://github.com/liuyingcai/new-api-jistai"

COPY --from=builder2 /build/new-api /
COPY --from=builder2 /build/healthcheck /
COPY --from=builder2 --chown=65532:65532 /build/runtime/data /data
COPY --from=builder2 --chown=65532:65532 /build/runtime/logs /app/logs
COPY --from=builder2 --chown=65532:65532 /build/runtime/tmp /tmp
COPY LICENSE NOTICE THIRD-PARTY-LICENSES.md VENDORED-SOURCES.json /licenses/
COPY third_party/licenses/ /licenses/third_party/licenses/
ENV TMPDIR=/tmp
EXPOSE 3000
# Existing mounts must be writable by 65532:65532; see docs/installation/nonroot-container.md.
USER 65532:65532
WORKDIR /data
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD ["/healthcheck"]
ENTRYPOINT ["/new-api"]
