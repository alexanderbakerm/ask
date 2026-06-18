#!/bin/bash

if [[ $VERCEL_ENV == "production" || $VERCEL_GIT_COMMIT_REF == "staging" ]] ; then 
  npm run deploy
else 
  npm run build
fi