const puppeteer = require("puppeteer");
const axios = require("axios");
const express = require("express");
const fs = require("fs");

const app = express();

// 🔥 CONFIG
const WEBHOOK_URL = "";
const URL = "https://hanaminikata.com/status_trial_ugphone";
const FILE = "message.json";

const PORT = process.env.PORT || 3000;

// 📊 STATUS
let currentStatus = {
    sg: false,
    hk: false,
    jp: false,
    de: false,
    us: false,
    lastUpdate: null
};

let messageId = fs.existsSync(FILE)
    ? JSON.parse(fs.readFileSync(FILE)).id
    : null;

const startTime = Date.now();
let isChecking = false;

// ⏱ uptime
function getUptime() {
    const diff = Date.now() - startTime;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}:${m.toString().padStart(2, "0")}`;
}

// 🎨 embed
function buildEmbed() {
    const icon = (v) => v ? "🟢" : "🔴";

    return {
        embeds: [
            {
                title: "📱 Trạng thái UGPhone Trial 🏷️",
                color: 0x00bfff,
                description:
`🇸🇬 Singapore - ${icon(currentStatus.sg)}
🇭🇰 Hong Kong - ${icon(currentStatus.hk)}
🇯🇵 Japan - ${icon(currentStatus.jp)}
🇩🇪 Germany - ${icon(currentStatus.de)}
🇺🇸 America - ${icon(currentStatus.us)}

**Chú thích**
🟢 Còn máy
🔴 Hết máy

🕜 Uptime: ${getUptime()} ngày ${new Date().toLocaleDateString("vi-VN")}`,
                footer: { text: "Auto Up" }
            }
        ]
    };
}

// 🔍 CHECK STATUS CHUẨN (VI + EN)
async function checkStatus() {
    if (isChecking) return;
    isChecking = true;

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    try {
        await page.goto(URL, {
            waitUntil: "networkidle2",
            timeout: 60000
        });

        // đợi render xong (trang này load hơi chậm)
        await page.waitForSelector("body");
        await new Promise(r => setTimeout(r, 5000));

        const result = await page.evaluate(() => {

            function checkCountry(name) {
                // tìm mọi phần tử có chứa tên quốc gia
                const nodes = Array.from(document.querySelectorAll("div, span, p, li"));

                for (const node of nodes) {
                    const text = node.innerText || "";
                    if (!text.includes(name)) continue;

                    // lấy block cha gần nhất (chứa cả quốc gia + trạng thái)
                    let parent = node;
                    for (let i = 0; i < 5; i++) {
                        if (!parent) break;
                        const t = parent.innerText || "";

                        // Ưu tiên tiếng Việt
                        if (t.includes("Trạng thái: Có máy")) return true;
                        if (t.includes("Trạng thái: Hết máy")) return false;

                        // fallback tiếng Anh
                        const lower = t.toLowerCase();
                        if (lower.includes("available")) return true;
                        if (lower.includes("unavailable")) return false;

                        parent = parent.parentElement;
                    }
                }

                return false;
            }

            return {
                sg: checkCountry("Singapore"),
                hk: checkCountry("Hong Kong"),
                jp: checkCountry("Japan"),
                de: checkCountry("Germany"),
                us: checkCountry("America")
            };
        });

        currentStatus = {
            ...result,
            lastUpdate: new Date().toISOString()
        };

        console.log("✔ Updated REAL status:", currentStatus);

    } catch (err) {
        console.log("❌ Puppeteer lỗi:", err.message);
    }

    await browser.close();
    isChecking = false;
}

// 📤 WEBHOOK
async function sendWebhook() {
    const data = buildEmbed();

    try {
        if (!messageId) {
            const res = await axios.post(WEBHOOK_URL + "?wait=true", data);
            messageId = res.data.id;
            fs.writeFileSync(FILE, JSON.stringify({ id: messageId }));
        } else {
            await axios.patch(`${WEBHOOK_URL}/messages/${messageId}`, data);
        }
    } catch (err) {
        console.log("Webhook lỗi:", err.message);
    }
}

// 🔁 LOOP (không block API)
function startLoop() {
    async function run() {
        await checkStatus();
        await sendWebhook();

        setTimeout(run, 120000); // 2 phút
    }
    run();
}

startLoop();

// 🌐 API (tối ưu tốc độ)
app.get("/api/status", (req, res) => {
    res.set("Cache-Control", "public, max-age=5");

    res.json({
        success: true,
        data: currentStatus
    });
});

// test
app.get("/", (req, res) => {
    res.send("API UGPhone đang chạy!");
});

app.listen(PORT, () => {
    console.log("Server chạy port " + PORT);
});
