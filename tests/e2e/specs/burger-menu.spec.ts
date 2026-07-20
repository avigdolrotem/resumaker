import { test, expect } from '@playwright/test';

/**
 * Burger-menu regression suite (live prod).
 *
 * Symptom: PR #13 fixed the RTL slide animation, but operator reported
 * on 2026-05-27 that the drawer was still "really small and unusable" —
 * opening at a tiny clipped size with the page bleeding through. Root
 * cause: the marketing header's `backdrop-blur-xl` ancestor created a
 * CSS containing block, so `position: fixed` anchored to the 64px
 * header bar instead of the viewport. Drawer panel was 85% × 64px ≈
 * tall × narrow.
 *
 * PR #15 fixed it by portaling the overlay to document.body via
 * React.createPortal. This spec guards the regression.
 *
 * Runs against the live prod URL — pass E2E_BASE_URL=https://resumaker.co.il.
 */

const VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-12', width: 390, height: 844 },
  { name: 'pixel-5', width: 393, height: 851 },
];

const LOCALES = ['he', 'en'];

for (const vp of VIEWPORTS) {
  for (const locale of LOCALES) {
    test(`burger menu opens full-size @ ${vp.name} / ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`/${locale}`);
      await page.waitForLoadState('domcontentloaded');

      // Open the burger. Aria-labels are locale-aware (mobile-drawer.tsx
      // uses the `mobileDrawer` translation namespace), so the expected
      // accessible name differs by locale rather than always being English.
      const openMenuName = locale === 'he' ? 'פתח תפריט' : /open menu/i;
      const burger = page.getByRole('button', { name: openMenuName });
      await expect(burger).toBeVisible();
      await burger.click();

      // Dialog opens.
      const navMenuName = locale === 'he' ? 'תפריט ניווט' : /navigation menu/i;
      const dialog = page.getByRole('dialog', { name: navMenuName });
      await expect(dialog).toBeVisible();

      // Find the inner panel.
      const panel = page.locator('.resumaker-drawer-panel');
      await expect(panel).toBeVisible();

      const box = await panel.boundingBox();
      if (!box) throw new Error('panel boundingBox is null');

      // Panel width ≥75% of viewport (this catches the narrow-strip bug).
      expect(
        box.width,
        `panel width was ${box.width}px, expected ≥${vp.width * 0.75}px`,
      ).toBeGreaterThanOrEqual(vp.width * 0.75);

      // Panel height ≥80% of viewport. THIS is the assertion that catches
      // the containing-block regression directly — the original bug had
      // the panel anchored to a 64px parent, giving height ≈54px.
      expect(
        box.height,
        `panel height was ${box.height}px, expected ≥${vp.height * 0.8}px — this is the containing-block regression`,
      ).toBeGreaterThanOrEqual(vp.height * 0.8);

      // Close via Escape.
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 2000 });
    });
  }
}
