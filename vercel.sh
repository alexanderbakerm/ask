#!/bin/bash

if [[ $VERCEL_ENV == "production" || $VERCEL_GIT_COMMIT_REF == "staging" ]] ; then
  npm run build
  if [[ "${SKIP_DB_MIGRATE:-}" != "1" ]]; then
    npm run db:migrate
  fi
else
  npm run build
fi