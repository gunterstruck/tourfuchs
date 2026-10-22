#!/usr/bin/env bash
set -euo pipefail

# Azure's Ubuntu mirror stalled on font packages until the job timed out
# (CI #892/#893, 22.10.2026). Use Ubuntu's official primary mirror instead.
# Keep normal APT signature checks and the complete Playwright dependency setup.
if [ -f /etc/apt/apt-mirrors.txt ]; then
  sudo sed -i 's|azure.archive.ubuntu.com|archive.ubuntu.com|g' /etc/apt/apt-mirrors.txt
fi
npx playwright install --with-deps chromium
