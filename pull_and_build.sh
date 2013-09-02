#!/bin/sh

set -e

git pull
npm install -d
make clean all
