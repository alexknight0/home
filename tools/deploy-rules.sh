#!/bin/sh
# Deploy a site's firestore.rules to its Firebase project through the Rules REST API (needs
# gcloud logged in as Alex). Usage: tools/deploy-rules.sh <project-id> <path/to/firestore.rules>
# Also seeds config/access (the Access page's lists) with `tools/deploy-rules.sh <pid> <rules> seed '<json fields>'`
# before the rules go live, e.g. seed '{"emails": {"arrayValue": {}}}', so nobody gets locked out.
set -eu
PID=$1
RULES=$2
TOK=$(gcloud auth print-access-token)
api() {
  curl -sf -H "Authorization: Bearer $TOK" -H "x-goog-user-project: ${PID}" -H "Content-Type: application/json" "$@"
}
if [ "${3:-}" = seed ]; then
  DOC="https://firestore.googleapis.com/v1/projects/${PID}/databases/(default)/documents/config/access"
  if api "$DOC" >/dev/null 2>&1; then
    echo "config/access already exists; left as it is"
  else
    api -X PATCH "$DOC" -d "{\"fields\": $4}" >/dev/null
    echo "Seeded config/access"
  fi
fi
BODY=$(python3 -c "import json,sys;print(json.dumps({'source':{'files':[{'name':'firestore.rules','content':open(sys.argv[1]).read()}]}}))" "$RULES")
RS=$(api -X POST "https://firebaserules.googleapis.com/v1/projects/${PID}/rulesets" -d "$BODY" |
  python3 -c "import sys,json;print(json.load(sys.stdin)['name'])")
REL="projects/${PID}/releases/cloud.firestore"
if api "https://firebaserules.googleapis.com/v1/${REL}" >/dev/null 2>&1; then
  api -X PATCH "https://firebaserules.googleapis.com/v1/${REL}" -d "{\"release\":{\"name\":\"${REL}\",\"rulesetName\":\"${RS}\"}}" >/dev/null
else
  api -X POST "https://firebaserules.googleapis.com/v1/projects/${PID}/releases" -d "{\"name\":\"${REL}\",\"rulesetName\":\"${RS}\"}" >/dev/null
fi
echo "Deployed $RS to $PID"
