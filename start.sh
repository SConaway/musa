#! /bin/sh

set -eux

echo $(uname -a)

export NODE_ENV=production

# yarn p:deploy
./node_modules/.bin/prisma migrate deploy

# yarn start
node dist/index.js
