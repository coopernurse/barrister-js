#!/bin/sh

set -e

BARRISTER=/usr/local/github/barrister
source $BARRISTER/env/activate
export PYTHONPATH=$PYTHONPATH:$BARRISTER
export PATH=$PATH:$BARRISTER/bin

git pull
npm install
make clean all
#rsync -avz docs/ james@barrister.bitmechanic.com:/home/james/barrister-site/api/js/latest/
#rsync -avz post-build/ james@barrister.bitmechanic.com:/home/james/barrister-site/dist/js/latest/
