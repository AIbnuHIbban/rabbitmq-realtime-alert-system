require("dotenv").config();
const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";

let connection;
let channel;

async function startConnection() {
  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue("warning_queue", { durable: true });
  await channel.assertQueue("alert_queue", { durable: true });
  return channel;
}

async function consume() {
  await startConnection();
  channel.prefetch(1);
  console.log(
    " [*] Waiting for messages in warning_queue. To exit press CTRL+C"
  );
  channel.consume("warning_queue", async (msg) => {
    if (msg !== null) {
      const status = JSON.parse(msg.content.toString());
      console.log(" [x] Received '%s'", JSON.stringify(status));
      // Simulate anomaly detection
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (status.cpu > 80) {
        console.log(" [x] Detected high CPU usage on: %s", status.server);
        // Forward to the next stage
        channel.sendToQueue(
          "alert_queue",
          Buffer.from(JSON.stringify(status)),
          { persistent: true }
        );
      } else {
        console.log(" [x] No anomalies detected on: %s", status.server);
      }
      channel.ack(msg);
    }
  });
}

consume().catch(console.error);
