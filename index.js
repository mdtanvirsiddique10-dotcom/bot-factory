const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const fs = require('fs');

const app = express();
let qrCode = '';
let status = 'QR আসতেছে...';
const GEMINI_KEY = process.env.GEMINI_API_KEY;

async function askGemini(prompt) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `তুমি Bot Factory এর স্মার্ট বাংলা WhatsApp বট। ছোট করে, বন্ধুর মতো বাংলায় উত্তর দাও। প্রশ্ন: ${prompt}` }] }]
      })
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'দুঃখিত, একটু সমস্যা হইছে। আবার বলো।';
  } catch (e) {
    console.log('Gemini Error:', e.message);
    return 'Gemini তে সমস্যা হইছে। একটু পর আবার চেষ্টা করো।';
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Bot Factory', 'Chrome', '1.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      qrCode = await QRCode.toDataURL(qr);
      status = 'QR রেডি - স্ক্যান করো';
    }
    if (connection === 'open') {
      status = '✅ লিংক হয়ে গেছে! Gemini Active';
      qrCode = '';
    }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
      else {
        fs.rmSync('./auth', { recursive: true, force: true });
        status = 'Logged Out - পেজ Refresh দাও';
        startBot();
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;
    const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
    if (!text) return;
    if (text.startsWith('Hello!') || text.startsWith('মেসেজ পাইছি') || text.startsWith('🤖')) return;
    const jid = m.key.remoteJid;
    const low = text.toLowerCase().trim();

    let reply = '';

    if (low === 'hi' || low === 'hello' || low === 'হাই') {
      reply = 'Hello! আমি Bot Factory বট 😊\nমেনু দেখতে *menu* লিখো, আর যেকোনো প্রশ্ন করতে পারো!';
    } else if (low === 'menu' || low === 'মেনু') {
      reply = '🤖 *Bot Factory মেনু*\n\n1. *hi* - হ্যালো\n2. *dam* - দাম জানতে\n3. যেকোনো প্রশ্ন করো - Gemini উত্তর দিবে';
    } else if (low.includes('dam') || low.includes('দাম')) {
      reply = '💰 *দাম:*\n✅ সাধারণ বট - 500 টাকা\n✅ মেনু + অর্ডার বট - 1500 টাকা\n✅ ফুল বিজনেস বট - 3000 টাকা';
    } else {
      // বাকি সব Gemini কে দাও
      reply = await askGemini(text);
    }

    await sock.sendMessage(jid, { text: reply });
  });
}

startBot();

app.get('/', (req, res) => {
  res.send(`<h1>Bot Factory - Gemini Bot</h1><h2>${status}</h2><p>Gemini Key: ${GEMINI_KEY ? '✅ আছে' : '❌ নাই'}</p>${qrCode ? `<img src="${qrCode}" width="300">` : ''}<script>setTimeout(()=>location.reload(),5000)</script>`);
});

app.listen(10000, () => console.log('Gemini Bot চালু! Port 10000'));
