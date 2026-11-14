const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null;
let allBots = {};
app.get('/', (req, res) => {
  res.send(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bot Factory</title><style>body{font-family:sans-serif;max-width:500px;margin:20px auto;padding:20px}input,textarea{width:100%;padding:12px;margin:8px 0;border:1px solid #ccc;border-radius:8px}button{width:100%;padding:14px;background:#25D366;border:none;color:white;font-size:18px;border-radius:8px}</style></head><body><h2>Bot Factory - Login Mone Thakbe!</h2><form action="/create-bot" method="POST"><label>ক্লায়েন্টের নম্বর (8801...):</label><input name="number" placeholder="8801712345678" required><label>ব্যবসার নাম:</label><input name="shopName" placeholder="Tanvir Fashion" required><label>ব্যবসার তথ্য:</label><textarea name="shopInfo" rows="4" placeholder="কি বিক্রি করো, দাম কত" required></textarea><button>বট বানাও</button></form></body></html>`);
});
app.post('/create-bot', async (req, res) => {
  const { number, shopName, shopInfo } = req.body;
  const clientNumber = number.replace(/[^0-9]/g, '');
  if (allBots[clientNumber]) return res.redirect(`/qr/${clientNumber}`);
  allBots[clientNumber] = { qrImage: null, status: "বট চালু হচ্ছে... ৩০ সেকেন্ড অপেক্ষা করো" };
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: clientNumber }),
    puppeteer: { headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--single-process','--no-zygote'] }
  });
  client.on('qr', async (qr) => {
    console.log("QR for", clientNumber);
    qrcodeTerminal.generate(qr, { small: true });
    console.log("QR LOG E ASCHE - SCAN KORO!");
    const qrImage = await qrcode.toDataURL(qr);
    allBots[clientNumber].qrImage = qrImage;
    allBots[clientNumber].status = "QR আসছে - স্ক্যান করো";
  });
  client.on('ready', () => {
    console.log("Bot Ready:", clientNumber);
    allBots[clientNumber].status = "✅ চালু! বট এখন কাজ করছে";
    allBots[clientNumber].qrImage = null;
  });
  client.on('auth_failure', (msg) => { allBots[clientNumber].status = "Login Fail - আবার চেষ্টা করো"; });
  client.on('disconnected', (reason) => { allBots[clientNumber].status = "বন্ধ হয়ে গেছে - আবার বানাও"; });
  client.on('message', async (msg) => {
    if (msg.fromMe) return;
    try {
      let replyText = `আসসালামু আলাইকুম! ${shopName} এ স্বাগতম। ${shopInfo}`;
      if (genAI) {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `তুমি ${shopName} এর কর্মচারী। তথ্য: ${shopInfo}. কাস্টমার: ${msg.body}. বাংলায় ছোট উত্তর দাও।`;
        const result = await model.generateContent(prompt);
        replyText = result.response.text();
      }
      await msg.reply(replyText);
    } catch (e) { console.log("AI Error", e.message); }
  });
  client.initialize().catch(e => { allBots[clientNumber].status = "Error: " + e.message; });
  res.redirect(`/qr/${clientNumber}`);
});
app.get('/qr/:number', (req, res) => {
  const bot = allBots[req.params.number];
  if (!bot) return res.send("বট পাওয়া যায়নি। <a href='/'>আবার বানাও</a>");
  res.send(`<html><head><meta http-equiv="refresh" content="5"><meta name="viewport" content="width=device-width, initial-scale=1"><title>QR Scan</title><style>body{font-family:sans-serif;text-align:center;padding:20px}img{max-width:300px}</style></head><body><h2>${bot.status}</h2>${bot.qrImage ? `<img src="${bot.qrImage}"><p>WhatsApp > Linked Devices > Link a device দিয়ে স্ক্যান করো</p>` : `<p>অপেক্ষা করো... পেজটি ৫ সেকেন্ড পর পর Refresh হবে।</p><p>QR Render Logs এও দেখতে পারবা।</p>`}<br><a href="/">আরেকটা বট বানাও</a></body></html>`);
});
app.listen(PORT, () => console.log("Bot Factory চালু! Port " + PORT));
