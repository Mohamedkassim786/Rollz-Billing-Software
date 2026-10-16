# ROLLZ POS — Security and Reliability

## Local network model
- Treat the local network as trusted only after configuring it; other devices on Wi-Fi may not automatically be trusted.
- Bind to localhost for the single-computer-only development setup.
- When LAN clients are introduced, bind the application deliberately to the LAN interface and configure Windows Firewall to allow only the required private network.
- Never expose the application or PostgreSQL directly to the public internet.
- PostgreSQL should normally accept connections from the application server only.

## Secrets
- Keep database credentials and signing secrets in `.env`.
- Add `.env` to `.gitignore`.
- Commit `.env.example` with placeholders only.
- Use a long, cryptographically random secret.
- Do not print secrets in logs or error messages.

## Authentication
- Hash passwords using a suitable password-hashing algorithm/library.
- Use secure session/token handling, expiry, and logout behavior.
- Protect every private API endpoint.
- Enforce permissions on the backend.
- Rate-limit login attempts where practical.
- Do not ship default credentials.

## Financial correctness
- Use safe decimal or integer-paise arithmetic.
- Recalculate prices and tax on the server.
- Use database transactions for finalization.
- Prevent duplicate payment submission/finalization.
- Log voids, refunds, discounts, and reprints.
- Preserve finalized invoice snapshots.
- Do not equate total sales with profit.

## Printing reliability
- Persist print jobs in the database.
- Dispatch printing after the payment/finalization transaction commits.
- Track pending, printing, printed, and failed states.
- Display printer errors and allow controlled retries.
- Mark duplicate/reprinted tickets.
- Do not let printer failure undo a valid paid order.

## Backups
- Create automated PostgreSQL backups.
- Copy backups to separate storage, not only the same disk.
- Define a retention policy.
- Test restoration regularly.
- Backups are not complete until a restore has been tested.
- Never run a destructive reset command against production data.

## Error handling and logs
- Return safe, consistent API errors.
- Keep detailed diagnostics in local logs without passwords/tokens.
- Make recoverable failures clear to the cashier.
- Handle app/server restarts and printer disconnects.
- Test internet outage separately from local network/server failure.
