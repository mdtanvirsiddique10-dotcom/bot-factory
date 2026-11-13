const express = require('express');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const qrcode = require('qrcode');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

let allBots = {};
let mongoConnected = false;

async function connectMongo() {
  if (mongoConnected) return;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    mongoConnected = true;
    console.log("MongoDB Connected - Login Mone Thakbe!");
  } catch (e) {
    console.log("Mongo Error:", e.message);
  }
}

app.get('/', (req, res) => {
  res.send(`<h2>🤖 Bot Factory - Login Mone Thakbe!</h2>
  <form action="/create-bot" method="POST">
  ক্লায়েন্টের নম্বর (8801...): <input name="clientNumber" required><br><br>
  ব্যবসার নাম: <input name="businessName" required><br><br>
  ব্যবসার তথ্য: <textarea name="businessInfo"></textarea><br><br>
  <button type="submit">বট বানাও</button></form>`);
});

app.post('/create-bot', async (req, res) => {
  const { clientNumber, businessName, businessInfo } = req.body;
  await connectMongo();
  const store = new MongoStore({ mongoose: mongoose });

  const client = new Client({
    authStrategy: new RemoteAuth({
      clientId: clientNumber,
      store: store,
      backupSyncIntervalMs: 300000
    }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
  });

  client.on('qr', async (qr) => {
    const qrImage = await qrcode.toDataURL(qr);
    allBots[clientNumber] = { qrImage, status: "QR আসছে - স্ক্যান করো" };
    console.log("QR for", clientNumber);
  });

  client.on('ready', () => {
    if (!allBots[clientNumber]) allBots[clientNumber] = {};
    allBots[clientNumber].status = "✅ চালু! আর QR লাগবে না";
    console.log("Bot Ready:", clientNumber);
  });

  client.on('remote_session_saved', () => {
    console.log("Login Save Hoye Geche!", clientNumber);
  });

  client.on('message', async msg => {
    if (msg.from === 'status@broadcast') return;
    try {
      const prompt = `তুমি ${businessName} এর সেলসম্যান। তথ্য: ${businessInfo}। বাংলায় বন্ধুর মতো জবাব দাও, বলবা না তুমি AI। কাস্টমার: "${msg.body}"`;
      const result = await model.generateContent(prompt);
      msg.reply(result.response.text());
    } catch (e) {
      console.log("AI Error", e.message);
    }
  });

  client.initialize();
  res.send(`<h2>বট বানানো শুরু!</h2><p>১বার QR স্ক্যান করলেই সারাজীবন চলবে।</p><a href="/get-qr/${clientNumber}">QR দেখতে ক্লিক করো</a>`);
});

app.get('/get-qr/:number', (req, res) => {
  const bot = allBots[req.params.number];
  if (!bot) return res.send("এখনো QR আসে নাই, ১০ সেকেন্ড পর রিফ্রেশ দাও। যদি বট আগে চালু থাকে, তাহলে QR লাগবে না, বট এমনিতেই চালু আছে।");
  res.send(`<h2>${bot.status}</h2><img src="${bot.qrImage}" />`);
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log("Bot Factory চালু!"));
