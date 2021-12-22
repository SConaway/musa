#! /bin/sh

yarn

yarn p:gen

yarn build

rm -rf /root/.cache
