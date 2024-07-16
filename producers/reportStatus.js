require("dotenv").config();
const amqp = require("amqplib");

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";

let connection;
let channel;

async function startConnection() {
  if (!connection) {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue("status_queue", { durable: true });
  }
  return channel;
}

async function reportStatus(status) {
  try {
    await startConnection();
    status.timestamp = new Date().toISOString(); // Ensure timestamp is always fresh
    await channel.sendToQueue(
      "status_queue",
      Buffer.from(JSON.stringify(status)),
      { persistent: true }
    );
    console.log(" [x] Sent '%s'", JSON.stringify(status));
  } catch (error) {
    console.error("Failed to send status to RabbitMQ", error);
    // Handle reconnection in case of failure
    connection = null; // Reset connection
    setTimeout(() => reportStatus(status), 1000); // Retry after a delay
  }
}

// Sample status report
const sampleStatus = {
  server: "Server-1",
  cpu: 90, // CPU usage percentage
  memory: 50, // Memory usage percentage
  disk: 75, // Disk usage percentage
};

// Simulate status report every 5 seconds
setInterval(() => {
  reportStatus(sampleStatus);
}, 5000);
