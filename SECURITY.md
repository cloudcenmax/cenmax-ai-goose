# Security

Protect the helper's credential directory and the Goose profile. The `credential` command intentionally emits an access token for Goose's authentication protocol; never log or share that output. No refresh token is printed.

Use `cenmax-goose logout` to revoke the current grant. A failed or uncertain refresh requires a new login. Do not replay a spent grant or remove active locks.

Goose and code running as the same operating-system user are trusted. Separate mutually untrusted users at the operating-system boundary. Report suspected credential disclosure privately through Cenmax AI's official support channel, without live credentials or personal conversation content in a public issue.
