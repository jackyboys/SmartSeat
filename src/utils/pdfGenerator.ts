/**
 * PDF 生成工具
 * 
 * 封装 PDF 导出逻辑,包括座位安排 PDF 和桌卡 PDF 的生成
 */

// @ts-ignore - pdfMake 没有类型定义
import pdfMake from 'pdfmake/build/pdfmake';
import { pdfFonts } from '@/utils/pdfFonts';

// 配置 pdfMake 字体
pdfMake.fonts = {
  NotoSansSC: pdfFonts.NotoSansSC,
  Roboto: pdfFonts.Roboto
};

// 类型定义
interface Guest {
  id: string;
  name: string;
  status?: 'confirmed' | 'unconfirmed' | 'cancelled' | 'checked-in';
  avatarUrl?: string;
  locked?: boolean;
  checkInTime?: string;
}

interface SeatingTable {
  id: string;
  tableName: string;
  guests: Guest[];
  capacity: number;
}

type NotTogetherRule = [string, string];

interface Project {
  id: number;
  name: string;
  layout_data: {
    tables: SeatingTable[];
    unassignedGuests: Guest[];
    rules?: {
      notTogether: NotTogetherRule[];
    };
  } | null;
}

interface Stats {
  totalGuests: number;
  tableCount: number;
  avgGuestsPerTable: number;
  confirmedCount: number;
  unconfirmedCount: number;
  cancelledCount: number;
  checkedInCount: number;
  assignedGuestsCount: number;
  unassignedGuestsCount: number;
  tableFillRate: { name: string; rate: number }[];
}

/**
 * 生成座位安排 PDF
 * 
 * @param project - 当前项目
 * @param tables - 桌子列表
 * @param unassignedGuests - 未分配宾客列表
 * @param stats - 统计数据
 * @param guestNameMap - 宾客 ID 到名称的映射
 */
