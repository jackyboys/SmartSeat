import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const gotoDashboard = async (page: any) => {
  await page.goto('/dashboard?e2e=1')
  await expect(page.locator('#main-editor-area')).toBeVisible()
}

test.describe('Dashboard - 全量检查点', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', async (d) => { await d.accept() })
  })

  test('项目：新建 -> 重命名 -> 保存 -> 删除临时项目', async ({ page }) => {
    await gotoDashboard(page)

    await page.getByTestId('btn-new-project').click()
    await page.getByPlaceholder('请输入项目名称').fill('测试项目-自动化')
    await page.getByRole('button', { name: '创建', exact: true }).click()

    const nameInput = page.getByTestId('project-name')
    await expect(nameInput).toHaveValue('测试项目-自动化')

    // 重命名并保存
    await nameInput.fill('测试项目-自动化-重命名')
    await page.getByTestId('btn-save-project').click()
    await expect(page.getByText('项目已成功保存！')).toBeVisible()

    // 删除当前（临时 id -1）项目
    // 点击侧边项目列表第一项的垃圾桶（当前项目）
    const firstItem = page.locator('aside.w-64 .group').first()
    await firstItem.hover()
    await firstItem.getByText('🗑️').click()
    await expect(page.getByText('项目已成功删除')).toBeVisible()
  })

  test('宾客与桌子：添加/重命名/删除/拖拽', async ({ page }) => {
    await gotoDashboard(page)

    // 添加三位宾客
    await page.getByTestId('btn-add-guest').click()
    await page.getByPlaceholder('每行输入一位宾客姓名').fill('甲\n乙\n丙')
    await page.getByRole('button', { name: '添加', exact: true }).click()
    const unassigned = page.getByTestId('unassigned-list').getByTestId('guest-item')
    await expect(unassigned).toHaveCount(3)

    // 添加两张桌子
    await page.getByTestId('btn-add-table').click()
    await page.getByPlaceholder('请输入桌子名称').fill('第1桌')
    await page.getByRole('button', { name: '添加', exact: true }).click()
    await page.getByTestId('btn-add-table').click()
    await page.getByPlaceholder('请输入桌子名称').fill('第2桌')
    await page.getByRole('button', { name: '添加', exact: true }).click()
    const tables = page.locator('[data-testid="table-card"]')
    await expect(tables).toHaveCount(2)

    // 重命名第2桌
    const table2Name = tables.nth(1).locator('input[type="text"]').first()
    await table2Name.fill('第2桌-改')

    // 拖拽“甲”到第1桌
    const firstGuest = unassigned.first()
    await firstGuest.dragTo(tables.nth(0))

    // 删除第2桌，确认宾客回收（第2桌可能为空，这里只校验桌子数量变更）
    await tables.nth(1).hover()
    await tables.nth(1).getByText('🗑️').click()
    await expect(page.locator('[data-testid="table-card"]')).toHaveCount(1)
  })

  test('从文件导入：宾客 CSV 与桌子 CSV；统计更新', async ({ page }) => {
    await gotoDashboard(page)

    const mkfile = (name: string, content: string) => {
      const p = path.join(os.tmpdir(), name)
      fs.writeFileSync(p, content, 'utf-8')
      return p
    }

    // 导入宾客 CSV
    await page.getByTestId('btn-add-guest').click()
    await page.getByRole('button', { name: '从文件导入' }).click()
    const guestCsv = mkfile('guests.csv', '赵\n钱\n孙\n李')
    await page.locator('input[type="file"]').setInputFiles(guestCsv)
    await expect(page.getByText('成功导入 4 个条目！')).toBeVisible()

    // 导入桌子 CSV
    await page.getByTestId('btn-add-table').click()
    await page.getByRole('button', { name: '从文件导入' }).click()
    const tableCsv = mkfile('tables.csv', '第A桌\n第B桌')
    await page.locator('input[type="file"]').setInputFiles(tableCsv)
    await expect(page.getByText('成功导入 2 个条目！')).toBeVisible()

    // 统计区域应可见并包含“宾客总数/桌子总数”
    await expect(page.getByText('数据统计')).toBeVisible()
    await expect(page.getByText('宾客总数:')).toBeVisible()
    await expect(page.getByText('桌子总数:')).toBeVisible()
  })

  test('导出 PDF 触发下载', async ({ page, context }) => {
    await gotoDashboard(page)
    await page.getByTestId('project-name').fill('自动化导出项目')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('btn-export-pdf').click(),
    ])
    const suggested = download.suggestedFilename()
    expect(suggested.endsWith('.pdf')).toBeTruthy()
  })

  test('AI 智能排座（12 人分桌）', async ({ page }) => {
    await gotoDashboard(page)
    await page.getByTestId('btn-ai-seating').click()
    const names = Array.from({ length: 12 }, (_, i) => `成员${i + 1}`).join('\n')
    await page.getByPlaceholder('在此粘贴您的完整宾客名单...').fill(names)

    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/generate-seating') && r.status() === 200),
      page.getByRole('button', { name: '开始生成' }).click(),
    ])
    expect(await resp.ok()).toBeTruthy()
    await expect(page.locator('[data-testid="table-card"]').first()).toBeVisible()
  })
})
