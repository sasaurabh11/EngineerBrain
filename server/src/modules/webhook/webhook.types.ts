export interface WebhookProcessPayload {
  webhookEventId: string;
}

export interface GitHubWebhookHeaders {
  eventType: string;
  deliveryId: string;
  signature: string;
}
