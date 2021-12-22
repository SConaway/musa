#! /bin/sh

echo $(uname -a)

set -eux

yarn

yarn p:gen

yarn build

rm -rf /root/.cache
