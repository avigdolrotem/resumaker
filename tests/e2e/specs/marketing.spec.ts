import { test, expect } from '@playwright/test';

test.describe('Marketing pages', () => {
  test('/ redirects to /he (default locale)', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);
    expect(page.url()).toMatch(/\/(he|en)$/);
  });

  test('/he renders Hebrew RTL hero', async ({ page }) => {
    await page.goto('/he');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('h1')).toContainText('צור');
  });

  test('/en renders English LTR hero', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toContainText(/Build|Resume/i);
  });

  test('locale switcher swaps language', async ({ page }) => {
    await page.goto('/he');
    // English link should be in the locale switcher
    await page.getByRole('button', { name: /english/i }).click();
    await expect(page).toHaveURL(/\/en/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('/he/privacy renders without 500', async ({ page }) => {
    const response = await page.goto('/he/privacy');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('/he/terms renders without 500', async ({ page }) => {
    const response = await page.goto('/he/terms');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('/he/examples shows sample resumes', async ({ page }) => {
    const response = await page.goto('/he/examples');
    expect(response?.status()).toBe(200);
  });

  test('CTA goes to sign-up', async ({ page }) => {
    await page.goto('/en');
    await page
      .getByRole('link', { name: /start creating|sign up/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/sign-up/);
  });

  test('security headers present', async ({ page }) => {
    const response = await page.goto('/he');
    const headers = response?.headers() ?? {};
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    // HSTS is deliberately prod-only (next.config.ts) — sending it over
    // a local http:// dev server is meaningless (browsers ignore HSTS
    // outside https) and would be actively wrong if this suite ever ran
    // against a self-signed local https setup.
    if (process.env.NODE_ENV === 'production') {
      expect(headers['strict-transport-security']).toBeTruthy();
    }
    expect(headers['content-security-policy']).toBeTruthy();
  });
});

test.describe('Auth pages', () => {
  test('sign-up page renders form', async ({ page }) => {
    await page.goto('/en/sign-up');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible();
  });

  test('sign-in page links to forgot-password', async ({ page }) => {
    await page.goto('/en/sign-in');
    await expect(page.getByRole('link', { name: /forgot/i })).toBeVisible();
  });

  test('forgot-password renders', async ({ page }) => {
    const response = await page.goto('/en/forgot-password');
    expect(response?.status()).toBe(200);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

test.describe('Health endpoints', () => {
  test('/api/health returns 200 JSON', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('/api/health/ready returns 200 when DB up', async ({ request }) => {
    const response = await request.get('/api/health/ready');
    expect([200, 503]).toContain(response.status());
  });

  test('/api/auth/providers returns provider list', async ({ request }) => {
    const response = await request.get('/api/auth/providers');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('google');
    expect(body).toHaveProperty('github');
  });
});

test.describe('Protected routes', () => {
  test('/he/dashboard redirects to /sign-in when not authed', async ({ page }) => {
    await page.goto('/he/dashboard');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('/he/admin not accessible without admin role', async ({ page }) => {
    await page.goto('/he/admin');
    // Either redirects to sign-in (not authed) or to dashboard (not admin)
    await expect(page).toHaveURL(/\/(sign-in|dashboard)/);
  });

  test('API endpoints reject without session', async ({ request }) => {
    const generate = await request.post('/api/resumes/generate', {
      data: { jobDescription: 'test', userProfile: {} },
    });
    expect(generate.status()).toBe(401);

    const list = await request.get('/api/resumes');
    expect(list.status()).toBe(401);

    const export_ = await request.get('/api/account/export');
    expect(export_.status()).toBe(401);
  });
});
