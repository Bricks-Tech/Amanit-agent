const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export type Conversation = {
  id: string;
  externalId?: string | null;
  agentId?: string | null;
  callerName?: string | null;
  callerPhone?: string | null;
  tableLabel?: string | null;
  language?: string | null;
  summary?: string | null;
  transcript?: string | null;
  status: string;
  durationSeconds?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
  metadata?: unknown;
  createdAt: string;
  orders?: Array<{
    id: string;
    status: string;
    totalCents: number;
    externalId?: string | null;
    items?: OrderItem[] | unknown;
    notes?: string | null;
  }>;
};

export type OrderItem = {
  name: string;
  quantity: number;
  priceCents: number;
};

export type Order = {
  id: string;
  externalId?: string | null;
  conversationId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  tableLabel?: string | null;
  language?: string | null;
  items: OrderItem[];
  notes?: string | null;
  totalCents: number;
  status: string;
  createdAt: string;
  conversation?: {
    id: string;
    externalId?: string | null;
    summary?: string | null;
    callerName?: string | null;
    tableLabel?: string | null;
  } | null;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export function loginRequest(email: string, password: string) {
  return request<{ token: string; user: { id: string; email: string; name?: string | null } }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  );
}

export function fetchConversations(token: string) {
  return request<{ conversations: Conversation[] }>("/conversations", {}, token);
}

export function fetchConversation(token: string, id: string) {
  return request<{ conversation: Conversation }>(`/conversations/${id}`, {}, token);
}

export async function fetchConversationAudio(token: string, id: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/conversations/${id}/audio`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error("Recording not available");
  }
  return response.blob();
}

export function fetchOrders(token: string) {
  return request<{ orders: Order[] }>("/orders", {}, token);
}

export function updateOrderStatus(token: string, id: string, status: string) {
  return request<{ order: Order }>(
    `/orders/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
    token
  );
}