export function generateSeatingPdf(
  project: Project,
  tables: SeatingTable[],
  unassignedGuests: Guest[],
  stats: Stats,
  guestNameMap: Map<string, string>
) {
  const totalGuests = tables.reduce((sum, table) => sum + table.guests.length, 0) + unassignedGuests.length;
  const assignedGuests = tables.reduce((sum, table) => sum + table.guests.length, 0);

  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],

    content: [
      {
        text: project.name,
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 10]
      },

      {
        text: `生成时间: ${new Date().toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })}`,
        style: 'timestamp',
        alignment: 'center',
        margin: [0, 0, 0, 30]
      },

      {
        text: '座位安排详情',
        style: 'sectionHeader',
        margin: [0, 0, 0, 15]
      },

      ...tables.map((table) => {
        const fillRate = table.capacity ? (table.guests.length / table.capacity * 100).toFixed(0) : 0;
        const statusColor = table.guests.length >= table.capacity ? '#ef4444' :
                            table.guests.length >= table.capacity * 0.8 ? '#f59e0b' :
                            '#10b981';

        return {
          stack: [
            {
              columns: [
                {
                  text: `${table.tableName}`,
                  style: 'tableTitle',
                  width: '*'
                },
                {
                  text: `${table.guests.length}/${table.capacity}人`,
                  style: 'tableCapacity',
                  color: statusColor,
                  width: 'auto'
                },
                {
                  text: `(${fillRate}%)`,
                  style: 'tableFillRate',
                  color: statusColor,
                  width: 'auto',
                  margin: [5, 0, 0, 0]
                }
              ],
              margin: [0, 0, 0, 8]
            },

            ...(table.guests.length > 0 ? [
              {
                ul: table.guests.map((guest, index) => {
                  const statusText = guest.status === 'checked-in' ? '✓✓' :
                                     guest.status === 'confirmed' ? '✓' :
                                     guest.status === 'cancelled' ? '✕' :
                                     '○';
                  const statusColor = guest.status === 'checked-in' ? '#3b82f6' :
                                      guest.status === 'confirmed' ? '#10b981' :
                                      guest.status === 'cancelled' ? '#ef4444' :
                                      '#f59e0b';

                  return {
                    text: [
                      { text: `${index + 1}. `, style: 'guestNumber' },
                      { text: guest.name, style: 'guestName' },
                      { text: ` ${statusText}`, color: statusColor, bold: true }
                    ]
                  };
                }),
                margin: [20, 0, 0, 15]
              }
            ] : [
              {
                text: '(暂无宾客)',
                style: 'emptyText',
                margin: [20, 0, 0, 15]
              }
            ])
          ],
          unbreakable: true,
          margin: [0, 0, 0, 10]
        };
      }),

      ...(unassignedGuests.length > 0 ? [
        {
          text: '未分配宾客',
          style: 'sectionHeader',
          margin: [0, 20, 0, 15],
          pageBreak: tables.length > 8 ? 'before' : undefined
        },
        {
          columns: [
            {
              text: `共 ${unassignedGuests.length} 人`,
              style: 'tableCapacity',
              color: '#ef4444',
              width: 'auto'
            }
          ],
          margin: [0, 0, 0, 8]
        },
        {
          ul: unassignedGuests.map((guest, index) => {
            const statusText = guest.status === 'checked-in' ? '✓✓' :
                               guest.status === 'confirmed' ? '✓' :
                               guest.status === 'cancelled' ? '✕' :
                               '○';
            const statusColor = guest.status === 'checked-in' ? '#3b82f6' :
                                guest.status === 'confirmed' ? '#10b981' :
                                guest.status === 'cancelled' ? '#ef4444' :
                                '#f59e0b';

            return {
              text: [
                { text: `${index + 1}. `, style: 'guestNumber' },
                { text: guest.name, style: 'guestName' },
                { text: ` ${statusText}`, color: statusColor, bold: true }
              ]
            };
          }),
          margin: [20, 0, 0, 20]
        }
      ] : []),

      {
        canvas: [
          {
            type: 'line',
            x1: 0, y1: 0,
            x2: 515, y2: 0,
            lineWidth: 1,
            lineColor: '#e5e7eb'
          }
        ],
        margin: [0, 20, 0, 20]
      },

      {
        text: '统计信息',
        style: 'sectionHeader',
        margin: [0, 0, 0, 15]
      },

      {
        columns: [
          {
            width: '50%',
            stack: [
              {
                text: '基础统计',
                style: 'subHeader',
                margin: [0, 0, 0, 10]
              },
              {
                table: {
                  widths: ['*', 'auto'],
                  body: [
                    [
                      { text: '总桌数', style: 'statLabel' },
                      { text: stats.tableCount.toString(), style: 'statValue', alignment: 'right' }
                    ],
                    [
                      { text: '总宾客数', style: 'statLabel' },
                      { text: totalGuests.toString(), style: 'statValue', alignment: 'right' }
                    ],
                    [
                      { text: '已安排宾客', style: 'statLabel' },
                      { text: assignedGuests.toString(), style: 'statValue', alignment: 'right', color: '#10b981' }
                    ],
                    [
                      { text: '未安排宾客', style: 'statLabel' },
                      { text: unassignedGuests.length.toString(), style: 'statValue', alignment: 'right', color: unassignedGuests.length > 0 ? '#ef4444' : '#6b7280' }
                    ],
                    [
                      { text: '平均每桌', style: 'statLabel' },
                      { text: stats.avgGuestsPerTable.toString(), style: 'statValue', alignment: 'right' }
                    ]
                  ]
                },
                layout: {
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0,
                  hLineColor: () => '#e5e7eb',
                  paddingLeft: () => 8,
                  paddingRight: () => 8,
                  paddingTop: () => 6,
                  paddingBottom: () => 6
                }
              }
            ]
          },
          {
            width: '50%',
            stack: [
              {
                text: '宾客状态',
                style: 'subHeader',
                margin: [0, 0, 0, 10]
              },
              {
                table: {
                  widths: ['*', 'auto'],
                  body: [
                    [
                      { text: '已签到', style: 'statLabel' },
                      { text: stats.checkedInCount.toString(), style: 'statValue', alignment: 'right', color: '#3b82f6' }
                    ],
                    [
                      { text: '已确认', style: 'statLabel' },
                      { text: stats.confirmedCount.toString(), style: 'statValue', alignment: 'right', color: '#10b981' }
                    ],
                    [
                      { text: '未确认', style: 'statLabel' },
                      { text: stats.unconfirmedCount.toString(), style: 'statValue', alignment: 'right', color: '#f59e0b' }
                    ],
                    [
                      { text: '已取消', style: 'statLabel' },
                      { text: stats.cancelledCount.toString(), style: 'statValue', alignment: 'right', color: '#ef4444' }
                    ]
                  ]
                },
                layout: {
                  hLineWidth: () => 0.5,
                  vLineWidth: () => 0,
                  hLineColor: () => '#e5e7eb',
                  paddingLeft: () => 8,
                  paddingRight: () => 8,
                  paddingTop: () => 6,
                  paddingBottom: () => 6
                }
              }
            ]
          }
        ],
        columnGap: 20
      },

      ...(project.layout_data?.rules?.notTogether && project.layout_data.rules.notTogether.length > 0 ? [
        {
          text: '座位规则',
          style: 'sectionHeader',
          margin: [0, 20, 0, 15]
        },
        {
          text: '以下宾客不宜同桌：',
          style: 'normalText',
          margin: [0, 0, 0, 8]
        },
        {
          ul: project.layout_data.rules.notTogether.map(rule => {
            const name1 = guestNameMap.get(rule[0]) || '未知';
            const name2 = guestNameMap.get(rule[1]) || '未知';
            return `${name1} ↔ ${name2}`;
          }),
          margin: [20, 0, 0, 0]
        }
      ] : [])
    ],

    styles: {
      header: {
        fontSize: 24,
        bold: true,
        color: '#1e40af'
      },
      timestamp: {
        fontSize: 9,
        color: '#6b7280',
        italics: true
      },
      sectionHeader: {
        fontSize: 16,
        bold: true,
        color: '#374151',
        decoration: 'underline',
        decorationColor: '#e5e7eb'
      },
      subHeader: {
        fontSize: 12,
        bold: true,
        color: '#4b5563'
      },
      tableTitle: {
        fontSize: 13,
        bold: true,
        color: '#1f2937'
      },
      tableCapacity: {
        fontSize: 11,
        bold: true
      },
      tableFillRate: {
        fontSize: 9
      },
      guestNumber: {
        fontSize: 10,
        color: '#9ca3af'
      },
      guestName: {
        fontSize: 10,
        color: '#374151'
      },
      emptyText: {
        fontSize: 9,
        color: '#9ca3af',
        italics: true
      },
      statLabel: {
        fontSize: 10,
        color: '#4b5563'
      },
      statValue: {
        fontSize: 10,
        bold: true,
        color: '#1f2937'
      },
      normalText: {
        fontSize: 10,
        color: '#374151'
      }
    },

    defaultStyle: {
      font: 'NotoSansSC',
      fontSize: 10,
      lineHeight: 1.3
    },

    header: (currentPage: number, pageCount: number) => {
      return {
        text: project.name,
        alignment: 'center',
        margin: [0, 20, 0, 0],
        fontSize: 9,
        color: '#9ca3af'
      };
    },
    footer: (currentPage: number, pageCount: number) => {
      return {
        columns: [
          {
            text: `生成自 SmartSeat`,
            alignment: 'left',
            margin: [40, 0, 0, 0],
            fontSize: 8,
            color: '#9ca3af'
          },
          {
            text: `第 ${currentPage} 页 / 共 ${pageCount} 页`,
            alignment: 'right',
            margin: [0, 0, 40, 0],
            fontSize: 8,
            color: '#9ca3af'
          }
        ],
        margin: [0, 10, 0, 0]
      };
    }
  };

  pdfMake.createPdf(docDefinition).download(`${project.name}_座位安排.pdf`);
}

