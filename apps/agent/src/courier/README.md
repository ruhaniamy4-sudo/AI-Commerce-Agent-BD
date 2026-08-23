# Courier runtime notes

Milestone 5 implements the generic `CourierProvider` boundary and the Steadfast adapter only.

## Credential storage

Tenant API keys and secret keys are encrypted with AES-256-GCM before MongoDB storage. The agent runtime must receive a deployment-managed `COURIER_CREDENTIALS_ENCRYPTION_KEY` containing at least 32 characters. The key must come from the production secret manager, must not be committed, and must remain stable across deployments so existing tenant credentials remain decryptable. Key rotation and managed per-record key wrapping are recommended production hardening work.

Credential documents are tenant-scoped, the encrypted field is excluded from ordinary queries, and dashboard/API serializers return connection metadata only.

## Shipment lifecycle

Delivery creation is an explicit action for `confirmed` or `packed` orders. The order number is sent as Steadfast's unique invoice reference. An atomic creation claim prevents concurrent requests, while `uncertain` blocks repeat creation after a timeout where Steadfast may have accepted the request. Manual status sync can reconcile that invoice without risking a second parcel.

Steadfast status is stored separately from commerce order status. Only a provider-confirmed `delivered` status advances the commerce order to `delivered`; all other courier states remain independent.

## Background sync

The existing BullMQ worker supports `sync-courier-status` jobs with three exponential-backoff attempts for transient read failures. Authentication, validation, and not-found failures complete without endless retry. No aggressive schedule is installed. Deployment may enqueue these jobs from a conservative scheduler using `enqueueCourierStatusSync`, while manual sync remains available immediately.

Live MongoDB, Redis, and Steadfast credential verification must be completed in the deployed runtime.
