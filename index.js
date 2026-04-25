const puppeteer = require("puppeteer");
const axios = require("axios");
const express = require("express");
const fs = require("fs");

const app = express();

// 🔥 CONFIG
const WEBHOOK_URL = "https://discord.com/api/webhooks/1488493691323809893/aUZGEgko2nD0qp-orAWjWIr8jctoCCuy-K8Ob3aBo2Gi_CIH9GlMX6kOXJ1lZ4xAnxrZ";
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

let messageId = null;

// load message id safe
try {
    if (fs.existsSync(FILE)) {
        const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
        messageId = raw?.id || null;
    }
} catch (e) {
    messageId = null;
}

const startTime = Date.now();
let isChecking = false;

let browser;

// ⏱ uptime
function getUptime() {
    const diff = Date.now() - startTime;
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${d}d ${h}h ${m}m`;
}

// 🎨 embed
function buildEmbed() {
    const icon = (v) => v ? "🟢" : "🔴";

    return {
        embeds: [
            {
                title: "📱 UGPhone Status",
                color: 0x00bfff,
                description:
`🇸🇬 Singapore - ${icon(currentStatus.sg)}
🇭🇰 Hong Kong - ${icon(currentStatus.hk)}
🇯🇵 Japan - ${icon(currentStatus.jp)}
🇩🇪 Germany - ${icon(currentStatus.de)}
🇺🇸 America - ${icon(currentStatus.us)}

🟢 Available
🔴 Unavailable

⏱ Uptime: ${getUptime()}
📅 ${new Date().toLocaleString("vi-VN")}`,
                footer: { text: "Auto Checker" }
            }
        ]
    };
}

// 🔍 INIT BROWSER (reuse - quan trọng)
async function initBrowser() {
    if (browser) return;

    browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage"
        ]
    });
}

// 🔍 CHECK STATUS (FIX MẠNH NHẤT)
async function checkStatus() {
    if (isChecking) return;
    isChecking = true;

    try {
        await initBrowser();

        const page = await browser.newPage();

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
        );

        await page.goto(URL, {
            waitUntil: "networkidle0",
            timeout: 60000
        });

        // đợi DOM render thật sự
        await page.waitForFunction(() =>
            document.body && document.body.innerText.length > 1000
        );

        await page.waitForTimeout(5000);

        const result = await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();

            function check(region) {
                const idx = text.indexOf(region.toLowerCase());
                if (idx === -1) return false;

                const slice = text.slice(idx, idx + 200);

                if (slice.includes("có máy")) return true;
                if (slice.includes("available")) return true;

                if (slice.includes("hết máy")) return false;
                if (slice.includes("unavailable")) return false;

                return false;
            }

            return {
                sg: check("Singapore"),
                hk: check("Hong Kong"),
                jp: check("Japan"),
                de: check("Germany"),
                us: check("America")
            };
        });

        currentStatus = {
            ...result,
            lastUpdate: new Date().toISOString()
        };

        console.log("✔ STATUS:", currentStatus);

        await page.close();

    } catch (err) {
        console.log("❌ CHECK ERROR:", err.message);
    }

    isChecking = false;
}

// 📤 WEBHOOK (fix crash + reset id nếu lỗi)
async function sendWebhook() {
    try {
        const data = buildEmbed();

        if (!messageId) {
            const res = await axios.post(WEBHOOK_URL + "?wait=true", data);
            messageId = res.data?.id;

            if (messageId) {
                fs.writeFileSync(FILE, JSON.stringify({ id: messageId }));
            }
        } else {
            await axios.patch(`${WEBHOOK_URL}/messages/${messageId}`, data);
        }

    } catch (err) {
        console.log("❌ WEBHOOK ERROR:", err.message);

        // reset nếu message bị xoá / lỗi
        messageId = null;
    }
}

// 🔁 LOOP ổn định
async function loop() {
    await checkStatus();
    await sendWebhook();

    setTimeout(loop, 120000);
}

// start
loop();

// 🌐 API
app.get("/api/status", (req, res) => {
    res.set("Cache-Control", "public, max-age=5");

    res.json({
        success: true,
        data: currentStatus
    });
});

app.get("/", (req, res) => {
    res.send("UGPhone API running");
});

// cleanup khi crash
process.on("exit", async () => {
    if (browser) await browser.close();
});

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
