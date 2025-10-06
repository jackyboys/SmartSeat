import { test, expect } from '@playwright/test'

// 该用例集按“由上到下”的顺序覆盖核心功能，适配你的测试计划 PDF
// 默认使用 E2E 跳过登录模式（访问 /dashboard?e2e=1）

const gotoDashboard = async (page: any) => {
  await page.goto('/dashboard?e2e=1')
  await expect(page.locator('#main-editor-area')).toBeVisible()
}

test.describe('Dashboard - 顺序回归', () => {
  test('1. 进入 dashboard（跳过登录）', async ({ page }) => {
    await gotoDashboard(page)
    await expect(page.getByText('控制面板')).toBeVisible()
  })

  test('2. 添加宾客 -> 添加桌子 -> 拖拽 -> 保存项目', async ({ page }) => {
    await gotoDashboard(page)

    // 打开“添加宾客”并输入三人
  await page.getByTestId('btn-add-guest').click()
  await page.getByPlaceholder('每行输入一位宾客姓名').fill('张三\n李四\n王五')
  const modal1 = page.locator('div.fixed.inset-0')
  await modal1.getByRole('button', { name: '添加', exact: true }).click()
    await expect(page.getByTestId('unassigned-list').getByTestId('guest-item')).toHaveCount(3)

    // 添加一张桌子
  await page.getByTestId('btn-add-table').click()
  await page.getByPlaceholder('请输入桌子名称').fill('第1桌')
  const modal2 = page.locator('div.fixed.inset-0')
  await modal2.getByRole('button', { name: '添加', exact: true }).click()
    await expect(page.locator('[data-testid="table-card"]')).toHaveCount(1)

    // 拖拽第一位宾客到第1桌
    const firstGuest = page.getByTestId('unassigned-list').getByTestId('guest-item').first()
    const tableCard = page.locator('[data-testid="table-card"]').first()
    await firstGuest.dragTo(tableCard)

    // 修改项目名，触发“有变更”
    await page.getByTestId('project-name').fill('测试项目 A')

    // 保存
    await page.getByTestId('btn-save-project').click()
    await expect(page.getByText('项目已成功保存！')).toBeVisible()
  })

  test('3. AI 智能排座（本地/AI均可通过）', async ({ page }) => {
    await gotoDashboard(page)
    await page.getByTestId('btn-ai-seating').click()
    const names = Array.from({ length: 12 }, (_, i) => `用户${i + 1}`).join('\n')
    await page.getByPlaceholder('在此粘贴您的完整宾客名单...').fill(names)

    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/generate-seating') && r.status() === 200),
      page.getByRole('button', { name: '开始生成' }).click(),
    ])
    expect(await resp.ok()).toBeTruthy()

    await expect(page.locator('[data-testid="table-card"]').first()).toBeVisible()
  })
})
