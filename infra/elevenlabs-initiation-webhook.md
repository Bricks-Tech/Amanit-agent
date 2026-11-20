# ElevenLabs initiation data webhook

Returns `conversation_initiation_client_data` so inbound phone / WhatsApp / SMS calls start with a language (Spanish or English) and required dynamic variables.

This does **not** run for the website widget. The widget passes the same fields client-side.

## URL (paste in ElevenLabs)

```text
https://bxppcdpxki.us-east-2.awsapprunner.com/api/elevenlabs/initiation
```

Alias:

```text
https://bxppcdpxki.us-east-2.awsapprunner.com/api/elevenlabs/conversation-initiation
```

## Request headers (in ElevenLabs webhook settings)

| Header | Value |
|--------|--------|
| `x-webhook-secret` | Same as App Runner `WEBHOOK_SECRET` (use an ElevenLabs secret / `{{…}}`) |

## ElevenLabs UI steps

1. Agents → Settings → initiation / personalization webhook → set the URL above.
2. Add the `x-webhook-secret` header.
3. Open the agent → **Security**:
   - Enable **Fetch initiation client data from a webhook**
   - Enable **Language** override (required for `conversation_config_override.agent.language`)
   - Enable **First message** override (required for Sophie’s welcome line)
4. Ensure the agent defines dynamic variables used by tools/prompts, at least `table_number` (and `language` / `user_language` / `welcome_message` if referenced in the prompt).

## Response shape

```json
{
  "type": "conversation_initiation_client_data",
  "conversation_config_override": {
    "agent": {
      "language": "es",
      "first_message": "Hola, me llamo Sophie y hoy tomaré su pedido. Avíseme cuando esté listo o si tiene alguna pregunta sobre el menú."
    }
  },
  "dynamic_variables": {
    "table_number": "0",
    "language": "Spanish",
    "user_language": "Spanish",
    "welcome_message": "Hola, me llamo Sophie y hoy tomaré su pedido. Avíseme cuando esté listo o si tiene alguna pregunta sobre el menú.",
    "caller_id": "+34…",
    "called_number": "+34…"
  }
}
```

`language` codes: `es` (Spanish) or `en` (English).

Welcome / first message:

- English: `Hi, my name is Sophie and I will be taking your order today. Let me know when you're ready or have any questions about the menu.`
- Spanish: `Hola, me llamo Sophie y hoy tomaré su pedido. Avíseme cuando esté listo o si tiene alguna pregunta sobre el menú.`

## How language is chosen

1. Request body `language` / `preferred_language` if present  
2. Else last saved conversation language for `caller_id`  
3. Else `ELEVENLABS_DEFAULT_LANGUAGE` on App Runner (default `es`)

## App Runner env

```bash
ELEVENLABS_DEFAULT_LANGUAGE=es
WEBHOOK_SECRET=…
```
