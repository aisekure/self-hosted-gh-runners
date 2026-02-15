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

curl -o actions-runner-linux-x64-$RUNNER_VERSION.tar.gz -L \
    https://github.com/actions/runner/releases/download/v$RUNNER_VERSION/actions-runner-linux-x64-$RUNNER_VERSION.tar.gz

tar xzf ./actions-runner-linux-x64-$RUNNER_VERSION.tar.gz

sudo -u $RUNNER_USER ./config.sh \
  --url "https://github.com/<GITHUB_OWNER>/<REPOSITORY_NAME>" \
  --token $RUNNER_TOKEN \
  --labels ubuntu,ubuntu-22.04 \
  --unattended \
  --ephemeral

sudo ./svc.sh install $RUNNER_USER

sudo ./svc.sh start

# ./config.sh --url "https://github.com/<GITHUB_OWNER>/<REPOSITORY_OWNER>" \
#      --token $RUNNER_TOKEN


# sudo tee /etc/systemd/system/github-runner.service > /dev/null << 'EOF'
# [Unit]
# Description=GitHub Actions Runner
# After=network.target

# [Service]
# # Run as the dedicated github-runner user
# User=github-runner
# Group=github-runner

# # Set the working directory to the runner installation
# WorkingDirectory=/home/github-runner/actions-runner

# # Execute the runner script
# ExecStart=/home/github-runner/actions-runner/run.sh

# # Restart the service if it fails
# Restart=always
# RestartSec=10

# # Environment variables for the runner
# Environment="RUNNER_ALLOW_RUNASROOT=0"

# # Security hardening options
# NoNewPrivileges=true
# ProtectSystem=strict
# ProtectHome=read-only
# ReadWritePaths=/home/github-runner/actions-runner

# # Resource limits
# MemoryMax=4G
# CPUQuota=200%

# [Install]
# WantedBy=multi-user.target
# EOF