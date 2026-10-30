import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Authentication & Public Entry Points', () => {
  test('login page renders college institutional branding and login form', async ({ page }) => {
    await page.goto('/login');

    // Branding checks
    await expect(page).toHaveTitle(/CampusPlace|DYPCET/i);
    await expect(page.locator('text=D.Y. Patil College of Engineering & Technology')).toBeVisible();
    await expect(page.getByText('Training & Placement Cell', { exact: true }).first()).toBeVisible();

    // Form fields
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
  });

  test('rejects invalid login credentials with clear user error', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'nonexistent@dypcet.ac.in');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Should display invalid credentials error message
    const errorAlert = page.locator('text=Invalid email or password');
    await expect(errorAlert).toBeVisible({ timeout: 10000 });
  });

  test('passes axe-core accessibility audit on login page', async ({ page }) => {
    await page.goto('/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast']) // Ignore third-party brand subtle contrast if any
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toEqual([]);
  });
});
