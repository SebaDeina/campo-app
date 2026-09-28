#!/usr/bin/env bash
# Despliega el commit actual (HEAD, no el working tree) en el VPS de Nimbo.
# Uso: ./deploy/deploy.sh
set -euo pipefail

HOST="root@77.37.49.211"
KEY="$HOME/.ssh/nimbo_vps"
DEST="/opt/campo"
SSH=(ssh -i "$KEY" -o BatchMode=yes "$HOST")

cd "$(git rev-parse --show-toplevel)"
COMMIT="$(git rev-parse --short HEAD)"
if ! git diff --quiet HEAD -- . ':!docs'; then
    echo "Aviso: hay cambios sin commitear; se despliega solo $COMMIT." >&2
fi

echo "Subiendo $COMMIT a $HOST:$DEST/src ..."
git archive --format=tar HEAD | "${SSH[@]}" "set -e
    rm -rf $DEST/src.new && mkdir -p $DEST/src.new
    tar -x -C $DEST/src.new
    echo $COMMIT > $DEST/src.new/DEPLOYED_COMMIT
    rm -rf $DEST/src.old && { [ -d $DEST/src ] && mv $DEST/src $DEST/src.old || true; }
    mv $DEST/src.new $DEST/src"

"${SSH[@]}" "set -e
    test -f $DEST/.env || { echo 'Falta $DEST/.env (ver deploy/env.example)'; exit 1; }
    install -d -m 700 -o 1000 -g 1000 $DEST/data
    install -d -m 700 $DEST/backups
    cd $DEST/src/deploy
    docker compose up -d --build
    for i in \$(seq 1 30); do
        if curl -fsS http://127.0.0.1:3600/api/health >/dev/null; then echo 'OK: campo $COMMIT en línea'; exit 0; fi
        sleep 2
    done
    docker compose logs --tail 80
    exit 1"
