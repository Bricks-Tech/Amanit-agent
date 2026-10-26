-- CreateTable
CREATE TABLE "ConversationAudio" (
    "conversationId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'audio/mpeg',
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationAudio_pkey" PRIMARY KEY ("conversationId")
);

-- AddForeignKey
ALTER TABLE "ConversationAudio" ADD CONSTRAINT "ConversationAudio_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
