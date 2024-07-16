require("dotenv").config();
const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";

let connection;
let channel;

async function startConnection() {
  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue("status_queue", { durable: true });
  await channel.assertQueue("warning_queue", { durable: true });
  return channel;
}

async function consume() {
  await startConnection();
  channel.prefetch(1);
  console.log(
    " [*] Waiting for messages in status_queue. To exit press CTRL+C"
  );
  channel.consume("status_queue", async (msg) => {
    if (msg !== null) {
      const status = JSON.parse(msg.content.toString());
      console.log(" [x] Received '%s'", JSON.stringify(status));
      // Simulate status validation
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log(" [x] Validated status from: %s", status.server);
      // Forward to the next stage
      channel.sendToQueue(
        "warning_queue",
        Buffer.from(JSON.stringify(status)),
        { persistent: true }
      );
      channel.ack(msg);
    }
  });
}

consume().catch(console.error);
