#!/bin/sh

set -e

git pull
npm install
make clean all
#rsync -avz docs/ james@barrister.bitmechanic.com:/home/james/barrister-site/api/js/latest/
#rsync -avz post-build/ james@barrister.bitmechanic.com:/home/james/barrister-site/dist/js/latest/
