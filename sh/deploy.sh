#!/bin/bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" 
nvm use node

cd /work/barunChuk


git pull;

SRC=/work/barunChuk/backend/server
DEST=/$HOME/deployment

rm -rf $DEST
mkdir -p $DEST
cp -r $SRC $DEST

cd $DEST/server

source ~/.bashrc

npm install

pm2 restart all
