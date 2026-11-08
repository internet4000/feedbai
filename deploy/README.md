# The feedbai box

The hosted tier ([architecture](../docs/architecture.md#the-hosted-tier-one-small-box-many-projects-sealed-from-each-other)) runs on one small server, set up entirely from [`cloud-init.yaml`](cloud-init.yaml). The server is disposable: nothing on it matters that can't be restored. Rebuilding is creating a new server with the same file, restoring the encrypted backup, and adding fresh secrets.

**Status: prototype.** The base system is set up; the hosted runner itself is still being built. The first thing to settle on the real hardware is the sandbox for each run (rootless Podman, maybe gVisor).

## Create it

Any provider or machine with a recent Debian works (Hetzner, OVH, Scaleway, a Raspberry Pi). On Hetzner Cloud:

1. **Your account:** turn on two-factor authentication.
2. **Firewall** (Firewalls → Create): no inbound rules except **SSH (22) from your own IP address**, for the prototype only. All outbound allowed.
3. **Server:** the smallest ARM type (like a Raspberry Pi, so the same setup works there later), **Debian 13** (or 12 if 13 isn't offered), the firewall above.
   - **SSH keys:** none of yours is needed. The agent's prototype key is in the setup file; emergencies go through Hetzner's web console or a rebuild.
   - **Cloud config / user data:** paste `deploy/cloud-init.yaml` (with your own agent's public key if you reuse it).
4. **Wait** a few minutes, until `/var/lib/cloud/feedbai-ready` exists. Then give the agent the server's address.

## What's on it

- **Users:** `ops` (the agent's prototype login, key-only, sudo during the prototype only), `runner` (the service, no login shell; its jobs run in rootless containers). No root login, no passwords.
- **Nothing reachable from the internet** except SSH from your address (prototype). The website and API will reach it through an outgoing Cloudflare Tunnel.
- **Automatic security updates**, with a reboot at 04:00 when needed. Logs kept 14 days at most.

## Keys and secrets: the inventory

Every credential that touches the box, what it can do, and how to cut it off. Nothing here is in git.

| Credential | Held by | Can | Revoke |
| --- | --- | --- | --- |
| Hetzner account (+2FA) | owner | everything about the server | owner only |
| `feedbai-ops` SSH key (`~/.ssh/feedbai-ops_ed25519`, fingerprint `SHA256:+gAk/zXAZI5FJlzZIruYsaS2yvT9shblB9MJNry8ybo`) | the agent, on the owner's machine | log in as `ops` on this box only | remove it from `/home/ops/.ssh/authorized_keys`, or rebuild |
| Cloudflare Tunnel token | the box (systemd credential, encrypted) | connect the box to our domain | delete the tunnel in Cloudflare, create a new one |
| GitHub App private key | the box (encrypted) | act as the feedbai App on installed repos | generate a new key in the App settings, delete the old one |
| Matrix and Bluesky bot secrets | the box (encrypted) | act as the bots | `node hub/setup.js` (signs out old sessions), revoke the app password |
| Stripe keys and webhook secret | the box (encrypted) | create checkouts, read payments | roll them in the Stripe dashboard |
| Backup encryption key | the owner, **not on the box** | decrypt backups | make a new key, re-encrypt the next backup |

Secrets are added once the box is up, as systemd credentials (`systemd-creds encrypt`), never pasted into the setup file or committed.

## Rebuild (any time)

1. Create a new server from the same file (above).
2. Restore the latest backup, add the secrets again.
3. Point the tunnel at the new box, then delete the old server.

## If it's ever compromised

1. **Delete the server** (Hetzner console). Its disk goes with it.
2. **Rotate every secret** in the table above, starting with the GitHub App key, and revoke the `feedbai-ops` key (make a new one).
3. **Rebuild** from the same file, restore the last backup made before the incident, and add the new secrets.
4. **Find out what happened** (provider logs, Cloudflare logs, GitHub audit log), write it down, fix the cause, and tell the people affected.

## Before production

- Remove `ops`'s sudo, then remove SSH entirely: the box updates itself from signed releases, and nobody, the agent included, keeps a standing login.
- Close port 22 in the firewall.
- Encrypted off-box backups, tested by restoring one.
