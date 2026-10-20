# ElevenLabs tool: Place-Order

Ready-to-paste config: [elevenlabs-place-order-tool.json](./elevenlabs-place-order-tool.json)

## Endpoint

```http
POST https://bxppcdpxki.us-east-2.awsapprunner.com/tools/create-order
Content-Type: application/json
x-webhook-secret: 310a0bb02c65be18d037f4caf1a91ce5
```

## Body fields (from your tool)

| Field | Required | Notes |
|-------|----------|--------|
| `items` | yes | Array of `{ name, quantity, price_euros }` |
| `instructions` | yes | Special requests / allergies (stored as order notes) |
| `table` | no | Number only, e.g. `7` (UI shows `Table 7`) |

**Do not** put `conversation_id` in the tool body. ElevenLabs sends it on the webhook envelope (`conversation_id` / `parameters`), and the API reads it from there.

## What the API stores

- Order in RDS as `PENDING`
- `items` text → order line item(s)
- `instructions` → `notes` column
- Links to conversation when ElevenLabs includes `conversation_id`

## Example payload ElevenLabs may send

```json
{
  "tool_call_id": "call_abc",
  "tool_name": "Place-Order",
  "conversation_id": "conv_xyz",
  "parameters": {
    "items": [
      { "name": "Paella de marisco", "quantity": 1, "price_euros": 22 },
      { "name": "Caña", "quantity": 2, "price_euros": 3.5 }
    ],
    "instructions": "no onions",
    "table": 7
  }
}
```
