# BLACK ORACLE Web Revision Trigger — 2026-09-15

Purpose: force a fresh GitHub source event for `black-oracle-web` after verifying that Railway `redeploy` reuses the previous `c411ecaa...` snapshot even though the service source tracks `main`.

Expected authoritative source before this marker: `909982a58c6d2ff1c4a18f64fb7a4086809b0dd4`.

This marker changes no application, trading, risk, Council, Router, qualification, portfolio, ledger, schema, credential, or execution semantics. It exists solely to make Railway fetch a fresh GitHub revision rather than reusing a stale deployment snapshot.

Release acceptance requires the Railway deployment metadata to identify the post-merge `main` SHA exactly. A successful deployment of an older SHA does not satisfy runtime truth.
