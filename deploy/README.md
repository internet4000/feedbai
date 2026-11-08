# The feedbai box

The hosted tier ([architecture](../docs/architecture.md#the-hosted-tier-one-small-box-many-projects-sealed-from-each-other)) runs on one small machine, set up entirely by [`cloud-init.yaml`](cloud-init.yaml) and verified by [`check.sh`](check.sh). It works the same on any cloud and on a machine at home: cloud-init is the standard first-boot setup that nearly every provider and Debian's own images understand. The box is disposable: rebuild it from the same file at any time, or whenever it may be compromised.

**Status: prototype.** The base system is set up; the hosted runner itself is still being built.

## What the box knows

The aim is that the box knows as little as possible, and nothing it could leak alone:

- **Built from public files only.** Everything that sets it up is in this folder: anyone can read exactly what runs. The setup data (`cloud-init.yaml`) holds no secrets, because providers and the machine's metadata service can read it back; `check.sh` makes sure.
- **No owner keys.** Your personal SSH or GPG keys never go on it. During the prototype one dedicated key, the agent's, logs into one unprivileged user; in production nobody keeps a login and the box updates itself.
- **No project data at rest.** A run fetches feedback, triages it, files issues and forgets: only cursors (last-seen ids) and hashes of what was filed stay. Logs never hold message text and are kept 14 days at most.
- **No project secrets.** Projects keep their own credentials (for example their model key, in their own GitHub Actions secrets); runs prove which project they are with short-lived [OIDC identities](../SECURITY.md) instead of stored tokens. What the box itself needs (the tunnel token, the bots' and App's keys) is added after boot, encrypted at rest with `systemd-creds`, readable only by the service that uses it.
- **Nothing listening.** No inbound ports in production: the box reaches out to Cloudflare through a tunnel; the website and API reach it through that.

The honest limit: while a run processes a project's feedback, that text is in the box's memory. Whoever controls a running machine can read its memory, so the operator is trusted for the moment of the run, never for storage. Anyone who doesn't want that runs the same box themselves (below): the hosted tier is a convenience, not a requirement.

## Create one

You need: a machine that boots **Debian 12 or newer** with cloud-init, and the box's setup file with **your agent's public key** in it (replace the `feedbai-ops` key in `cloud-init.yaml`). One small CPU, 1 GB of memory and 20 GB of disk are enough to start. ARM or x86 both work.

### Any cloud with "user data" (Hetzner, OVH, Scaleway, DigitalOcean, Vultr, AWS…)

1. Turn on two-factor login for your provider account.
2. Create a firewall: **no inbound traffic** except SSH (22) from your own address during the prototype; all outbound allowed. Keep IPv4: GitHub's API doesn't speak IPv6.
3. Create the server with a **Debian** image, that firewall, and the contents of `cloud-init.yaml` as **user data** ("cloud config" on Hetzner, "user data" elsewhere).
4. **SSH keys at the provider:** add the same agent public key there too. Some providers otherwise set a root password (and email it); with a key they don't. Either way, first boot removes root's keys and locks its password: nobody logs in as root, the agent included.

### A machine at home (a Raspberry Pi, a mini PC, a virtual machine)

cloud-init reads its setup from a small disk labelled `cidata` (its "NoCloud" source), so the same file works offline:

- **Virtual machine (Proxmox, libvirt, UTM…):** use Debian's *generic cloud* image (`debian-13-genericcloud-<arch>.qcow2` from [cloud.debian.org](https://cloud.debian.org/images/cloud/)) and attach a seed disk made from the file: `cloud-localds seed.iso deploy/cloud-init.yaml` (package `cloud-image-utils`). Proxmox also takes it as a "cicustom" user snippet.
- **Raspberry Pi:** write Raspberry Pi OS (Debian 13 based, it uses cloud-init) or Debian's Raspberry Pi image to the card, then put `cloud-init.yaml` on its boot partition as `user-data`.
- **Mini PC or any bare machine:** a normal Debian install with the `cloud-init` package, plus a USB stick labelled `CIDATA` holding `user-data` (the file) and an empty `meta-data`.

At home, your router is the firewall: forward nothing to the box. It only makes outgoing connections.

### Then

Wait a few minutes for the first boot, and check it from your computer:

```sh
deploy/check.sh <address>
```

It logs in with the agent's key, changes nothing, and lists each promise above as `ok` or `FAIL`. Run it after every rebuild.

## Keys and secrets: the inventory

Every credential that touches the box, what it can do, and how to cut it off. Nothing here is in git.

| Credential | Held by | Can | Revoke |
| --- | --- | --- | --- |
| Provider account (+2FA) | owner | everything about the machine | owner only |
| Agent's SSH key (`~/.ssh/feedbai-ops_ed25519`, fingerprint `SHA256:+gAk/zXAZI5FJlzZIruYsaS2yvT9shblB9MJNry8ybo`) | the agent, on the owner's computer | log in as `ops` on the box (prototype) | remove it from `/home/ops/.ssh/authorized_keys`, or rebuild |
| Cloudflare Tunnel token | the box (encrypted credential) | connect the box to our domain | delete the tunnel in Cloudflare, create a new one |
| GitHub App private key | the box (encrypted) | act as the feedbai App on installed repos | generate a new key in the App settings, delete the old one |
| Matrix and Bluesky bot secrets | the box (encrypted) | act as the bots | `node hub/setup.js` (signs out old sessions), revoke the app password |
| Stripe keys and webhook secret | the box (encrypted) | create checkouts, read payments | roll them in the Stripe dashboard |
| Backup encryption key | the owner, **not on the box** | decrypt backups | make a new key, re-encrypt the next backup |

## Rebuild (any time)

1. Create a new box from the same file, and run `deploy/check.sh` on it.
2. Restore the latest backup, add the secrets again.
3. Point the tunnel at the new box, then delete the old one.

## If it's ever compromised

1. **Delete the machine** (or wipe its disk). Don't try to clean it.
2. **Rotate every secret** in the table above, starting with the GitHub App key, and replace the agent's SSH key.
3. **Rebuild** from the same file, restore the last backup made before the incident, add the new secrets.
4. **Find out what happened** (provider logs, Cloudflare logs, GitHub audit log), write it down, fix the cause, and tell the people affected.

## Before production

- Remove `ops`'s sudo, then SSH entirely: the box updates itself from signed releases and nobody, the agent included, keeps a standing login.
- Close port 22.
- Encrypted off-box backups, tested by restoring one.
