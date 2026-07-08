import { channelWrapper } from "./connection.ts";

export async function publishToQueue(queue: string, message: unknown): Promise<void> {
  await channelWrapper.sendToQueue(queue, message, { persistent: true });
}
