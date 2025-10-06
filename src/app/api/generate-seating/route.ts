import { NextResponse } from 'next/server';

type Table = { tableName: string; guests: string[] }

function fallbackGenerate(guestList: string, tableSize = 10): { tables: Table[] } {
  // 基础策略：
  // - 按行拆分姓名，忽略空行
  // - 简单保留括号备注，仅用于展示
  const lines = guestList
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  const tables: Table[] = []
  let idx = 0
  while (idx < lines.length) {
    const chunk = lines.slice(idx, idx + tableSize)
    const tableNo = Math.floor(idx / tableSize) + 1
    tables.push({ tableName: `第${tableNo}桌`, guests: chunk })
    idx += tableSize
  }
  return { tables }
}

// 确保我们使用的是 Edge Runtime，它在 Vercel 上性能更好且免费
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    // 1. 从前端发来的请求中解析出宾客名单
    const { guestList } = await request.json();

    if (!guestList) {
      return NextResponse.json({ error: '宾客名单不能为空' }, { status: 400 });
    }

    // 0. 环境变量检查：DeepSeek API Key 必须配置在服务器环境中（.env.local）
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      // 无密钥时直接降级为本地算法，便于本地演示与开发
      return NextResponse.json({ ...fallbackGenerate(guestList), source: 'fallback', reason: 'no_api_key' });
    }

    // 2. 这是魔法发生的地方：我们构造一个给 AI 的指令 (Prompt)
    const prompt = `
      你是一个专业的活动策划 AI 助手，名为 SmartSeat。
      你的任务是根据提供的宾客名单，生成一个结构化的婚宴座位安排 JSON 对象。
      规则：
      1. 假设每桌最多坐 10 人。
      2. 尽量将有关系或备注相似的人安排在同一桌。
      3. 输出必须是严格的 JSON 格式，不要包含任何 JSON 以外的解释性文字或代码块标记。
      4. JSON 结构应该是一个包含多个桌子对象的数组，每个桌子对象有桌号 (tableName) 和一个包含宾客姓名的数组 (guests)。

      这是宾客名单，以换行分隔：
      ---
      ${guestList}
      ---

      请根据以上名单生成座位安排。
    `;

    // 3. 调用 DeepSeek API
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 从服务器环境变量中安全地读取 API Key
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat', // 使用 DeepSeek 的通用聊天模型
        messages: [
          { role: 'system', content: '你是一个专业的活动策划 AI 助手，名为 SmartSeat。你的任务是输出严格的 JSON 格式。' },
          { role: 'user', content: prompt },
        ],
        // 强制要求 AI 输出 JSON 格式
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      // 如果 DeepSeek API 返回错误，我们也向前端返回错误
      let errorMessage = 'AI 服务调用失败';
      try {
        const errorData = await response.json();
        console.error('DeepSeek API Error:', errorData);
        if (errorData?.error?.message) errorMessage = errorData.error.message;
      } catch {}
      if (response.status === 401 || response.status === 403) {
        errorMessage = 'AI 密钥无效或未配置（请检查 DEEPSEEK_API_KEY）';
      }
      // 远端失败时尝试降级本地算法以不中断用户流程
      const downgraded = fallbackGenerate(guestList)
      return NextResponse.json({ ...downgraded, source: 'fallback', reason: 'remote_error', warning: errorMessage }, { status: 200 });
    }

    const data = await response.json();

    // 4. 解析 AI 返回的结果并规范化为 { tables: [...] }
    // AI 返回的 JSON 字符串在 choices[0].message.content 中
    const parsed = JSON.parse(data.choices[0].message.content);
    const tables = Array.isArray(parsed)
      ? parsed
      : (parsed?.tables ?? parsed?.data ?? parsed?.result ?? null);

    if (!tables || !Array.isArray(tables)) {
      // 无法解析时退回本地算法
      return NextResponse.json({ ...fallbackGenerate(guestList), source: 'fallback', reason: 'bad_format', warning: 'AI 返回格式不正确，已使用本地规则生成' });
    }

    return NextResponse.json({ tables, source: 'ai', model: 'deepseek-chat' });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
