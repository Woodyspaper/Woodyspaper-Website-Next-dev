import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Keep the suite focused on Woody's Paper behavior instead of the live POS widget.
  await page.route('https://app.business.shop/script.js**', route => route.abort())
})

for (const width of [1280, 390]) {
  test(`header search and categories navigate from a catalog-free home at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route('**/api/catalog/categories', route => route.fulfill({
      json: [{ id: 123, name: 'PAPER' }, { id: 456, name: 'ENVELOPES' }],
    }))
    await page.goto('/')
    await expect(page.locator('main').getByRole('heading', { name: 'Inventory', exact: true })).toHaveCount(0)
    await expect(page.locator('main').getByLabel('Search products', { exact: true })).toHaveCount(0)
    const search = page.getByRole('search', { name: 'Header product search' })
    await search.getByRole('searchbox', { name: 'Search catalog', exact: true }).fill('napkin')
    await search.getByRole('button', { name: 'Search catalog', exact: true }).click()
    await expect(page).toHaveURL(/\/inventory\?q=napkin$/)
    await page.getByTestId('button-all-categories').click()
    await page.locator('#category-panel').getByRole('link', { name: 'Paper', exact: true }).click()
    await expect(page).toHaveURL(/\/inventory\?filter.category=123$/)
    await expect(page.getByTestId('button-all-categories')).toHaveAttribute('aria-expanded', 'false')
    await search.getByRole('searchbox', { name: 'Search catalog', exact: true }).fill('white')
    await search.getByRole('button', { name: 'Search catalog', exact: true }).click()
    await expect(page).toHaveURL(/filter.category=123&q=white/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

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

test('catalog facet filters combine, survive reload, and clear', async ({ page }) => {
  await page.route('**/api/catalog/products**', async route => {
    const url = new URL(route.request().url())
    const selected = JSON.parse(url.searchParams.get('filters') || '{}')
    await route.fulfill({
      json: {
        items: [{
          id: 1,
          name: 'Filtered paper',
          sku: null,
          price: 10,
          priceFormatted: '$10',
          inStock: true,
          imageUrl: null,
          productUrl: null,
        }],
        total: Object.keys(selected).length ? 1 : 30,
        limit: 24,
        offset: Number(url.searchParams.get('offset') || 0),
        facets: testFacets,
      },
    })
  })

  await page.goto('/inventory')
  await page.getByLabel('Category', { exact: true }).selectOption('paper')
  await page.getByLabel('Brand', { exact: true }).selectOption('Acme')
  await expect(page).toHaveURL(/filter.category=paper.*filter.brand=Acme/)
  await page.reload()
  await expect(page.getByLabel('Category', { exact: true })).toHaveValue('paper')
  await expect(page.getByLabel('Brand', { exact: true })).toHaveValue('Acme')
  await page.getByRole('button', { name: 'Clear all filters' }).click()
  await expect(page).toHaveURL(/\/inventory$/)
  await expect(page.getByLabel('Brand', { exact: true })).toHaveValue('')
})

test('catalog search, category, availability, and price filters work with paging', async ({ page }) => {
  const requests: URL[] = []
  await page.route('**/api/catalog/products**', async route => {
    const url = new URL(route.request().url())
    requests.push(url)
    const offset = Number(url.searchParams.get('offset') || 0)
    const product = offset > 0
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
      json: {
        items: [product],
        total: 73,
        limit: 24,
        offset,
        facets: testFacets,
      },
    })
  })

  await page.goto('/inventory')
  await expect(page.getByRole('heading', { name: 'Folded napkin' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'First', exact: true })).toHaveText('1')
  await expect(page.getByRole('button', { name: 'Last', exact: true })).toHaveText('4')
  await expect(page.getByRole('button', { name: 'First', exact: true })).toBeDisabled()
  await expect(page.getByText('SKU: NAP-01')).toBeVisible()
  await expect(page.getByRole('link', { name: 'View and order' })).toHaveAttribute(
    'href',
    'https://woodyspaper.com/products/folded-napkin',
  )
  await page.getByLabel('Search products').fill('napkin')
  await page.getByLabel('Category', { exact: true }).selectOption('17')
  await page.getByLabel('Availability', { exact: true }).selectOption('in-stock')
  await page.getByLabel('Minimum price').fill('1')
  await page.getByLabel('Maximum price').fill('3')
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click()
  await expect(page).toHaveURL(/q=napkin/)
  await expect(page).toHaveURL(/filter.category=17/)
  await expect(page).toHaveURL(/filter.availability=in-stock/)
  await expect(page).toHaveURL(/minPrice=1/)
  await expect(page).toHaveURL(/maxPrice=3/)
  await page.reload()
  await expect(page.getByLabel('Search products')).toHaveValue('napkin')
  await expect(page.getByLabel('Category', { exact: true })).toHaveValue('17')
  await expect(page.getByLabel('Availability', { exact: true })).toHaveValue('in-stock')
  await expect(page.getByLabel('Minimum price')).toHaveValue('1')
  await expect(page.getByLabel('Maximum price')).toHaveValue('3')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Paper towel roll' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'First', exact: true })).toHaveText('2')
  expect(requests.some(url => url.searchParams.get('q') === 'napkin')).toBe(true)
  expect(requests.some(url => {
    const filters = JSON.parse(url.searchParams.get('filters') || '{}')
    return filters.category === '17' &&
      filters.availability === 'in-stock' &&
      url.searchParams.get('minPrice') === '1' &&
      url.searchParams.get('maxPrice') === '3'
  })).toBe(true)
  expect(requests.some(url => url.searchParams.get('offset') === '24')).toBe(true)
  await page.getByRole('button', { name: 'Last', exact: true }).click()
  await expect(page.getByRole('button', { name: 'First', exact: true })).toHaveText('4')
  await expect(page).toHaveURL(/offset=72/)
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'First', exact: true }).click()
  await expect(page.getByRole('button', { name: 'First', exact: true })).toHaveText('1')
  await expect(page).not.toHaveURL(/offset=/)
  await expect(page).toHaveURL(/filter.category=17/)
  await expect(page).toHaveURL(/filter.availability=in-stock/)
})

test('catalog sort survives paging, reload, history and filter changes', async ({ page }) => {
  const requests: URL[] = []
  await page.route('**/api/catalog/products**', async route => {
    const url = new URL(route.request().url())
    requests.push(url)
    await route.fulfill({ json: {
      items: [{ id: 1, name: 'Paper', sku: null, price: 10, priceFormatted: '$10',
        inStock: true, imageUrl: null, productUrl: null }],
      total: 50, limit: 24, offset: Number(url.searchParams.get('offset') || 0), facets: testFacets,
    } })
  })
  await page.goto('/inventory?q=paper&filter.category=17&minPrice=1&maxPrice=20&offset=24')
  for (const sort of ['name-asc', 'name-desc', 'price-asc', 'price-desc']) {
    await page.getByLabel('Sort by').selectOption(sort)
    await expect(page).toHaveURL(new RegExp(`sort=${sort}`))
    await expect(page).not.toHaveURL(/offset=/)
    await expect.poll(() => requests.at(-1)?.searchParams.get('sort')).toBe(sort)
    const params = requests.at(-1)!.searchParams
    expect(params.get('q')).toBe('paper')
    expect(params.get('minPrice')).toBe('1')
    expect(params.get('maxPrice')).toBe('20')
    expect(JSON.parse(params.get('filters')!)).toEqual({ category: '17' })
  }
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/offset=24/)
  await expect(page.getByText('50 products', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Sort by')).toHaveValue('price-desc')
  await expect.poll(() => requests.at(-1)?.searchParams.get('offset')).toBe('24')
  expect(requests.at(-1)?.searchParams.get('sort')).toBe('price-desc')
  await page.getByLabel('Sort by').selectOption('name-asc')
  await expect(page).not.toHaveURL(/offset=/)
  await page.goBack()
  await expect(page.getByLabel('Sort by')).toHaveValue('price-desc')
  await expect(page).toHaveURL(/offset=24/)
  await page.getByLabel('Availability', { exact: true }).selectOption('in-stock')
  await expect(page).toHaveURL(/sort=price-desc/)
  await expect(page).not.toHaveURL(/offset=/)
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(page).toHaveURL(/\/inventory\?sort=price-desc$/)
  await page.getByLabel('Sort by').selectOption('')
  await expect(page).toHaveURL(/\/inventory$/)
  await expect.poll(() => requests.at(-1)?.searchParams.has('sort')).toBe(false)
})

const testFacets = [
  { key: 'category', label: 'Category', options: [
    { value: 'paper', label: 'Paper', count: 1 },
    { value: '17', label: 'Paper products', count: 1 },
  ] },
  { key: 'availability', label: 'Availability', options: [
    { value: 'in-stock', label: 'In stock', count: 1 },
    { value: 'out-of-stock', label: 'Out of stock', count: 0 },
  ] },
  { key: 'brand', label: 'Brand', options: [
    { value: 'Acme', label: 'Acme', count: 1 },
  ] },
]
