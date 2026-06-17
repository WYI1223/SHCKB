import { expect, test } from '@playwright/test';
import { loginViaApi } from './fixtures/login';

test('login route renders and auth endpoint accepts dev creds', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'sign in' })).toBeVisible();
  await loginViaApi(page); // throws if the dev admin bootstrap failed
});
