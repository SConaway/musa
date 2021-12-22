#! /bin/sh

set -eux

echo $(uname -a)

yarn p:deploy

yarn start