/**
 * 生成桌卡 PDF
 * 
 * @param project - 当前项目
 * @param tables - 桌子列表
 */
export function generatePlaceCardsPdf(
  project: Project,
  tables: SeatingTable[]
) {
  const assignedGuests = tables.flatMap(table =>
    table.guests.map(guest => ({
      guestName: guest.name,
      tableName: table.tableName,
    }))
  );

  if (assignedGuests.length === 0) {
    throw new Error('没有已安排座位的宾客可以生成桌卡');
  }

  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [20, 20, 20, 20],
    content: [
      {
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 15,
          paddingRight: () => 15,
          paddingTop: () => 15,
          paddingBottom: () => 15,
        },
        table: {
          widths: ['*', '*', '*'],
          body: [],
        },
      },
    ],
    styles: {
      guestName: {
        font: 'NotoSansSC',
        fontSize: 24,
        bold: true,
        alignment: 'center',
        margin: [0, 10, 0, 10],
        color: '#1a202c',
      },
      tableName: {
        font: 'NotoSansSC',
        fontSize: 10,
        alignment: 'center',
        color: '#718096',
      },
      card: {
        margin: [0, 0, 0, 15],
      },
    },
    defaultStyle: {
      font: 'Roboto',
    },
  };

  const placeCards = assignedGuests.map(guest => {
    return {
      stack: [
        { text: guest.guestName, style: 'guestName' },
        { text: `桌号: ${guest.tableName}`, style: 'tableName' },
      ],
      style: 'card',
    };
  });

  const body = [];
  for (let i = 0; i < placeCards.length; i += 3) {
    const row = [];
    row.push(placeCards[i] || {});
    row.push(placeCards[i + 1] || {});
    row.push(placeCards[i + 2] || {});
    body.push(row);
  }
  docDefinition.content[0].table.body = body;

  pdfMake.createPdf(docDefinition).download(`${project.name}_桌卡.pdf`);
}
