#!/bin/bash
# Install the teaching-affairs relay on this machine as a systemd service.
#
# Run it from a checkout of this repository, so that relay.js sits next to
# this script:
#
#     bash cloud-function/deploy.sh
#
# The shared secret is generated once and kept in /etc/relay/env. Re-running
# the script keeps the existing secret, so the GitHub Actions side does not
# have to be reconfigured on every redeploy.

set -euo pipefail

RELAY_DIR="/opt/relay"
ENV_FILE="/etc/relay/env"
SERVICE_NAME="relay"
NODE_VERSION="v22.x"
NODE_PREFIX="/opt/node"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELAY_SRC="${SCRIPT_DIR}/relay.js"

if [ ! -f "$RELAY_SRC" ]; then
    echo "ERROR: $RELAY_SRC not found. Run this script from the repository checkout." >&2
    exit 1
fi

# ------------------------------------------------------------
# 1. Node.js
# ------------------------------------------------------------
if command -v node >/dev/null 2>&1; then
    echo "=== Node.js already present: $(node -v) ==="
else
    case "$(uname -m)" in
        aarch64|arm64) NODE_ARCH="arm64" ;;
        x86_64|amd64)  NODE_ARCH="x64" ;;
        *) echo "ERROR: unsupported architecture $(uname -m)" >&2; exit 1 ;;
    esac

    echo "=== Installing Node.js LTS (${NODE_ARCH}) into ${NODE_PREFIX} ==="
    TARBALL=$(curl -fsSL "https://nodejs.org/dist/latest-${NODE_VERSION}/" \
        | grep -o "node-v22\.[0-9.]*-linux-${NODE_ARCH}\.tar\.xz" | head -1)
    if [ -z "$TARBALL" ]; then
        echo "ERROR: could not find a Node.js release for ${NODE_ARCH}" >&2
        exit 1
    fi

    curl -fsSL -o /tmp/node.tar.xz "https://nodejs.org/dist/latest-${NODE_VERSION}/${TARBALL}"
    mkdir -p "$NODE_PREFIX"
    tar -xJf /tmp/node.tar.xz -C "$NODE_PREFIX" --strip-components=1
    rm -f /tmp/node.tar.xz

    for bin in node npm npx; do
        ln -sf "${NODE_PREFIX}/bin/${bin}" "/usr/local/bin/${bin}"
    done

    echo "=== Node.js installed: $(node -v) ==="
fi

NODE_BIN="$(command -v node)"

# ------------------------------------------------------------
# 2. Relay source
# ------------------------------------------------------------
echo "=== Installing relay.js into ${RELAY_DIR} ==="
mkdir -p "$RELAY_DIR"
install -m 644 "$RELAY_SRC" "${RELAY_DIR}/relay.js"

# ------------------------------------------------------------
# 3. Secret
# ------------------------------------------------------------
mkdir -p "$(dirname "$ENV_FILE")"

if [ -f "$ENV_FILE" ] && grep -q '^RELAY_SECRET=' "$ENV_FILE"; then
    echo "=== Keeping the existing secret in ${ENV_FILE} ==="
else
    echo "=== Generating a new secret ==="
    SECRET="$(openssl rand -hex 24)"
    printf 'RELAY_SECRET=%s\nPORT=3000\nBIND_HOST=0.0.0.0\n' "$SECRET" > "$ENV_FILE"
    chmod 600 "$ENV_FILE"
fi

# ------------------------------------------------------------
# 4. systemd service
# ------------------------------------------------------------
echo "=== Installing ${SERVICE_NAME}.service ==="
cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=Teaching-affairs API relay
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=${ENV_FILE}
ExecStart=${NODE_BIN} ${RELAY_DIR}/relay.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null
systemctl restart "$SERVICE_NAME"
sleep 2

# ------------------------------------------------------------
# 5. Self-test
# ------------------------------------------------------------
SECRET="$(grep '^RELAY_SECRET=' "$ENV_FILE" | cut -d= -f2-)"

echo ""
echo "=== Status ==="
systemctl is-active "$SERVICE_NAME"

echo ""
echo "=== Health check ==="
curl -fsS "http://127.0.0.1:3000/health?secret=${SECRET}" && echo ""

echo ""
echo "=== LAN addresses (useful for locating this box) ==="
curl -fsS "http://127.0.0.1:3000/lanip?secret=${SECRET}" && echo ""

echo ""
echo "=== Done ==="
echo "Set these in the GitHub repository secrets:"
echo "  RELAY_SECRET = ${SECRET}"
echo "  RELAY_URL    = the public URL of the tunnel in front of this relay"
