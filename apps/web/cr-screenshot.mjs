import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// Login as head
await page.goto('http://localhost:3000/auth/dev-login?role=head');
await page.waitForTimeout(2000);

// Admin page (static, no API needed)
await page.goto('http://localhost:3000/admin');
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/cr-admin.png', fullPage: false });
console.log('Admin URL:', page.url());

// Login page
await page.goto('http://localhost:3000');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/cr-login.png', fullPage: false });
console.log('Login URL:', page.url());

await browser.close();
