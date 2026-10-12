import { FEEDBACK_ENDPOINT } from "@/providers/community/feedback";

export interface CommunityPost {
  id: string;
  createdAt: number;
  body?: string;
  rating?: number;
  suggestion?: string | null;
  bugReport?: string | null;
  authorEmail?: string | null;
  isPublic?: boolean;
  isOwner?: boolean;
  upvotes?: number;
  hasUpvoted?: boolean;
}
export interface PostPage {
  items: CommunityPost[];
  nextCursor: string | null;
}
export class CommentError extends Error {
  constructor(readonly status: number) {
    super(`Comment failed: ${status}`);
  }
}
export function communityUrl(characterId?: string): URL {
  const url = new URL(FEEDBACK_ENDPOINT);
  if (characterId)
    url.pathname = `/api/community/v1/characters/${encodeURIComponent(characterId)}/comments`;
  url.search = "";
  url.searchParams.set("game", "HSR");
  return url;
}
export async function fetchPosts(
  characterId: string | undefined,
  cursor: string | null,
  signal: AbortSignal,
  getToken?: () => Promise<string>
): Promise<PostPage> {
  const url = communityUrl(characterId);
  if (cursor) url.searchParams.set("cursor", cursor);
  const headers: Record<string, string> = {};
  if (!characterId && getToken) {
    const token = await getToken();
    if (!token) throw new CommentError(401);
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url.href, {
    credentials: "omit",
    signal,
    ...(getToken && !characterId ? { headers } : {}),
  });
  if (!response.ok) throw new CommentError(response.status);
  return response.json();
}
export async function updateFeedbackPost(
  id: string,
  action: "visibility" | "vote",
  enabled: boolean,
  getToken: () => Promise<string>
): Promise<CommunityPost> {
  const token = await getToken();
  if (!token) throw new CommentError(401);
  const url = new URL(FEEDBACK_ENDPOINT);
  url.pathname += `/${encodeURIComponent(id)}/${action}`;
  const response = await fetch(url.href, {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(
      action === "visibility" ? { public: enabled } : { voted: enabled }
    ),
  });
  if (!response.ok) throw new CommentError(response.status);
  return response.json();
}

export async function submitComment(
  characterId: string,
  body: string,
  getToken: () => Promise<string>
): Promise<void> {
  let token: string;
  try {
    token = await getToken();
  } catch {
    throw new CommentError(401);
  }
  if (!token) throw new CommentError(401);
  const response = await fetch(communityUrl(characterId).href, {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ body: body.trim() }),
  });
  if (!response.ok) throw new CommentError(response.status);
}
