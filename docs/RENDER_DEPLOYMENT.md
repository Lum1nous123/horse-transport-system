# Render staging deployment

This guide deploys the Spring Boot backend as one shared Render staging service while each teammate runs the Next.js frontend locally. It does not authorize a deployment, a Git push, or changes to Stripe, Supabase, or Render.

## Deployment topology

- Render runs `backend/Dockerfile` as a public Docker Web Service.
- The container runs Java 21 as the non-root `spring` user.
- Spring binds to `0.0.0.0` and reads Render's dynamic `PORT` value.
- The frontend runs on each teammate's machine and calls the Render HTTPS URL.
- Stripe Sandbox sends signed webhook requests directly to Render. Stripe CLI is not required.
- PostgreSQL data remains in the separately managed Supabase project.

## Exact Render service settings

Create a **Web Service** from the Git repository with these settings after the deployment branch is approved:

| Setting | Value |
| --- | --- |
| Service name | `horse-transport-staging` |
| Branch | `main`, after the approved changes are merged |
| Root directory | `backend` |
| Runtime | `Docker` |
| Dockerfile path | `./Dockerfile` |
| Docker build context | `.` |
| Docker command | Leave empty; use the Dockerfile `ENTRYPOINT` |
| Health check path | `/api/v1/health` |
| Auto-deploy | Off for the first controlled deployment; enable later only by team decision |
| Region | The Render region closest to the Supabase project region |

