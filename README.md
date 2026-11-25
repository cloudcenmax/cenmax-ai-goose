# Cenmax AI for Goose

Use a Cenmax AI subscription in Goose with a refreshable command-auth provider. The helper handles OAuth sign-in, secure token storage, refresh and revocation; Goose keeps its own agent loop, tools and permissions.

## Status and requirements

Targets the custom-provider **command-based authentication** format documented for Goose **v1.60.2**. Requires Node.js 22.12+, a POSIX host, and a Goose release that implements `auth.command`, `args`, `refresh_interval` and `timeout_seconds`. No Goose binary is bundled or installed by this package.

The Cenmax AI service must register the public OAuth client `cenmax-goose` with the device-code and refresh-token grants and the `chat` scope. No client secret or pay-as-you-go key is required. Package installation does not register or activate the client.

Live qualification passed against the official Goose v1.60.2 Linux ARM64 CLI: OAuth approval, account catalogue, real streamed file-tool execution, named-session recovery, command-auth refresh and remote revocation. See [qualification details](QUALIFICATION.md). Other platforms, the desktop UI and subscription-limit handling have not been qualified. Minimal Linux containers need a standard TLS CA certificate bundle; keep TLS verification enabled.

## Install and connect

Download the [reviewed release package](https://github.com/cloudcenmax/cenmax-ai-goose/releases/tag/v0.1.0) into a permanent directory. It contains the integration, not the host harness:

```sh
mkdir cenmax-ai-goose
curl --fail --location --output cenmax-ai-goose-oauth-0.1.0.tgz https://github.com/cloudcenmax/cenmax-ai-goose/releases/download/v0.1.0/cenmax-ai-goose-oauth-0.1.0.tgz
tar -xzf cenmax-ai-goose-oauth-0.1.0.tgz --strip-components=1 -C cenmax-ai-goose
```

Run the helper without a global installation:

```sh
cd cenmax-ai-goose
node src/cli.mjs login
node src/cli.mjs models
node src/cli.mjs config > cenmax_ai.json
```

The remaining examples use `cenmax-goose`; substitute `node /absolute/path/to/cenmax-ai-goose/src/cli.mjs` when using the extracted release. From a source checkout, `npm test` runs the test suite and `npm install --global .` optionally installs that command.

Open the approval link, verify the code, and choose the personal or company account whose allowance should be used. Login prints its instructions to stderr. The `credential` subcommand is reserved for Goose's command-auth protocol: it writes a short-lived access token to stdout. Do not run it in a shared terminal, capture its output in logs, or paste it into a prompt.

Generate a token-free provider configuration:

```sh
cenmax-goose config > cenmax_ai.json
```

Review the JSON and copy it to Goose's `custom_providers` directory for your profile (`~/.config/goose/custom_providers/` on the standard macOS/Linux profile). The generated command uses the absolute Node and helper paths from this installation and an argument array, not a shell expression. Regenerate it if the helper moves.

```sh
goose configure
```

Select **Cenmax AI** and one of the model IDs returned for the account. Model IDs such as `pro` and `worker` are included only when entitled. The model configuration is a snapshot: regenerate it after switching accounts or changing plan access. The service continues to enforce current entitlement on every request. No fallback models or unrelated credentials are configured.

For a CLI session, pass the configured provider and an entitled model explicitly. For example, when `worker` appears in your catalogue:

```sh
goose run --provider cenmax_ai --model worker --with-builtin developer --text "Read README.md and summarize its purpose."
```

The included [file-summary recipe](recipes/file-summary.yaml) provides a reusable launch example. Run it from the directory containing the file, using the model you selected:

```sh
goose run --provider cenmax_ai --model worker --recipe /absolute/path/to/this/package/recipes/file-summary.yaml --params file=README.md
```

Review the tools and their permissions before running a recipe. Its read-only task instructions do not enforce filesystem isolation.

Goose reruns the credential command every five minutes and on applicable authentication failures; the helper refreshes when fewer than five minutes and thirty seconds remain, so the normal command-auth cache does not retain a nearly expired credential. It never prints refresh tokens. Requests use the fixed public origin `https://console.ai.cenmax.in` and subscription Chat Completions endpoint `/app/v1/chat/completions`.

To disconnect:

```sh
cenmax-goose logout
```

This revokes the current grant and removes the local session. A failed revocation retains the session so you can retry. Delete the Goose provider separately if you no longer want its entry.

## Credential safety

The helper stores one Cenmax AI account per operating-system user under `~/.config/cenmax-ai/goose`, using a private directory, mode-0600 files, atomic replacement, and cross-process locks. Separate Goose profiles running as that user share this helper session; signing in again changes the account they use. Use separate operating-system users for independent account isolation. Rotating refresh tokens are durably marked before dispatch. Uncertain refresh results invalidate the local session instead of replaying the old grant. Interrupted processes may leave a lock: stop all helper processes before an administrator removes a stale lock. Do not remove active locks or copy rotating credentials to other machines.

Origins are fixed, TLS verification stays enabled, redirects are rejected, error bodies are not printed, and catalogue fields are validated. This package adds no telemetry. Goose receives the current short-lived credential as required by its command-auth API. Goose, its tools, and other code running as the same user are trusted; file permissions do not isolate hostile code under that identity. Keep normal tool approvals enabled.

## Tests and public release

```sh
npm test
npm pack --dry-run
```

Tests use synthetic Cenmax AI identities and mocked network calls. They cover device authorization, expiry and errors, catalogue boundaries, refresh serialization and fencing, private-file safety, revocation retention, and generated command-auth JSON. Publish only the explicit package allowlist. Never include credentials, profile directories, logs, dependency directories or caches.

## Discovery and sharing

Share this helper package together with its generated, token-free provider configuration instructions. The configuration contains installation-specific absolute command paths, so users must generate their own copy after signing in. It is a model provider, not an MCP tool extension; listing it in an MCP extension catalogue would not install Cenmax AI authentication. The included recipe can be shared separately, but it requires the provider to be configured first and does not sign users in. Public recipe-gallery inclusion and native provider documentation require separate upstream submissions; no listing or npm publication is implied by this package.

References: [Goose command-based authentication](https://goose-docs.ai/docs/getting-started/providers/#command-based-authentication), [Goose v1.60.2](https://github.com/aaif-goose/goose/releases/tag/v1.60.2), [released recipe examples](https://github.com/aaif-goose/goose/tree/v1.60.2/documentation/src/pages/recipes/data/recipes).
