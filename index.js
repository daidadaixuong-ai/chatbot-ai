const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CONFIG =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = "1488145225770860605";

// ===== DATA =====
let statusData = {
  singapore: false,
  hongkong: false,
  japan: false,
  germany: false,
  america: false,
  uptime: "unknown",
  lastUpdate: null
};

// ===== PARSE CHUẨN =====
function parseContent(content) {
  const lines = content.split("\n");

  lines.forEach(line => {
    line = line.trim();

    if (line.includes("Singapore")) {
      statusData.singapore = line.includes("🟢");
    }

    if (line.includes("Hong Kong")) {
      statusData.hongkong = line.includes("🟢");
    }

    if (line.includes("Japan")) {
      statusData.japan = line.includes("🟢");
    }

    if (line.includes("Germany")) {
      statusData.germany = line.includes("🟢");
    }

    if (line.includes("America")) {
      statusData.america = line.includes("🟢");
    }

    if (line.includes("Uptime:")) {
      statusData.uptime = line.replace("Uptime:", "").trim();
    }
  });

  statusData.lastUpdate = new Date().toISOString();
  console.log("UPDATED:", statusData);
}

// ===== DISCORD BOT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// BOT READY
client.on("ready", async () => {
  console.log("Bot online:", client.user.tag);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);

    // 👉 Lấy message mới nhất khi restart
    const messages = await channel.messages.fetch({ limit: 1 });

    messages.forEach(msg => {
      parseContent(msg.content);
    });

  } catch (err) {
    console.log("Fetch error:", err);
  }
});

// NGHE MESSAGE MỚI
client.on("messageCreate", (message) => {
  if (message.channel.id !== CHANNEL_ID) return;

  parseContent(message.content);
});

// START BOT
client.login(BOT_TOKEN);

// ===== API =====

// test nhanh
app.get("/", (req, res) => {
  res.send("API UGPhone RUNNING");
});

// API chính (tối ưu tốc độ)
app.get("/status", (req, res) => {
  res.set("Cache-Control", "no-store"); // 🚀 không cache
  res.json(statusData);
});

// start server
app.listen(PORT, () => {
  console.log("Server chạy port", PORT);
});
