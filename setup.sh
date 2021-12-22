#! /bin/sh

set -eux

echo $(uname -a)

ls -la

cat .git/ORIG_HEAD

yarn

yarn p:gen

yarn build

rm -rf /root/.cache
