#! /bin/sh

set -eux

echo $(uname -a)

ls -la

# yarn p:gen
./node_modules/.bin/prisma generate

# yarn build
./node_modules/.bin/tsc

rm -rf /root/.cache
