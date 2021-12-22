#! /bin/sh

set -eux

echo $(uname -a)

ls -la

yarn

yarn p:gen

yarn build

rm -rf /root/.cache