Use an always-on paid Render instance when predictable webhook response latency is required. A Free web service can spin down after inactivity and take about a minute to wake, which makes it unsuitable for dependable shared staging webhook tests. See [Render Free service limitations](https://render.com/docs/free) and [Render Web Services](https://render.com/docs/web-services).

Do not set `SPRING_PROFILES_ACTIVE=local` on Render. The ignored local configuration is not a deployment source and is excluded from the Docker context.

## Render environment variables

Enter secrets directly in Render. Never commit their values.

Required for startup and database access:

```text
DB_HOST
DB_PORT
DB_NAME
DB_USERNAME
DB_PASSWORD
JWT_SECRET
```

Required for shared-local-frontend access and the complete Stripe Sandbox flow:

```text
CORS_ALLOWED_ORIGINS
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_CHECKOUT_SUCCESS_URL
STRIPE_CHECKOUT_CANCEL_URL
```

Required for document and proof image upload flows:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Recommended staging values for non-secret settings:

```text
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
STRIPE_CHECKOUT_SUCCESS_URL=http://localhost:3000/payment/success
STRIPE_CHECKOUT_CANCEL_URL=http://localhost:3000/payment/cancelled
DB_PORT=5432
DB_NAME=postgres
DB_MAX_POOL_SIZE=5
DB_MIN_IDLE=1
DB_CONNECTION_TIMEOUT_MS=30000
DB_IDLE_TIMEOUT_MS=600000
DB_MAX_LIFETIME_MS=1800000
JWT_EXPIRATION_MINUTES=60
DEPOSIT_REFUND_SCAN_INTERVAL_MS=30000
DOCUMENT_DEADLINE_SCAN_INTERVAL_MS=60000
```

Render supplies `PORT`; do not hard-code it in the dashboard. The application retains `8080` only as its local fallback.

`JWT_SECRET` should be a new high-entropy staging secret. Stripe variables must come from the Stripe test-mode account. Do not reuse production credentials.

## Supabase JDBC, IPv4, SSL, and HikariCP

The existing JDBC template is preserved:

```text
jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require
```

This keeps TLS mandatory and supplies the password separately, so no password URL-encoding is needed in the JDBC URL.

Render is listed by Supabase as an IPv4-only platform. Unless the Supabase project has the IPv4 add-on, use the **Shared Pooler / Session mode** values from Supabase Dashboard > **Connect**:

- `DB_HOST`: the exact `aws-...pooler.supabase.com` host shown by Supabase.
- `DB_PORT`: `5432` for session mode.
- `DB_USERNAME`: normally `postgres.<project-ref>` for the shared pooler; copy the exact value shown by Supabase.
- `DB_NAME`: normally `postgres`, or the existing approved database name.
- `DB_PASSWORD`: the existing database password.

Do not derive the pooler hostname or project reference manually. If the project has the IPv4 add-on, the existing direct `db.<project-ref>.supabase.co:5432` endpoint can remain in use.

Session mode is appropriate for this persistent Spring Boot/HikariCP service and supports prepared statements. Do not switch this application to the transaction pooler on port `6543` without a separate compatibility review. Supabase documents the relevant choices in [Connect to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) and its [Spring Boot quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/spring-boot).

Spring Boot selects HikariCP automatically through the JPA/JDBC dependencies. The staging default is bounded to five connections with one idle connection. For more than one Render instance, ensure:

```text
Render instance count × DB_MAX_POOL_SIZE
```

fits within the Supabase connection allowance, with capacity left for Flyway, the Supabase dashboard, and administrative connections. Adjust the pool only after checking the project's actual limits.

Flyway remains enabled and Hibernate remains in `validate` mode. Therefore, a real Render startup will validate the schema and apply pending migrations to the configured target. Before the first deployment, verify that all `DB_*` values point to the intended staging database and explicitly approve that startup. Do not use the current shared/demo database for an unapproved deployment rehearsal.

If Supabase Network Restrictions are enabled, add the outbound CIDR ranges shown under the Render service's **Connect > Outbound** panel. Do not guess individual IP addresses.

## Stripe Sandbox webhook setup

After the Render service is deployed and its URL is known:

1. Open Stripe Dashboard in **Test mode**.
2. Open **Developers / Workbench > Webhooks** and add an HTTPS event destination.
3. Use this endpoint URL:

   ```text
   https://<render-service>.onrender.com/api/v1/payments/stripe/webhook
   ```

4. Select events from **Your account** and subscribe to exactly:

   ```text
   checkout.session.completed
   checkout.session.expired
   payment_intent.payment_failed
   payment_intent.canceled
   refund.created
   refund.updated
   refund.failed
   ```

5. Reveal the endpoint's test-mode signing secret and store it in Render as `STRIPE_WEBHOOK_SECRET`.
6. Store the matching test secret API key as `STRIPE_SECRET_KEY`.
7. Redeploy or restart only after the intended environment values have been reviewed.

The endpoint is public at the HTTP authorization layer so Stripe can reach it, but every request must contain a valid `Stripe-Signature`. The backend verifies the signature against the raw request body before processing it.

The payment transition is driven only by the signed webhook. The frontend success redirect is informational and never confirms a payment. Stripe also recommends server-side fulfillment from webhooks rather than relying on the landing page; see [Stripe Checkout post-payment events](https://docs.stripe.com/payments/existing-customers?platform=web&ui=stripe-hosted).

Provider event IDs are persisted uniquely. Deposit and remaining-balance handlers recheck event identity while holding payment locks, and Stripe API calls use persisted idempotency keys. Keep these controls unchanged.

## Local frontend configuration

Each teammate creates `frontend/.env.local` locally:

```text
NEXT_PUBLIC_API_BASE_URL=https://<render-service>.onrender.com
```

Restart `next dev` after changing the file. Do not add a trailing slash and do not commit `.env.local`.

The browser origin remains local, so the backend allowlist must contain the exact scheme, hostname, and port used by the teammate. Add a specific origin to `CORS_ALLOWED_ORIGINS` when a different local port is needed; never use `*`.

## Post-deployment checks

These steps require separate approval because they touch deployed or external systems:

1. Confirm `GET https://<render-service>.onrender.com/api/v1/health` returns `200` and `{"status":"UP"}` without a JWT. This endpoint intentionally does not query the database.
2. Confirm an allowed `http://localhost:3000` frontend receives the expected CORS response and an unlisted origin does not.
3. Confirm application startup logs show successful Flyway validation and Hibernate schema validation against the intended staging database.
4. Use Stripe Dashboard's test delivery to validate endpoint reachability and signature handling. A generic test event without application metadata must not advance an Order.
5. For a full flow, create a real application Checkout Session and pay with a Stripe test card. Verify the signed `checkout.session.completed` webhook records the provider event and performs the existing state transition exactly once.
6. Retry the same Stripe event from the Dashboard and verify it is reported as a duplicate with no repeated state transition.
7. Verify deposit and remaining-balance status through authenticated backend reads. Do not treat the frontend redirect as evidence of payment.

No `render.yaml` is included. Dashboard configuration keeps the first staging deployment explicit and avoids committing a service plan, region, or auto-deploy policy before the team approves those operational choices.
