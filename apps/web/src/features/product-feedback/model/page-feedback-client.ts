import {
  feedbackCreateWireSchema,
  type FeedbackResponse,
  feedbackResponseSchema,
  type FeedbackType,
  normalizeFeedbackPath,
} from "@customreport/shared";

const PAGE_FEEDBACK_ENDPOINT = "/api/siteping";
const MAX_USER_AGENT_LENGTH = 500;

export interface PageFeedbackDraft {
  readonly type: FeedbackType;
  readonly message: string;
}

export interface PageFeedbackIdentity {
  readonly name: string;
  readonly email: string;
}

interface PageFeedbackBrowserContext {
  readonly href: string;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly userAgent: string;
  readonly createClientId: () => string;
}

function currentBrowserContext(): PageFeedbackBrowserContext {
  return {
    href: window.location.href,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    userAgent: navigator.userAgent,
    createClientId: () => `page_${crypto.randomUUID()}`,
  };
}

export function buildPageFeedbackPayload(
  draft: PageFeedbackDraft,
  identity: PageFeedbackIdentity,
  context: PageFeedbackBrowserContext,
) {
  return feedbackCreateWireSchema.parse({
    projectName: "weekly-report",
    type: draft.type,
    message: draft.message,
    url: normalizeFeedbackPath(context.href),
    urlPattern: null,
    viewport: `${context.viewportWidth}x${context.viewportHeight}`,
    userAgent: context.userAgent.slice(0, MAX_USER_AGENT_LENGTH) || "unknown",
    authorName: identity.name,
    authorEmail: identity.email,
    annotations: [],
    clientId: context.createClientId(),
  });
}

export async function submitPageFeedback(
  draft: PageFeedbackDraft,
  identity: PageFeedbackIdentity,
): Promise<FeedbackResponse> {
  const payload = buildPageFeedbackPayload(
    draft,
    identity,
    currentBrowserContext(),
  );
  const response = await fetch(PAGE_FEEDBACK_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Page feedback submission failed (${response.status}).`);
  }
  return feedbackResponseSchema.parse(await response.json());
}
