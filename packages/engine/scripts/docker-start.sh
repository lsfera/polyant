#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later

set -e

echo "==> Running database migrations..."
node --experimental-specifier-resolution=node ./packages/engine/dist/database/docker-migrate.js

echo "==> Starting engine..."
node ./packages/engine/dist/index.js
