# NotificationService

## Why this exists

Every module that needs to tell a user something — a booking was accepted, a payout landed, a dispute was opened — used to be free to call Resend or FCM directly. That's how you end up with inconsistent templates, notifications that only reach one channel by accident, and no single place to see what actually got sent. `NotificationService` is now the only way any part of the codebase sends a notification. No module calls Resend, FCM, or the WhatsApp Cloud API directly.

## The core idea: every applicable channel fires, not just one

This is the part that differs from a simpler "pick the best channel" approach. Each notification type has a **default channel profile** — a fixed set of which of in-app, email, push, and WhatsApp it goes out on. When `booking.accepted` fires, it doesn't ask "is this user online right now, use that channel" — it asks "what does this type call for," and fires all of them in parallel: in-app write, push, email, and WhatsApp (if the user opted in), independently, each with its own success/failure tracked. A failed email never stops the WhatsApp message from going out, and vice versa.

The one exception to the parallel-everything rule is WhatsApp itself, which only ever fires for users who've explicitly opted in — that's a hard gate checked before the channel is even attempted, never a preference toggle a user can turn on without going through the opt-in flow.

## How it's built

**`notification.types.ts`** is the registry — the single source of truth for what a notification type means. Every `NotificationType` from the Prisma enum has an entry here: which i18n keys resolve its title and body, whether it's transactional (and therefore ignores user preferences entirely), and its default channel profile. `NotificationService.send()` throws immediately if a type isn't in this registry — that's the runtime equivalent of the CI check the SRS calls for.

**`notification.service.ts`** is the entry point. `send()` resolves the target (a single user, a list of users, everyone with a role, everyone with a permission, or literally everyone), writes one `Notification` row per recipient synchronously — this write always happens regardless of what external channels do — then queues the async delivery work and returns immediately. Target resolution for roles and permissions mirrors your RBAC tables directly: role membership through `UserRole`, permission access through `RolePermission` plus active `PermissionOverride` grants minus active revocations.

**`notification.dispatcher.ts`** is where the "fire every applicable channel" logic actually lives. For a given notification, it works out which channels apply by combining the type's default profile, whether the type is transactional (bypasses preferences), the user's per-type per-channel `NotificationPreference` rows, the global mute-all toggle, and — for WhatsApp specifically — whether the user has opted in at all. It then fires every resulting channel in parallel and writes a `NotificationDelivery` row per channel per attempt, so you always have a record of what was tried and what happened.

**`notification.queue.ts`** wraps the dispatcher in a BullMQ job. This is what makes channel delivery genuinely non-blocking — the in-app write already happened synchronously in `send()`, so by the time this job runs, the user already has something to see even if every external channel fails. Failed jobs retry three times with exponential backoff (5s, 10s, 20s), matching the SRS's retry requirement.

**`channels/`** holds one file per external channel, each with the same shape — take a `Notification`, return `true`/`false`, never throw past the dispatcher:

- `email.channel.ts` resolves the recipient's locale, pulls the translated subject/body through your existing i18n helper, and hands it to your existing `sendEmail` function and template format.
- `whatsapp.channel.ts` sends through the Cloud API using pre-approved Meta templates (named `mentora_<type>` by convention), handles the opt-in confirmation message, and includes the webhook signature verification and STOP-reply handling Meta requires. The STOP flow needs no manual intervention — a reply of "STOP" flips `whatsappOptIn` to false the moment the webhook fires.
- `push.channel.ts` sends via Firebase Cloud Messaging to every active device token a user has, and automatically deactivates any token FCM reports as no-longer-registered.
- `sms.channel.ts` is a dead stub exactly as the SRS specifies — it logs the intended message and returns success without calling anything external. It exists purely so the channel interface is uniform; when SMS gets funded, only this one file's body needs to change, nothing that calls it does.

**`notification.optin.ts`** is the WhatsApp opt-in flow itself — validates the Cameroonian phone format, saves the number, flips opt-in on, timestamps consent (your proof for a Meta audit), and fires the confirmation message. The opt-in/opt-out fields already exist on your `User` model (`whatsappNumber`, `whatsappOptIn`, `whatsappOptInAt`), so no schema migration was needed here.

**`notification.socket.ts`** handles the real-time side — syncing missed notifications on reconnect, live unread count updates, and marking things read from the socket layer, all scoped to the authenticated user's own socket.

**`notification.webhook.route.ts`** is the Express route Meta calls — the `GET` handles their one-time verification handshake, and the `POST` validates the `X-Hub-Signature-256` header before touching the payload at all, so nothing gets processed unless it genuinely came from Meta.

## How to use it

Sending a notification is always the same call, regardless of type:

```ts
await NotificationService.send({
  type: "BOOKING_ACCEPTED",
  target: { kind: "user", userId: parent.id },
  data: { tutorName: tutor.firstName, sessionDate: booking.sessionDate },
});
```

You never specify channels — the registry already knows `BOOKING_ACCEPTED` goes out on in-app, email, push, and WhatsApp. If you ever need to target a group instead of one user:

```ts
await NotificationService.send({
  type: "KYC_ESCALATED_TO_SUPER_ADMIN",
  target: { kind: "role", roleId: superAdminRole.id },
  data: { applicationId: kyc.id },
});
```

Reading notifications back for a user's bell icon:

```ts
const { notifications, unreadCount, hasMore, cursor } =
  await NotificationService.getForUser(userId, { cursor: lastCursor });
```

Marking read is just `NotificationService.markAsRead(notificationId, userId)` or `markAllAsRead(userId)`.

For WhatsApp opt-in, call it directly from your account-completion onboarding flow once the user confirms their number:

```ts
await optInToWhatsapp(userId, "+237675644383");
```

## What you need to wire in before this runs

Three files reference things that live outside this module and weren't shown to me directly, so double-check the import paths match your actual project structure: `../../utils/email.util` for your existing `sendEmail` function, and `../../shared/i18n/resolveTranslation` for however your i18n module actually exposes a "give me this key in this locale with these variables" function — if that helper has a different name or signature, the three channel files that call it will need a one-line adjustment.

You'll also need to register the WhatsApp webhook route in `app.ts`, and — importantly — make sure the raw request body is available for signature verification on that specific path before Express's JSON body parser transforms it, since Meta signs the raw bytes, not the parsed object.

Every notification type needs a Meta-approved WhatsApp template before it can actually deliver over that channel — that's a pre-launch task, not a code task, and it's already on your Appendix E checklist.
