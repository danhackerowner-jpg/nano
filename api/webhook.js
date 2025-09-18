import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import crypto from "crypto";

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// --- In-memory DB ---
const users = {};
const redeemedCodes = new Set();

// Generate 50 random redeem codes
function generateCodes() {
  return Array.from({ length: 50 }, (_, i) => {
    const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `RDM-${i + 1}-${rand}`;
  });
}
const codes = generateCodes();

// Print generated codes (only server console)
console.log("🔑 Generated Redeem Codes:");
console.log(codes.join("\n"));

const jobs = [
  "Developer","Farmer","Doctor","Driver","Chef",
  "Artist","Streamer","Engineer","Teacher","Musician"
];

// --- Send helpers ---
async function sendTextMessage(recipientId, text) {
  const url = `https://graph.facebook.com/v12.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  try {
    await axios.post(url, { recipient: { id: recipientId }, message: { text } });
  } catch (err) {
    console.error("sendTextMessage error:", err.response?.data || err.message);
  }
}
async function sendButtonMessage(recipientId, text, buttons) {
  const url = `https://graph.facebook.com/v12.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  const body = {
    recipient: { id: recipientId },
    message: { attachment: { type: "template", payload: { template_type: "button", text, buttons } } }
  };
  try {
    await axios.post(url, body);
  } catch (err) {
    console.error("sendButtonMessage error:", err.response?.data || err.message);
  }
}
async function sendQuickReplies(recipientId, text, replies) {
  const url = `https://graph.facebook.com/v12.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  const body = { recipient: { id: recipientId }, message: { text, quick_replies: replies } };
  try {
    await axios.post(url, body);
  } catch (err) {
    console.error("sendQuickReplies error:", err.response?.data || err.message);
  }
}

// --- User system ---
function getUser(id) {
  if (!users[id]) users[id] = { coins: 100, exp: 0, level: 1 };
  return users[id];
}
function addExp(user, amount) {
  user.exp += amount;
  if (user.exp >= user.level * 1000) {
    user.exp = 0;
    user.level++;
  }
}

// --- Command handler ---
async function handleCommand(senderId, message) {
  const text = message.text?.trim().toLowerCase();
  const user = getUser(senderId);

  switch (true) {
    case text === "help":
      return sendButtonMessage(senderId,"Bot Commands:",[
        { type: "postback", title: "Profile", payload: "profile" },
        { type: "postback", title: "Slots", payload: "slots 10" },
        { type: "postback", title: "Work", payload: "work" }
      ]);

    case text === "profile":
      return sendQuickReplies(senderId,
        `USER: ${senderId}\nBALANCE: ${user.coins}\nLEVEL: ${user.level} (${user.exp} exp)`,
        [
          { content_type: "text", title: "Daily", payload: "daily" },
          { content_type: "text", title: "Work", payload: "work" },
          { content_type: "text", title: "Slots 50", payload: "slots 50" }
        ]
      );

    case text.startsWith("slots"):
      const bet = parseInt(text.split(" ")[1]) || 10;
      if (user.coins < bet) return sendTextMessage(senderId,"Not enough coins!");
      user.coins -= bet;
      if (Math.random()<0.4) { 
        user.coins += bet*2; addExp(user,50); 
        return sendQuickReplies(senderId,`🎰 You won ${bet*2} coins!`,[
          {content_type:"text",title:"Play Again",payload:`slots ${bet}`},
          {content_type:"text",title:"Profile",payload:"profile"}
        ]);
      }
      return sendQuickReplies(senderId,"🎰 You lost!",[
        {content_type:"text",title:"Try Again",payload:`slots ${bet}`},
        {content_type:"text",title:"Work",payload:"work"}
      ]);

    case text.startsWith("redeemcode"):
      const code = text.split(" ")[1];
      if (!code) return sendTextMessage(senderId,"Please provide a code.");
      if (!codes.includes(code)) return sendTextMessage(senderId,"Invalid code.");
      if (redeemedCodes.has(code)) return sendTextMessage(senderId,"Code already used.");
      redeemedCodes.add(code); user.coins+=100_000_000_000;
      return sendTextMessage(senderId,"✅ Redeemed! You got 100B coins.");

    case text.startsWith("dice"):
      const dBet = parseInt(text.split(" ")[1]) || 10;
      if (user.coins<dBet) return sendTextMessage(senderId,"Not enough coins!");
      user.coins-=dBet;
      if (Math.random()<0.5){
        user.coins+=dBet*2; addExp(user,30);
        return sendQuickReplies(senderId,`🎲 You rolled high! Won ${dBet*2} coins.`,[
          {content_type:"text",title:"Play Again",payload:`dice ${dBet}`},
          {content_type:"text",title:"Profile",payload:"profile"}
        ]);
      }
      return sendQuickReplies(senderId,"🎲 You lost the dice roll!",[
        {content_type:"text",title:"Retry",payload:`dice ${dBet}`}
      ]);

    case text === "mine":
      if (Math.random()<0.3) return sendTextMessage(senderId,"💀 You were slain by a monster!");
      const found = Math.floor(Math.random()*100)+20; user.coins+=found; addExp(user,100);
      return sendQuickReplies(senderId,`⛏️ You mined ${found} coins!`,[
        {content_type:"text",title:"Mine Again",payload:"mine"},
        {content_type:"text",title:"Profile",payload:"profile"}
      ]);

    case text === "daily":
      user.coins+=20; addExp(user,750);
      return sendQuickReplies(senderId,"🎁 Daily reward: +20 coins, +750 EXP",[
        {content_type:"text",title:"Profile",payload:"profile"},
        {content_type:"text",title:"Work",payload:"work"}
      ]);

    case text === "hourly":
      user.coins+=5; addExp(user,150);
      return sendQuickReplies(senderId,"⏳ Hourly reward: +5 coins, +150 EXP",[
        {content_type:"text",title:"Profile",payload:"profile"},
        {content_type:"text",title:"Slots 10",payload:"slots 10"}
      ]);

    case text === "bankrob":
      if (Math.random()<0.15){
        const loot=Math.floor(Math.random()*1000)+500; user.coins+=loot;
        return sendQuickReplies(senderId,`💰 Bankrob success! Stole ${loot} coins.`,[
          {content_type:"text",title:"Profile",payload:"profile"}
        ]);
      }
      return sendTextMessage(senderId,"🚓 Bankrob failed! You escaped but got nothing.");

    case text === "work":
      const job=jobs[Math.floor(Math.random()*jobs.length)];
      const salary=Math.floor(Math.random()*200)+50; user.coins+=salary; addExp(user,200);
      return sendQuickReplies(senderId,`👷 You worked as ${job} and earned ${salary} coins.`,[
        {content_type:"text",title:"Profile",payload:"profile"},
        {content_type:"text",title:"Work Again",payload:"work"}
      ]);

    default:
      return sendTextMessage(senderId,"❓ Unknown command. Type 'help'");
  }
}

// --- Webhook verify ---
app.get("/api/webhook",(req,res)=>{
  if(req.query["hub.mode"]==="subscribe"&&req.query["hub.verify_token"]===VERIFY_TOKEN) 
    return res.send(req.query["hub.challenge"]);
  res.sendStatus(403);
});

// --- Webhook receive ---
app.post("/api/webhook",(req,res)=>{
  const body=req.body;
  if(body.object==="page"){
    body.entry.forEach(entry=>{
      entry.messaging.forEach(event=>{
        if(event.message?.text) handleCommand(event.sender.id,event.message);
        else if(event.postback?.payload) handleCommand(event.sender.id,{text:event.postback.payload});
      });
    });
    res.sendStatus(200);
  } else res.sendStatus(404);
});

app.listen(3000,()=>console.log("🚀 Bot running on port 3000"));
  
