#!/bin/bash

set -e

export BARRISTER=/usr/local/github/barrister
source $BARRISTER/env/bin/activate
export PYTHONPATH=$PYTHONPATH:$BARRISTER
export PATH=$PATH:$BARRISTER/bin

git pull
npm install
echo $PATH
make clean all
#rsync -avz docs/ james@barrister.bitmechanic.com:/home/james/barrister-site/api/js/latest/
#rsync -avz post-build/ james@barrister.bitmechanic.com:/home/james/barrister-site/dist/js/latest/
