#!/bin/bash
set -eux

RUNNER_VERSION=2.331.0
RUNNER_DIR=/opt/github-runner
RUNNER_USER=github

useradd -m $RUNNER_USER
mkdir -p $RUNNER_DIR
cd $RUNNER_DIR

curl -L -o runner.tar.gz \
  https://github.com/actions/runner/releases/download/v$RUNNER_VERSION/actions-runner-linux-x64-$RUNNER_VERSION.tar.gz

tar xzf runner.tar.gz
chown -R $RUNNER_USER:$RUNNER_USER $RUNNER_DIR

# Token fetched via GitHub App (e.g. SSM or metadata endpoint)
RUNNER_TOKEN=$(curl http://169.254.169.254/latest/user-data | jq -r .runner_token)

sudo -u $RUNNER_USER ./config.sh \
  --url https://github.com/my-org/my-repo \
  --token $RUNNER_TOKEN \
  --unattended \
  --ephemeral

cat <<EOF >/etc/systemd/system/github-runner.service
[Unit]
Description=GitHub Actions Runner
After=network.target

[Service]
ExecStart=$RUNNER_DIR/run.sh
User=$RUNNER_USER
Restart=no
ExecStopPost=/sbin/shutdown -h now

[Install]
WantedBy=multi-user.target
EOF

systemctl enable github-runner
systemctl start github-runner


# 0801025721086
# uj email: 226111892@student.uj.ac.za
# 0678097605
# 2. armbrightsparks@arm.co.za
# 6 Tulbach Mews Tulbach Avenue Homelake Ext 1 Randfontein