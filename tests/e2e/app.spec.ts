import fs from 'node:fs';
import path from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';

const findExecutable = () => {
  const outRoot = path.resolve('out');
  const packageDirectory = fs
    .readdirSync(outRoot, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.includes(`${process.platform}-${process.arch}`));
  if (!packageDirectory) throw new Error('Packaged application directory was not found.');

  const root = path.join(outRoot, packageDirectory.name);
  return process.platform === 'win32'
    ? path.join(root, 'gate-2027-helper.exe')
    : path.join(root, 'gate-2027-helper');
};

test('launches and primary creation controls respond', async () => {
  const application = await electron.launch({ executablePath: findExecutable() });
  const page = await application.firstWindow();
  await expect(page.getByRole('heading', { name: /Build a calmer path/i })).toBeVisible();

  await page.getByRole('link', { name: 'PYQs & Mock Tests', exact: true }).dispatchEvent('click');
  await page.getByRole('button', { name: 'Import PDFs' }).click();
  await expect(page.getByRole('dialog', { name: 'Import a paper from PDFs' })).toBeVisible();
  await expect(page.getByPlaceholder('GATE CS 2026 Set 1')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Manual test' }).click();
  await expect(page.getByPlaceholder('Full-length mock test 1')).toBeVisible();

  await page.getByRole('link', { name: 'Syllabus', exact: true }).dispatchEvent('click');
  await page.getByRole('button', { name: /Add topic/i }).click();
  await expect(page.getByPlaceholder('Operating Systems')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('link', { name: 'AI Tutor', exact: true }).dispatchEvent('click');
  await expect(page.getByPlaceholder(/Type your GATE concept question/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import document PDF' })).toBeVisible();
  const newConversation = page.getByRole('button', { name: 'New conversation' });
  if (await newConversation.isEnabled()) {
    await newConversation.click();
    await expect(page.getByRole('button', { name: /New conversation knowledge/i })).toBeVisible();
  }
  await application.close();
});
