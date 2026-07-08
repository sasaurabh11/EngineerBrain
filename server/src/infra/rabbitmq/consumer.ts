import type { ConfirmChannel, ConsumeMessage } from "amqplib";
import { logger } from "../../config/logger.ts";
import { channelWrapper } from "./connection.ts";

const MAX_ATTEMPTS = 3;

export function consumeQueue<T>(queue: string, handler: (payload: T) => Promise<void>): void {
  channelWrapper.addSetup(async (channel: ConfirmChannel) => {
    await channel.consume(queue, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      const attempts = (msg.properties.headers?.["x-attempts"] as number | undefined) ?? 0;
      const payload = JSON.parse(msg.content.toString()) as T;

      try {
        await handler(payload);
        channelWrapper.ack(msg);
      } catch (err) {
        logger.error({ err, queue, attempts: attempts + 1 }, "Failed to process queue message");

        if (attempts + 1 >= MAX_ATTEMPTS) {
          channelWrapper.nack(msg, false, false);
          return;
        }

        channelWrapper.ack(msg);
        await channelWrapper.sendToQueue(queue, payload, {
          persistent: true,
          headers: { "x-attempts": attempts + 1 },
        });
      }
    });
  });
}
