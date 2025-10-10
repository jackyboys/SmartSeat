import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  if (!projectId) {
    return NextResponse.json({ error: '项目ID不能为空' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    
    // 查询指定项目的数据，只选择 layout_data 字段
    const { data: project, error } = await supabase
      .from('projects')
      .select('layout_data')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      throw new Error(error?.message || '项目未找到');
    }

    const layout = project.layout_data as { tables: { tableName: string; guests: { name: string }[] }[] } | null;

    if (!layout || !layout.tables) {
      return NextResponse.json([]); // 返回空数组
    }

    // 将数据扁平化为 { guestName, tableName } 的格式
    const seatingData = layout.tables.flatMap(table => 
      table.guests.map(guest => ({
        guestName: guest.name,
        tableName: table.tableName,
      }))
    );

    return NextResponse.json(seatingData);

  } catch (error: any) {
    console.error(`[API Check-in Error] ProjectID ${projectId}:`, error);
    return NextResponse.json({ error: '无法获取座位信息' }, { status: 500 });
  }
}