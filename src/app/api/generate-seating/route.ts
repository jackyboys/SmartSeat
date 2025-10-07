import { NextResponse } from 'next/server';

type Table = { tableName: string; guests: string[] }

interface SeatingPlan {
  id: string;
  name: string;
  score: number;
  tables: Table[];
  analysis: string;
  scenario: string;
}

function fallbackGenerate(guestList: string, planCount: number = 1, tableSize = 10): { plans: SeatingPlan[] } {
  const lines = guestList
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  const plans: SeatingPlan[] = [];

  for (let planIndex = 0; planIndex < planCount; planIndex++) {
    // 为每个方案创建不同的排列
    const shuffledLines = [...lines];
    if (planIndex > 0) {
      // 对后续方案进行洗牌，创建不同组合
      for (let i = shuffledLines.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledLines[i], shuffledLines[j]] = [shuffledLines[j], shuffledLines[i]];
      }
    }

    const tables: Table[] = []
    let idx = 0
    while (idx < shuffledLines.length) {
      const chunk = shuffledLines.slice(idx, idx + tableSize)
      const tableNo = Math.floor(idx / tableSize) + 1
      tables.push({ tableName: `第${tableNo}桌`, guests: chunk })
      idx += tableSize
    }

    plans.push({
      id: `plan-${planIndex + 1}`,
      name: planIndex === 0 ? '推荐方案' : `方案${planIndex + 1}`,
      score: 85 + Math.random() * 10, // 模拟评分
      tables,
      analysis: planIndex === 0 ? '基于默认分组策略' : `优化排列方案${planIndex + 1}`,
      scenario: planIndex === 0 ? '适合大多数场合' : '备选方案'
    });
  }

  return { plans }
}

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    // 支持单方案和多方案请求
    const { guestList, planCount = 1 } = await request.json();

    if (!guestList) {
      return NextResponse.json({ error: '宾客名单不能为空' }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      // 使用本地算法生成多方案
      const result = fallbackGenerate(guestList, planCount);
      return NextResponse.json({ 
        ...result, 
        source: 'fallback', 
        reason: 'no_api_key' 
      });
    }

    // 构建AI提示，支持多方案生成
    const prompt = planCount > 1 ? `
      你是专业的婚礼策划师，请为以下宾客生成${planCount}种不同的座位安排方案。

      宾客名单：
      ${guestList}

      要求：
      1. 每桌最多10人
      2. 每个方案要有不同的分组策略
      3. 返回JSON格式：{ "plans": [{ "name": "方案名", "score": 85-95, "analysis": "分析", "scenario": "适用场景", "tables": [{"tableName": "桌名", "guests": ["姓名"]}] }] }

      方案策略建议：
      - 方案1：按年龄相近分组
      - 方案2：按关系亲密度分组  
      - 方案3：混合分组促进交流
    ` : `
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

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: planCount > 1 
              ? '你是专业的婚礼座位安排助手，擅长生成多种不同策略的座位方案。'
              : '你是一个专业的活动策划 AI 助手，名为 SmartSeat。'
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: planCount > 1 ? 0.8 : 0.7, // 多方案时增加随机性
        max_tokens: planCount > 1 ? 3000 : 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API 调用失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('AI 返回内容为空');
    }

    let parsed;
    try {
      // 尝试提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法从AI响应中提取JSON');
      }
    } catch (parseError) {
      console.error('JSON解析失败，使用备用方案:', parseError);
      return NextResponse.json(fallbackGenerate(guestList, planCount));
    }

    // 处理单方案响应（向后兼容）
    if (planCount === 1 && parsed.tables && !parsed.plans) {
      return NextResponse.json({
        tables: parsed.tables,
        source: 'ai'
      });
    }

    // 处理多方案响应
    if (parsed.plans) {
      return NextResponse.json({
        plans: parsed.plans,
        source: 'ai'
      });
    }

    // 兜底处理
    return NextResponse.json(fallbackGenerate(guestList, planCount));

  } catch (error: any) {
    console.error('生成座位方案失败:', error);
    // 出错时也返回备用方案，而不是完全失败
    const { guestList, planCount = 1 } = await request.json();
    return NextResponse.json({
      ...fallbackGenerate(guestList, planCount),
      source: 'fallback',
      reason: 'api_error',
      error: error.message
    });
  }
}