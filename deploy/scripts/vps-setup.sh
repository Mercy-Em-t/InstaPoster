#!/usr/bin/env bash
set -euo pipefail

sudo apt update
sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git

sudo systemctl enable --now docker
sudo systemctl enable --now nginx

echo "VPS prerequisites installed."
echo "Next: copy deploy/nginx/instaposter.conf to /etc/nginx/sites-available, enable site, then run certbot."
