#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "==> [JanKavach] Upgrading pip..."
python -m pip install --upgrade pip

echo "==> [JanKavach] Installing CPU-optimized PyTorch (saves ~2.3GB download and avoids free-tier OOM)..."
pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo "==> [JanKavach] Installing dependencies from requirements.txt..."
pip install --no-cache-dir -r requirements.txt

echo "==> [JanKavach] Build finished successfully!"
