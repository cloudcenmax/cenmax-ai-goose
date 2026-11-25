# Goose qualification

Tested 2026-11-25 with official Goose v1.60.2 Linux ARM64 musl CLI and Node.js 24.22.3 in a disposable container. The release archive's SHA-256 matched the official GitHub release metadata. No Goose installation was made on the host machine. A standard Linux TLS CA certificate bundle was required by the minimal test image; certificate verification remained enabled.

| Check | Result |
| --- | --- |
| Helper device authorization and private credential persistence | Passed |
| Live account-specific catalogue and generated provider JSON | Passed; only entitled Cenmax AI IDs and labels |
| Native Goose custom provider and command authentication | Passed |
| Streamed generation and real built-in developer file-tool execution | Passed; one successful tool call, 30 message events, exact randomly generated file content |
| Named-session recovery in a fresh Goose process | Passed; 28 message events, exact earlier file content, zero additional tool calls |
| Refresh through Goose command authentication after locally forced expiry | Passed; rotating refresh credential changed |
| Helper credential-store remote revocation and local cleanup | Passed; local session removed and old access credential returned HTTP 401 |
| Included recipe parsed and rendered by the real host | Passed |
| Helper regression suite | 16 tests passed, including refresh headroom covering the command-auth cache |

The file read used Goose's actual built-in developer shell tool against a synthetic file inside the disposable environment. The test grant was revoked afterward. Independent review subsequently added proactive refresh headroom for the five-minute command-auth cache; its near-expiry boundary is regression-tested, while the underlying refresh path was exercised live with forced expiry. No credentials, account data or session transcripts are included in this package.

Not qualified: desktop UI, other operating systems, automatic same-process retry after HTTP 401, account-switching concurrency, subscription exhaustion, load testing, or end-to-end recipe inference. The recipe was parsed and rendered; the independent streamed tool round trip used a direct CLI prompt. This helper shares one account per operating-system user, including across Goose profiles. npm publication, native provider inclusion and recipe-gallery listing remain separate release steps.
