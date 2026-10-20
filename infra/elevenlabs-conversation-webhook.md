# ElevenLabs post-call webhook

Saves finished calls into the Amanit dashboard **Conversations** list.

## URL (use this in ElevenLabs)

```text
https://bxppcdpxki.us-east-2.awsapprunner.com/api/elevenlabs/webhook
```

When custom domain is active:

```text
https://api.amanitsitges.com/api/elevenlabs/webhook
```

Aliases (same handler):

- `/webhooks/conversations`
- `/webhooks/elevenlabs`
- `/webhooks/elevenlabs/conversations`
- `/api/elevenlabs` (via `/api` + `/elevenlabs`)

## Auth

The post-call webhook is public. No shared secret, signature header, or HMAC check.

## Body

Only `type: "post_call_transcription"` is ingested. Other types →  
`{ "success": true, "message": "Event type ignored" }`.

Required in `data`:

- `agent_id`
- `conversation_id`

Missing either → `400 { "error": "Missing required fields" }`.

## DB mapping (Conversation)

| ElevenLabs | Conversation field |
|------------|--------------------|
| `data.conversation_id` | `externalId` |
| `data.agent_id` | `agentId` |
| `analysis.transcript_summary` | `summary` (max 500) + full in `metadata.notes` |
| `metadata.start_time_unix_secs` | `startedAt` |
| `metadata.call_duration_secs` | `durationSeconds` / `endedAt` |
| `metadata.phone_call.external_number` | `callerPhone` |
| `metadata.main_language` | `language` |
| `transcript[]` | `transcript` text + `metadata.transcriptTurns` (tools included) |
| status | `resolved` |

Success:

```json
{ "success": true, "chatId": "<conversation.id>" }
```

## ElevenLabs setup

1. Workspace **Webhooks** → post-call / transcript
2. URL: canonical path above
3. Attach webhook to the Amanit agent

Docs: [Post-call webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks)
