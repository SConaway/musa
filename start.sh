#! /bin/sh

set -eux

echo $(uname -a)

export NODE_ENV=production

yarn p:deploy

yarn start
