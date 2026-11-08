#!/bin/sh
# Check that a feedbai box is what deploy/cloud-init.yaml says it is, on any provider or machine.
# Usage: deploy/check.sh <address> [ssh key]   (default key: ~/.ssh/feedbai-ops_ed25519)
# Read-only: it changes nothing on the box. Exit code 0 only when every check passes.
set -eu
host=${1:?usage: deploy/check.sh <address> [ssh key]}
key=${2:-$HOME/.ssh/feedbai-ops_ed25519}
ssh_opts="-o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15"

fails=0
outside() { # a check from here, against the box
  if eval "$2" >/dev/null 2>&1; then echo "ok   $1"; else echo "FAIL $1"; fails=$((fails + 1)); fi
}
outside "the agent's key logs in as ops" "ssh $ssh_opts -i '$key' ops@$host true"
outside "root can't log in" "! ssh $ssh_opts -i '$key' root@$host true"
outside "no password logins offered" "! ssh -o IdentitiesOnly=yes -o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive -o BatchMode=yes -o ConnectTimeout=15 ops@$host true 2>&1 | grep -q 'password\|keyboard'"

# Checks on the box, as ops (sudo only reads)
ssh $ssh_opts -i "$key" "ops@$host" sh -s <<'ON_BOX' || fails=$((fails + 1))
f=0
check() { if sh -c "$2" >/dev/null 2>&1; then echo "ok   $1"; else echo "FAIL $1"; f=$((f + 1)); fi; }
check "first-boot setup finished" "test -f /var/lib/cloud/feedbai-ready"
check "Debian 12 or newer" "test \$(cut -d. -f1 /etc/debian_version) -ge 12"
check "sshd: key only, no root, only ops" "sudo sshd -T | grep -qx 'passwordauthentication no' && sudo sshd -T | grep -qx 'permitrootlogin no' && sudo sshd -T | grep -qx 'allowusers ops' && sudo sshd -T | grep -qx 'kbdinteractiveauthentication no'"
check "sshd: nothing forwarded" "sudo sshd -T | grep -qx 'allowtcpforwarding no' && sudo sshd -T | grep -qx 'allowagentforwarding no' && sudo sshd -T | grep -qx 'x11forwarding no'"
check "only ssh listens on the network (TCP)" "test -z \"\$(sudo ss -Htln | awk '{print \$4}' | grep -vE '(127\.0\.0\.[0-9]+|\[::1\]|\[?::ffff:127\.0\.0\.[0-9]+\]?):[0-9]+\$' | grep -vE ':22\$')\""
check "automatic security updates on" "systemctl is-enabled unattended-upgrades && apt-config dump | grep -q 'APT::Periodic::Unattended-Upgrade \"1\"'"
check "logs capped" "test -f /etc/systemd/journald.conf.d/10-feedbai.conf"
check "kernel hardening applied" "test \"\$(sudo cat /proc/sys/kernel/kptr_restrict /proc/sys/kernel/dmesg_restrict /proc/sys/kernel/unprivileged_bpf_disabled /proc/sys/net/core/bpf_jit_harden | tr '\\n' ' ')\" = '2 1 1 2 '"
check "root: no keys, password locked" "sudo test ! -s /root/.ssh/authorized_keys && sudo passwd -S root | grep -qE '^root (L|LK) '"
check "runner: no login, has its own id range" "getent passwd runner | grep -q nologin && grep -q '^runner:' /etc/subuid"
check "runner's services run without a login" "test -f /var/lib/systemd/linger/runner"
check "rootless containers work for runner" "sudo -u runner -H sh -c 'cd /tmp && XDG_RUNTIME_DIR=/run/user/\$(id -u) podman info --format {{.Host.Security.Rootless}}' | grep -qx true"
check "no secrets in the setup data" "! sudo grep -qE 'PRIVATE KEY|ghp_|github_pat_|ghs_|syt_|sk-[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{20,}' /var/lib/cloud/instance/user-data.txt"
exit $f
ON_BOX

[ "$fails" -eq 0 ] && echo "All checks passed." || { echo "$fails check(s) failed."; exit 1; }
