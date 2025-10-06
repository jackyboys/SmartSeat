import { test, expect } from '@playwright/test'

test.describe('Dashboard E2E', () => {
  test('AI seating modal and fallback works', async ({ page }) => {
    // 打开时带上 e2e=1 以触发跳过登录逻辑
    await page.goto('/dashboard?e2e=1')

    // 打开 AI 智能排座弹窗
    await page.getByRole('button', { name: '🤖 AI 智能排座' }).click()

    // 在弹窗中粘贴 12 行名单
  const names = Array.from({ length: 12 }, (_, i) => `测试用户${i + 1}`).join('\n')
  await page.getByPlaceholder('在此粘贴您的完整宾客名单...').fill(names)

    // 触发生成
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/generate-seating') && r.status() === 200),
      page.getByRole('button', { name: '开始生成' }).click(),
    ])
    expect(await resp.ok()).toBeTruthy()

    // 验证至少有 1 张桌子渲染
    const tableCards = page.locator('[data-testid="table-card"]')
    await expect(tableCards.first()).toBeVisible()
  })
})
