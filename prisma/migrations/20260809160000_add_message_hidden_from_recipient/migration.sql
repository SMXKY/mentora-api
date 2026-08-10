-- Silent-block support: a message sent to someone who has blocked the
-- sender is still persisted (so the sender's own devices see it as sent),
-- but must never be visible to the recipient.
ALTER TABLE "messages" ADD COLUMN "hidden_from_recipient" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "idx_messages_conv_hidden" ON "messages"("conversation_id", "hidden_from_recipient");
