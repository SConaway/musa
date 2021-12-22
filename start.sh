#! /bin/sh

set -eux

echo $(uname -a)

cat .git/ORIG_HEAD

yarn p:deploy

yarn start
