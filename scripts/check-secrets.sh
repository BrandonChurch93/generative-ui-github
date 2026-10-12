#!/usr/bin/env bash
# Greps the build output and the client bundles for secrets: GitHub and Anthropic key patterns, and the
# configured token and key themselves. Prints file names only, never a match. Exit 0 when clean.
set -euo pipefail
cd "$(dirname "$0")/.."

TARGETS=(apps/web/.next apps/mcp-app/dist)
for t in "${TARGETS[@]}"; do
  [ -d "$t" ] || { echo "missing $t: build first (pnpm --filter @genui-github/web build, pnpm --filter @genui-github/mcp-app build)"; exit 2; }
done
[ -d apps/web/.next/static ] || { echo "no client bundles in apps/web/.next/static: run a production build"; exit 2; }

# The configured values, read the way the app reads them, held only in this process.
if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

# Built from pieces so this file never holds a key prefix whole: a grep of the repo for one finds only a real key.
gh='gh' pat='github''_pat_' ant='sk''-ant-'
PATTERNS="${gh}p_[A-Za-z0-9]{30,}|${gh}o_[A-Za-z0-9]{30,}|${gh}s_[A-Za-z0-9]{30,}|${pat}[A-Za-z0-9_]{40,}|${ant}[A-Za-z0-9_-]{30,}"
found=0
scan() {
  local label=$1
  shift
  local files
  # dev/ is the dev server's own build; cache/ holds the build's private caches; neither is served.
  files=$(grep -rlE --exclude-dir=dev --exclude-dir=cache --exclude=check-secrets.sh "$@" "${TARGETS[@]}" 2>/dev/null || true)
  if [ -n "$files" ]; then
    echo "FAIL $label in:"
    echo "$files" | sed 's/^/  /'
    found=1
  else
    echo "ok   no $label"
  fi
}

scan "key-shaped strings" "$PATTERNS"
for name in GITHUB_TOKEN ANTHROPIC_API_KEY KV_REST_API_TOKEN; do
  value=${!name:-}
  if [ -z "$value" ]; then
    echo "skip $name is not set"
    continue
  fi
  # -f reads the value from a file descriptor, so it never appears in a process list.
  scan "$name value" -F -f <(printf '%s\n' "$value")
done

# The client bundles must not even name the server-side variables.
client=$(grep -rlE 'GITHUB_TOKEN|ANTHROPIC_API_KEY|KV_REST_API_TOKEN' apps/web/.next/static apps/mcp-app/dist 2>/dev/null || true)
if [ -n "$client" ]; then
  echo "FAIL a server variable is named in a client bundle:"
  echo "$client" | sed 's/^/  /'
  found=1
else
  echo "ok   no server variable named in a client bundle"
fi

exit $found
