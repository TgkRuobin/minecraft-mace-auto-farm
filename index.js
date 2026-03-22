const fs = require("fs");
const readline = require("readline");

const config = loadConfig();
const API_URL = "http://192.168.0.3:3002/api/command"; // 修改为你的接口地址

// =========================
// 工具函数
// =========================

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function loadConfig() {
    const text = fs.readFileSync("./config.json", "utf-8");
    return JSON.parse(text);
}

// =========================
// Command API 封装
// =========================

async function sendCommandRaw(command) {
    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-access-key": config.access_key,
            },
            body: JSON.stringify({ command })
        });

        if (res.status === 200) {
            console.log("[OK]", command);
            return true;
        } else {
            console.error("[FAIL]", command);
            return false;
        }

    } catch (e) {
        console.error("[ERROR]", command, e.message);
        return false;
    }
}

// 串行 + 延时封装

async function createCommandExecutor(delay) {

    async function exec(command) {

        await sendCommandRaw(command);

        await sleep(delay);
    }

    return exec;
}

// =========================
// 替换变量
// =========================

function buildContext(config) {

    const trial_interval =
        20 * 60 * 15 * config.trial_level;

    return {
        trial_interval
    };
}

function replaceVars(str, ctx) {

    return str.replace(
        /\$\{(\w+)\}/g,
        (_, key) => ctx[key] ?? ""
    );
}

// =========================
// bot 操作
// =========================

function getFullName(prefix, name) {
    return `${prefix}${name}`;
}

async function spawnBot(exec, config, bot, ctx) {

    const [x, y, z] = bot.pos;

    const cmd =
        `player ${bot.name} spawn at ${x} ${y} ${z} facing 0 0 in minecraft:overworld in survival`;

    await exec(cmd);

    const full = getFullName(
        config.bot_prefix,
        bot.name
    );

    for (const act of bot.actions) {

        const action =
            replaceVars(act, ctx);

        const cmd =
            `player ${full} ${action}`;

        await exec(cmd);
    }
}

// =========================
// AFK 生成
// =========================

async function spawnAFK(exec, config) {

    const afk = config.AFK;

    for (let i = 1; i <= afk.num; i++) {

        const pos =
            afk.pos[(i - 1) % afk.pos.length];

        const [x, y, z] = pos;

        const name =
            `${afk.name}${i}`;

        const cmd =
            `player ${name} spawn at ${x} ${y} ${z} facing 0 0 in minecraft:overworld in survival`;

        await exec(cmd);
    }
}

// =========================
// 清除 bots
// =========================

async function clearBots(exec, config) {

    for (const bot of config.bots) {

        const full =
            getFullName(
                config.bot_prefix,
                bot.name
            );

        const cmd =
            `player ${full} kill`;

        await exec(cmd);
    }
}

// =========================
// 清除 AFK
// =========================

async function clearAFK(exec, config) {

    const afk = config.AFK;

    for (let i = 1; i <= afk.num; i++) {

        const name =
            `${afk.name}${i}`;

        const full =
            getFullName(
                config.bot_prefix,
                name
            );

        const cmd =
            `player ${full} kill`;

        await exec(cmd);
    }
}

// =========================
// 启动模式
// =========================

async function startMode(config) {

    const exec =
        await createCommandExecutor(
            config.cmd_delay
        );

    const ctx =
        buildContext(config);

    for (const bot of config.bots) {

        await spawnBot(
            exec,
            config,
            bot,
            ctx
        );
    }

    await spawnAFK(exec, config);
}

// =========================
// 清除模式
// =========================

async function clearMode(config) {

    const exec =
        await createCommandExecutor(
            config.cmd_delay
        );

    await clearBots(exec, config);

    await clearAFK(exec, config);
}

// =========================
// CLI
// =========================

async function askMode() {

    const rl =
        readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

    return new Promise(resolve => {

        console.log("");
        console.log("1 = 启动钥匙生成");
        console.log("2 = 清除钥匙生成");
        console.log("");

        rl.question(
            "选择模式: ",
            ans => {
                rl.close();
                resolve(ans.trim());
            }
        );
    });
}

// =========================
// main
// =========================

async function main() {

    const mode =
        await askMode();

    if (mode === "1") {

        await startMode(config);

    } else if (mode === "2") {

        await clearMode(config);

    } else {

        console.log("未知模式");

    }

    console.log("完成");
}

main();