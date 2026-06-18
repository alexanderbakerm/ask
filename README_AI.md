# AI Chatbot System

This template includes a built-in AI chatbot with a ChatGPT-like interface. Users can have conversations with an AI assistant, with chat history persisted per organization.

## Quick Setup

1. Add your OpenAI API key to `.env`:

```env
OPENAI_API_KEY=sk-...
```

2. That's it! The AI chat is available at `/dashboard/ai`.

## Architecture Overview

The AI system uses a **hybrid architecture**:

| Feature             | Technology    | Reason                           |
| ------------------- | ------------- | -------------------------------- |
| Streaming responses | API Route     | tRPC doesn't support streaming   |
| Chat CRUD           | tRPC          | Type-safe, cached queries        |
| State management    | Vercel AI SDK | `useChat` hook handles streaming |

### Why Not tRPC for Everything?

tRPC doesn't support streaming responses. The Vercel AI SDK's `streamText()` returns chunks as the LLM generates tokens, which requires raw HTTP streaming. tRPC's request/response model would break this.

## Tech Stack

- **[Vercel AI SDK](https://sdk.vercel.ai/)** - Core AI functionality
- **[OpenAI](https://platform.openai.com/)** - LLM provider (gpt-4o-mini)
- **[Streamdown](https://github.com/vercel/ai/tree/main/packages/streamdown)** - Markdown streaming renderer

## Database Schema

Chats are stored in the `ai_chat` table:

```typescript
aiChatTable = {
  id: uuid,
  organizationId: uuid, // Multi-tenant isolation
  userId: uuid, // Chat creator
  title: text, // Optional chat title
  messages: text, // JSON array of messages
  createdAt: timestamp,
  updatedAt: timestamp,
};
```

### Message Format

```typescript
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}
```

## How It Works

### 1. User Sends Message

```
User Input → updateChat (tRPC) → sendMessage (useChat) → API Route
```

### 2. AI Streams Response

```
API Route → streamText (OpenAI) → Token chunks → useChat → UI Update
```

### 3. Save on Complete

```
onFinish callback → Save to database → Invalidate cache
```

## Key Files

| File                                           | Purpose            |
| ---------------------------------------------- | ------------------ |
| `app/api/ai/chat/route.ts`                     | Streaming endpoint |
| `trpc/routers/organization/organization-ai.ts` | Chat CRUD          |
| `components/ai/ai-chat.tsx`                    | Main UI component  |
| `lib/db/schema/tables.ts`                      | Database schema    |

## API Reference

### Streaming Endpoint

**POST `/api/ai/chat`**

Request:

```json
{
  "messages": [{ "role": "user", "content": "Hello!" }],
  "chatId": "uuid",
  "organizationId": "uuid"
}
```

Response: Server-sent text stream

### tRPC Procedures

All under `trpc.organization.ai`:

| Procedure    | Description                   |
| ------------ | ----------------------------- |
| `listChats`  | List chats (paginated)        |
| `getChat`    | Get single chat with messages |
| `createChat` | Create new chat               |
| `updateChat` | Update title or messages      |
| `deleteChat` | Delete a chat                 |

## React Integration

### Using the Chat Component

```tsx
import { AiChat } from "@/components/ai/ai-chat";

export default function AiPage() {
  const { organization } = useActiveOrganization();

  return <AiChat organizationId={organization.id} />;
}
```

### Using useChat Hook Directly

```tsx
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";

const { messages, sendMessage, status } = useChat({
  transport: new TextStreamChatTransport({
    api: "/api/ai/chat",
    body: { chatId, organizationId },
  }),
});
```

## Customization

### Change the Model

Edit `app/api/ai/chat/route.ts`:

```typescript
// Use GPT-4o for better quality
const result = streamText({
  model: openai("gpt-4o"),
  messages,
});

// Or GPT-4 Turbo
const result = streamText({
  model: openai("gpt-4-turbo"),
  messages,
});
```

### Add a System Prompt

```typescript
const result = streamText({
  model: openai("gpt-4o-mini"),
  system: `You are a helpful CRM assistant for ${organizationName}. 
           Help users manage their leads, contacts and deals.`,
  messages,
});
```

### Switch to Claude (Anthropic)

1. Install the provider:

```bash
npm install @ai-sdk/anthropic
```

2. Add API key:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

3. Update the route:

```typescript
import { anthropic } from "@ai-sdk/anthropic";

const result = streamText({
  model: anthropic("claude-3-sonnet-20240229"),
  messages,
});
```

### Add Tool/Function Calling

```typescript
import { z } from "zod/v4";

const result = streamText({
  model: openai("gpt-4o-mini"),
  messages,
  tools: {
    searchLeads: {
      description: "Search for leads in the CRM",
      parameters: z.object({
        query: z.string().describe("Search query"),
        status: z.enum(["new", "contacted", "qualified"]).optional(),
      }),
      execute: async ({ query, status }) => {
        const leads = await db.query.leadTable.findMany({
          where: and(
            ilike(leadTable.name, `%${query}%`),
            status ? eq(leadTable.status, status) : undefined
          ),
          limit: 5,
        });
        return leads;
      },
    },
  },
});
```

### Customize the UI

The chat components are modular:

```tsx
import {
  Conversation,
  ConversationContent,
} from "@/components/ai/conversation";

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai/message";

import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai/prompt-input";
```

## Component Reference

### AiChat

Main chat interface with sidebar.

```tsx
<AiChat organizationId={string} />
```

Features:

- Collapsible sidebar with chat history
- URL-based chat selection (`?chatId=...`)
- Auto-creates chat if none exist
- Streaming status indicator

### Conversation

Scrollable message container with auto-scroll.

```tsx
<Conversation>
  <ConversationContent>
    {messages.map(msg => ...)}
  </ConversationContent>
  <ConversationScrollButton />
</Conversation>
```

### Message

Individual message display with role-based styling.

```tsx
<Message from="user">
  <MessageContent>Hello!</MessageContent>
</Message>

<Message from="assistant">
  <MessageContent>
    <MessageResponse>{markdownContent}</MessageResponse>
  </MessageContent>
</Message>
```

### PromptInput

Chat input form with submit handling.

```tsx
<PromptInput onSubmit={handleSubmit}>
  <PromptInputTextarea
    value={input}
    onValueChange={setInput}
    placeholder="Ask me anything..."
  />
  <PromptInputFooter>
    <PromptInputTools />
    <PromptInputSubmit status={chatStatus} />
  </PromptInputFooter>
</PromptInput>
```

## Security

1. **Authentication**: All endpoints require valid session
2. **Organization isolation**: Chats scoped to organization
3. **Ownership verification**: API verifies chat belongs to org
4. **Input validation**: Max message length (100k chars)
5. **Cascade deletes**: Chats auto-deleted with org/user

## Limits

| Limit                 | Value              |
| --------------------- | ------------------ |
| Max message length    | 100,000 characters |
| Max messages per chat | 1,000              |
| Max title length      | 200 characters     |
| Request timeout       | 30 seconds         |

## Cost Considerations

- **gpt-4o-mini**: ~$0.15/1M input tokens, ~$0.60/1M output tokens
- **gpt-4o**: ~$2.50/1M input tokens, ~$10/1M output tokens

Consider implementing:

- Per-user rate limits
- Token counting and budgets
- Usage analytics

## Troubleshooting

### "Unauthorized" Error

Ensure user is logged in and has valid session.

### "Chat not found" Error

Chat may have been deleted or user switched organizations.

### Slow Responses

- Check OpenAI API status
- Consider using a faster model
- Reduce `maxDuration` if needed

### Messages Not Saving

Check database connection and `onFinish` callback logs.
