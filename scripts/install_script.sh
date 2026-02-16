#!/bin/bash
set -eux

RUNNER_VERSION=2.331.0
RUNNER_DIR=/home/github-runner/actions-runner
RUNNER_USER=github-runner

sudo useradd -m -s /bin/bash $RUNNER_USER
sudo usermod -aG sudo $RUNNER_USER

sudo apt update && sudo apt upgrade -y

sudo apt install -y \
    curl \
    jq \
    build-essential \
    libssl-dev \
    libffi-dev \
    python3 \
    python3-venv \
    python3-dev \
    libicu-dev

sudo su - $RUNNER_USER

mkdir -p $RUNNER_DIR && cd $RUNNER_DIR
sudo chown -R $RUNNER_USER:$RUNNER_USER $RUNNER_DIR

curl -o actions-runner-linux-x64-$RUNNER_VERSION.tar.gz -L \
    https://github.com/actions/runner/releases/download/v$RUNNER_VERSION/actions-runner-linux-x64-$RUNNER_VERSION.tar.gz

tar xzf ./actions-runner-linux-x64-$RUNNER_VERSION.tar.gz

sudo -u $RUNNER_USER ./config.sh \
  --url "https://github.com/<GITHUB_OWNER>/<REPOSITORY_NAME>" \
  --token $RUNNER_TOKEN \
  --labels ubuntu,ubuntu-22.04 \
  --unattended \
  --ephemeral

sudo ./svc.sh install $RUNNER_USER || true

sudo ./svc.sh start || true
