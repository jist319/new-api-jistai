#!/usr/bin/env bash

set -euo pipefail

EXPECTED_VERSION="${1:-}"

fail() {
  local file="$1"
  shift
  printf '::error file=%s::%s\n' "$file" "$*" >&2
  exit 1
}

[[ -s VERSION ]] || fail VERSION 'VERSION is required and must not be empty'

LINE_COUNT=$(awk 'END { print NR }' VERSION)
[[ "$LINE_COUNT" -eq 1 ]] || fail VERSION 'VERSION must contain exactly one line'

VERSION_VALUE=$(sed -n '1p' VERSION)
VERSION_VALUE=${VERSION_VALUE%$'\r'}
[[ "$VERSION_VALUE" != *$'\r'* ]] || fail VERSION 'VERSION contains an unexpected carriage return'

if ! [[ "$VERSION_VALUE" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$ ]]; then
  fail VERSION 'VERSION must contain one v-prefixed semantic version'
fi
if [[ "$VERSION_VALUE" == *-* ]]; then
  PRERELEASE=${VERSION_VALUE#*-}
  IFS='.' read -ra PRERELEASE_IDENTIFIERS <<< "$PRERELEASE"
  for identifier in "${PRERELEASE_IDENTIFIERS[@]}"; do
    if [[ "$identifier" =~ ^[0-9]+$ && "$identifier" != "0" && "$identifier" == 0* ]]; then
      fail VERSION 'Numeric prerelease identifiers must not contain leading zeroes'
    fi
  done
fi
if [[ -n "$EXPECTED_VERSION" && "$VERSION_VALUE" != "$EXPECTED_VERSION" ]]; then
  fail VERSION "VERSION '$VERSION_VALUE' does not match '$EXPECTED_VERSION'"
fi

for file in LICENSE NOTICE THIRD-PARTY-LICENSES.md; do
  [[ -s "$file" ]] || fail "$file" "$file is required and must not be empty"
done

if grep -Fq 'Transitive dependencies should be audited before a final external release.' THIRD-PARTY-LICENSES.md; then
  fail THIRD-PARTY-LICENSES.md 'Regenerate and audit the direct and transitive dependency inventory before publishing'
fi
if grep -Fq '"@splinetool/runtime":' web/bun.lock; then
  fail web/bun.lock '@splinetool/runtime has no auditable redistribution license and must not be in the release lock'
fi

grep -Fq 'https://github.com/QuantumNous/new-api' NOTICE \
  || fail NOTICE 'Required upstream attribution link is missing'
grep -Fq 'https://github.com/liuyingcai/new-api-jistai' NOTICE \
  || fail NOTICE 'Required JistAI corresponding-source link is missing'

printf 'Release metadata validated for %s\n' "$VERSION_VALUE"
