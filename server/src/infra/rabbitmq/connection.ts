import amqp, { type ChannelWrapper } from "amqp-connection-manager";
import type { ConfirmChannel } from "amqplib";
import { env } from "../../config/env.ts";
import { logger } from "../../config/logger.ts";

export const QUEUES = {
  REPOSITORY_SYNC: "repository.sync",
  WEBHOOK_PROCESS: "webhook.process",
  REPOSITORY_INDEX: "repository.index",
  REPOSITORY_ANALYZE: "repository.analyze",
  TASK_EXECUTE: "task.execute",
} as const;

const DEAD_LETTER_EXCHANGE = "dlx";

export function deadLetterQueueName(queue: string): string {
  return `${queue}.dead-letter`;
}

const connection = amqp.connect([env.RABBITMQ_URL]);

connection.on("connect", () => logger.info("RabbitMQ connected"));
connection.on("disconnect", (params) => logger.error({ err: params.err }, "RabbitMQ disconnected"));

export const channelWrapper: ChannelWrapper = connection.createChannel({
  json: true,
  setup: async (channel: ConfirmChannel) => {
    await channel.assertExchange(DEAD_LETTER_EXCHANGE, "direct", { durable: true });

    for (const queue of Object.values(QUEUES)) {
      const deadLetterQueue = deadLetterQueueName(queue);
      await channel.assertQueue(deadLetterQueue, { durable: true });
      await channel.bindQueue(deadLetterQueue, DEAD_LETTER_EXCHANGE, queue);

      await channel.assertQueue(queue, {
        durable: true,
        deadLetterExchange: DEAD_LETTER_EXCHANGE,
        deadLetterRoutingKey: queue,
      });
    }
  },
});
