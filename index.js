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
// 兑换模式
// =========================

async function exchangeMode(config) {

    const exec =
        await createCommandExecutor(
            config.cmd_delay
        );

    const bot_clicker_name = config.exchange.clicker_bot_name;
    const bot_clicker_fullname = `${config.bot_prefix}${bot_clicker_name}`;
    const bot_clicker_pos = config.exchange.clicker_bot_pos;

    
    
    const bot_user_pos = config.exchange.user_bot_pos;

    const preActions = config.exchange.pre_actions.map(a => {
        return a.replace('${clicker}', bot_clicker_fullname);
    });

    const cycle = config.exchange.cycle;

    await exec(`player ${bot_clicker_name} spawn at ${bot_clicker_pos.join(' ')} facing 0 0 in minecraft:overworld in survival`);
    for(const action of preActions) {
        await exec(action);
    }

    for (let i = 0;i < cycle;i++) {
        console.log(`第 ${i + 1} 轮循环♻️开始`);
        for (let j = 0;j < 128;j++) {
            const bot_user_name = `${config.exchange.user_bot_name}${j + 1}`;
            const bot_user_fullname = `${config.bot_prefix}${bot_user_name}`;

            await exec(`player ${bot_user_name} spawn at ${bot_user_pos.join(' ')} facing 0 0 in minecraft:overworld in survival`);
            await sleep(5000);

            const loopActions = config.exchange.loop_actions.map(a => {
                return a.replace('${clicker}', bot_clicker_fullname)
                        .replace('${user}', bot_user_fullname);
            });

            for(const action of loopActions) {
                await exec(action);
            }

            await sleep(6000);
        }
    }

    await exec(`player ${bot_clicker_fullname} kill`);
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
        console.log("3 = 钥匙兑换模式")
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

    } else if (mode === "3") {

        await exchangeMode(config);

    } else {

        console.log("未知模式");

    }

    console.log("完成");
}

main();