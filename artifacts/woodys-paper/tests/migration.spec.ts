import { test, expect } from '@playwright/test'

test('home, inventory, history and inquiry preserve the imported flows', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sustainably Sourced')
  await expect(page.getByRole('banner').getByAltText("Woody's Paper — home")).toBeVisible()
  await expect(page.getByRole('banner').getByAltText("Woody's Paper — home")).toHaveJSProperty('naturalWidth', 360)
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Inventory', exact: true }).click()
  await expect(page).toHaveURL(/\/inventory$/)
  await expect(page).toHaveTitle("Inventory Hub | Woody's Paper")
  await page.reload()
  await expect(page).toHaveTitle("Inventory Hub | Woody's Paper")
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Supply Inquiry' }).click()
  await expect(page.getByLabel('Business name')).toBeInViewport()
  await page.goBack()
  await expect(page).toHaveURL(/\/inventory$/)
  await page.goto('/inventory?q=napkins&account=1')
  await expect(page).toHaveURL(/q=napkins&account=1/)
  await page.goto('/unknown-imported-route')
  await expect(page).toHaveURL(/\/$/)
  let requests = 0
  await page.route('https://formsubmit.co/**', async route => {
    requests++
    await route.fulfill({ json: { success: true } })
  })
  await page.getByRole('button', { name: 'Send Inquiry', exact: true }).click()
  expect(requests).toBe(0)
  await page.getByLabel('Business name').fill('Migration browser test')
  await page.getByLabel('Contact email').fill('migration@example.com')
  await page.getByLabel('Product list').fill('Paper towels and packaging')
  // Existing source requires at least three seconds before accepting the form.
  await page.waitForTimeout(3100)
  await page.getByRole('button', { name: 'Send Inquiry', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Inquiry sent.' })).toBeVisible()
  expect(requests).toBe(1)
  await page.getByRole('button', { name: 'Send another inquiry' }).click()
  await expect(page.getByLabel('Business name')).toHaveValue('')
  await page.route('https://formsubmit.co/**', async route => {
    await route.fulfill({ status: 503, json: { success: false, message: 'Test mail service unavailable' } })
  })
  await page.getByLabel('Business name').fill('Migration browser test')
  await page.getByLabel('Contact email').fill('migration@example.com')
  await page.getByLabel('Product list').fill('Paper towels')
  await page.waitForTimeout(3100)
  await page.getByRole('button', { name: 'Send Inquiry', exact: true }).click()
  const inquiryError = page.locator('form [role="alert"]')
  await expect(inquiryError).toContainText('Test mail service unavailable')
  await expect(inquiryError.getByRole('link')).toHaveAttribute('href', /^mailto:/)
  expect(errors).toEqual([])
})

test('mobile navigation opens, navigates and closes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const toggle = page.getByRole('button', { name: 'Toggle navigation' })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.locator('#mobile-menu').getByRole('link', { name: 'Inventory', exact: true }).click()
  await expect(page).toHaveURL(/\/inventory$/)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('catalog products load through the API and search updates the URL', async ({ page }) => {
  const requests: URL[] = []
  await page.route('**/api/catalog/products**', async route => {
    const url = new URL(route.request().url())
    requests.push(url)
    const secondPage = Number(url.searchParams.get('offset')) > 0
    const product = secondPage
      ? {
          id: 202,
          name: 'Paper towel roll',
          sku: 'TOWEL-02',
          price: 2.5,
          priceFormatted: '$2.50',
          inStock: false,
          imageUrl: null,
          productUrl: 'https://woodyspaper.com/products/paper-towel-roll',
        }
      : {
          id: 101,
          name: 'Folded napkin',
          sku: 'NAP-01',
          price: 1.25,
          priceFormatted: '$1.25',
          inStock: true,
          imageUrl: null,
          productUrl: 'https://woodyspaper.com/products/folded-napkin',
        }
    await route.fulfill({
      json: { items: [product], total: 25, limit: 24, offset: secondPage ? 24 : 0 },
    })
  })

  await page.goto('/inventory')
  await expect(page.getByRole('heading', { name: 'Folded napkin' })).toBeVisible()
  await expect(page.getByText('SKU: NAP-01')).toBeVisible()
  await expect(page.getByRole('link', { name: 'View and order' })).toHaveAttribute(
    'href',
    'https://woodyspaper.com/products/folded-napkin',
  )
  await page.getByLabel('Search products').fill('napkin')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page).toHaveURL(/q=napkin/)
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('heading', { name: 'Paper towel roll' })).toBeVisible()
  expect(requests.some(url => url.searchParams.get('q') === 'napkin')).toBe(true)
  expect(requests.some(url => url.searchParams.get('offset') === '24')).toBe(true)
})
