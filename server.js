require("dotenv").config();
const amqp = require("amqplib");
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const cors = require("cors");

// Singleton pattern for RabbitMQ connection and channel
let rabbitConnection = null;
let rabbitChannel = null;
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";
const SERVER_PORT = process.env.SERVER_PORT || 3000;

async function startRabbitConnection() {
  try {
    rabbitConnection = await amqp.connect(RABBITMQ_URL);
    rabbitChannel = await rabbitConnection.createChannel();
    await rabbitChannel.assertQueue("status_queue", { durable: true });
    console.log("RabbitMQ connected and channel created");
  } catch (error) {
    console.error("Failed to connect to RabbitMQ", error);
    setTimeout(startRabbitConnection, 5000); // Retry connection after 5 seconds
  }
}

startRabbitConnection().catch(console.error);

app.use(express.static("public"));
app.use(express.json());
app.use(cors());


io.on("connection", (socket) => {
  console.log("New client connected");
  rabbitChannel.consume("alert_queue", (msg) => {
    if (msg !== null) {
      console.log(" [x] Received '%s'", msg.content.toString());
      const data = JSON.parse(msg.content.toString());
      socket.emit("status_update", data);
      rabbitChannel.ack(msg);
    }
  });
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

app.post("/status", async (req, res) => {
  const status = { ...req.body, timestamp: new Date().toISOString() };
  try {
    await rabbitChannel.sendToQueue(
      "status_queue",
      Buffer.from(JSON.stringify(status)),
      { persistent: true }
    );
    console.log(" [x] Sent '%s'", JSON.stringify(status));
    res.status(200).send("Status received");
  } catch (error) {
    console.error("Error sending message to RabbitMQ", error);
    res.status(500).send("Failed to send status");
  }
});

server.listen(SERVER_PORT, () =>
  console.log(`Server running on port ${SERVER_PORT}`)
);
