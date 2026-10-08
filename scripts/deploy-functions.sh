#!/usr/bin/env bash
# Deploys the Supabase Edge Functions (Lumi and push) to ONE environment.
#   ./scripts/deploy-functions.sh staging
#   ./scripts/deploy-functions.sh prod
# Fill in the two project references first. A project's reference is the code in its URL:
#   https://<REFERENCE>.supabase.co
set -euo pipefail

STAGING_REF="rbrpgjcwiptuvuluqrxs"
PROD_REF=""   # <- paste your production project's reference here

case "${1:-}" in
  staging) REF="dknrujlwixgtgdomukqy" ;;
  prod|production) REF="$PROD_REF" ;;
  *) echo "Usage: $0 staging|prod"; exit 1 ;;
esac
if [ -z "$REF" ]; then echo "That environment's project reference is not filled in at the top of this script."; exit 1; fi

echo "Deploying functions to project $REF …"
npx supabase functions deploy lumi --project-ref "$REF"
npx supabase functions deploy send-push --no-verify-jwt --project-ref "$REF"
echo "Done. Secrets are set per project:  npx supabase secrets set KEY=value --project-ref $REF"
