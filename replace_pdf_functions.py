import re

# 读取文件
with open(r'c:\Projects\smartseat\src\app\dashboard\page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 找到handleExportPdf开始行 (约1245行)
# 找到其结束行 (约1635行,在};处)
# 找到handleExportPlaceCards开始行 (约1636行)
# 找到其结束行 (约1735行)

# 搜索关键行
export_pdf_start = None
export_pdf_end = None
export_place_cards_start = None
export_place_cards_end = None

for i, line in enumerate(lines):
    if 'const handleExportPdf = () => {' in line:
        export_pdf_start = i
    elif export_pdf_start and not export_pdf_end and line.strip() == '};' and i > export_pdf_start + 300:
        export_pdf_end = i
    elif 'const handleExportPlaceCards = () => {' in line:
        export_place_cards_start = i
    elif export_place_cards_start and not export_place_cards_end and line.strip() == '};' and i > export_place_cards_start + 80:
        export_place_cards_end = i
        break

print(f"handleExportPdf: 行 {export_pdf_start+1} 到 {export_pdf_end+1}")
print(f"handleExportPlaceCards: 行 {export_place_cards_start+1} 到 {export_place_cards_end+1}")

# 替换handleExportPdf
new_export_pdf = """  const handleExportPdf = () => {
    if (!currentProject) {
      showNotification('请先选择一个项目', 'error');
      return;
    }

    showNotification('正在生成PDF，请稍候...');

    try {
      generateSeatingPdf(currentProject, tables, unassignedGuests, stats, guestNameMap);
      showNotification('PDF导出成功！');
    } catch (error) {
      console.error('PDF导出错误:', error);
      showNotification('导出PDF失败，请重试', 'error');
    }
  };
"""

# 替换handleExportPlaceCards  
new_export_place_cards = """  const handleExportPlaceCards = () => {
    if (!currentProject) {
      showNotification('请先选择一个项目', 'error');
      return;
    }

    const assignedGuests = tables.flatMap(table => table.guests);
    if (assignedGuests.length === 0) {
      showNotification('没有已安排座位的宾客可以生成桌卡', 'error');
      return;
    }

    showNotification('正在生成桌卡PDF, 请稍候...');

    try {
      generatePlaceCardsPdf(currentProject, tables);
      showNotification('桌卡PDF已成功生成！');
    } catch (error) {
      console.error('生成桌卡PDF时出错', error);
      showNotification('生成桌卡失败，请重试', 'error');
    }
  };
"""

# 构建新文件内容
new_lines = []
new_lines.extend(lines[:export_pdf_start])
new_lines.append(new_export_pdf)
new_lines.extend(lines[export_pdf_end+1:export_place_cards_start])
new_lines.append(new_export_place_cards)
new_lines.extend(lines[export_place_cards_end+1:])

# 写回文件
with open(r'c:\Projects\smartseat\src\app\dashboard\page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("替换完成!")
print(f"从 {len(lines)} 行减少到 {len(new_lines)} 行")
print(f"减少了 {len(lines) - len(new_lines)} 行")
