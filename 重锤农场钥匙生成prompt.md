# 重锤农场钥匙生成提示词

### 目的

写一个nodejs脚本用于Minecraft游戏的自动化流程：

## 外部接口
HTTP POST /api/command
请求体携带`{ command: string }`
这个请求代表向Minecraft控制台发送一行命令来执行，成功返回200，失败返回500
将这个发送命令接口进行一次封装，减少直接耦合

## 流程

基于外部接口完成固定的流程：
运行程序，提示用户选择模式：`启动钥匙生成`模式、`清除钥匙生成`模式

`启动钥匙生成`模式：
1. 读取config.json
2. 生成人机DRINKER，并执行动作
3. 生成人机CLICKER，并执行动作
4. 生成人机群AFK

`清除钥匙生成`模式：

1. 读取config.json
2. 依次移除config定义的所有的bots和AFK，AFK按照给定的AFK.name和AFK.num进行移除

## config配置文件示例

```json
{
	"cmd_delay": 1000, 	// 外部接口调用延时，单位毫秒
	"trial_level": 1,	//试炼等级，必须是1、2、3、4其中之一
	"bot_prefix": "bot_",	// 生成人机时不用带前缀，但是操作已经生成的人机时必须携带前缀
	"bots": [	// bots是需要定制操作的人机
		{
			"name": "drinker",	// 该人机的名称
			"pos": [10, 10, -10],		// 该人机生成的三维位置
			"actions": [		// 人机生成后需要立即对其依次执行的操作
				"look down",
				"use continuous"
			]
		},
		{
			"name": "clicker",
			"pos": [10, 15, -10],
			"actions": [
				"look down",
				"use once",
				"use interval ${trial_interval}"	// 对于actions中的`${trial_interval}`字符串需要特殊替换，替换为20 * 60 * 15 * trial_level的实际计算结果
			]
		}
	],
	"AFK": {	// AFK是纯用来挂机的人机，没有额外的动作需要执行
		"name": "genkey",	// AFK的统一名称
		"num": 128,	// 总共需要放置的AFK数量
		"pos": [	// pos是用来放置AFK的所有可用坐标
			[1, 1, 1],
			[1, 1, 3],
			[1, 1, 5]
		]
	}
}
```

注释只是为了让你更好理解，实际文件里面没有

## 注意点

- 人机全名bot_full_name均为`${bot_prefix}${bot_name}`
- 发送命令后输出该命令到控制台，如果响应结果是失败，则还需要打印错误到控制台，请求错误则跳过该命令继续
- 命令的执行，即向外部接口的任何请求都需要串行进行，上一个请求完成后需要等待cmd_delay指定的毫秒数
- 生成人机的命令为`player ${bot_name} spawn at ${x} ${y} ${z} facing 0 0 in minecraft:overworld in survival`
- 已经生成的人机，对其进行操作的命令为`player ${bot_full_name} ${action}`
- 不管人机是否生成，我们都可以通过命令尝试移除：`player ${bot_full_name} kill`
- bots中的人机生成后依次执行其actions的每一条操作命令
- 生成AFK人机群时，使用的bot_name需要在AFK.name后直接加上序号(从1开始编号)，例如第3个就叫`genkey3`，生成的位置是对AFK.pos不断循环取模得到