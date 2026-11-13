const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const qrcode = require('qrcode');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
let allBots = {};
app.get('/', (req, res) => {
  res.send(`<h2>🤖 Bot Factory - Koyeb</h2><form action="/create-bot" method="POST">ক্লায়েন্টের নম্বর: <input name="clientNumber" required><br><br>ব্যবসার নাম: <input name="businessName" required><br><br>ব্যবসার তথ্য: <textarea name="businessInfo"></textarea><br><br><button type="submit">বট বানাও</button></form>`);
});
app.post('/create-bot', async (req, res) => {
  const { clientNumber, businessName, businessInfo } = req.body;
  const client = new Client({ authStrategy: new LocalAuth({ clientId: clientNumber }), puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] } });
  client.on('qr', async (qr) => {
    const qrImage = await qrcode.toDataURL(qr);
    allBots[clientNumber] = { qrImage, status: "QR আসছে" };
  });
  client.on('ready', () => { allBots[clientNumber].status = "✅ চালু!"; });
  client.on('message', async msg => {
    if (msg.from === 'status@broadcast') return;
    const prompt = `তুমি ${businessName} এর সেলসম্যান। তথ্য: ${businessInfo}। বাংলায় বন্ধুর মতো জবাব দাও, বলবা না তুমি AI। কাস্টমার: "${msg.body}"`;
    const result = await model.generateContent(prompt);
    msg.reply(result.response.text());
  });
  client.initialize();
  res.send(`<h2>বট বানানো শুরু!</h2><a href="/get-qr/${clientNumber}">QR দেখতে ক্লিক করো</a>`);
});
app.get('/get-qr/:number', (req, res) => {
  const bot = allBots[req.params.number];
  if (!bot) return res.send("এখনো QR আসে নাই, ১০ সেকেন্ড পর রিফ্রেশ দাও");
  res.send(`<h2>${bot.status}</h2><img src="${bot.qrImage}" />`);
});
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log("Bot Factory চালু!"));
