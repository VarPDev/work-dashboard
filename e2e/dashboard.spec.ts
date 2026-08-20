import { expect, test, type Page } from '@playwright/test';

/**
 * These run against the live instance, so they assert on structure and
 * behaviour, never on a specific issue key or a fixed count — those change every
 * day.
 */

/** Rows are the only thing that carries a Jira issue link. */
function rows(page: Page) {
  return page.locator('a[href*="/browse/"]').filter({ hasText: /^[A-Z]+-\d+$/ });
}

/**
 * Pick somebody other than the default user from the picker, and return the name
 * shown. Nobody is hardcoded here: the tests must not carry real people's names
 * or account ids, and any instance has its own.
 */
async function selectAnotherUser(page: Page): Promise<string> {
  await page.getByRole('combobox').click();

  const options = page.getByRole('option');
  await expect(options.first()).toBeVisible();

  // The default user is marked "io" in the list; take the first one that is not.
  const other = options.filter({ hasNotText: 'io' }).first();
  const label = ((await other.textContent()) ?? '').replace(/\s+/g, ' ').trim();

  await other.click();
  return label;
}

async function waitForDashboard(page: Page) {
  await expect(page.getByRole('button', { name: /Aggiorna/ })).toBeEnabled();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

test('shows the default user with totals and one flat list', async ({ page }) => {
  await page.goto('/');
  await waitForDashboard(page);

  await expect(page.getByRole('heading', { name: 'Cosa devo fare adesso' })).toBeVisible();
  await expect(page.getByRole('combobox')).toContainText(/\w/);

  await expect(page.getByText(/\d+ assegnat[ae]/)).toBeVisible();
  await expect(page.getByText(/\d+ menzion[ei]/).first()).toBeVisible();
  await expect(page.getByText(/\d+ scadut[ae]/).first()).toBeVisible();

  expect(await rows(page).count()).toBeGreaterThan(0);
  // No colleague banner when looking at the default user.
  await expect(page.getByText(/Stai vedendo il carico di/)).toHaveCount(0);
});

test('shows a skeleton before the data lands', async ({ page }) => {
  // Hold the response so the loading state is observable.
  await page.route('**/api/tasks**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.continue();
  });

  await page.goto('/');
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  await waitForDashboard(page);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
});

test('the mentions filter shows only mentions, and assigned only assigned', async ({ page }) => {
  await page.goto('/');
  await waitForDashboard(page);

  const all = await rows(page).count();

  await page.getByRole('button', { name: 'Menzioni', exact: true }).click();
  const mentionRows = await rows(page).count();
  expect(mentionRows).toBeGreaterThan(0);
  // Every visible mention row links to the comment that mentions the user.
  expect(await page.getByRole('link', { name: /vai al commento/ }).count()).toBe(mentionRows);

  await page.getByRole('button', { name: 'Assegnate', exact: true }).click();
  const assignedRows = await rows(page).count();
  expect(assignedRows).toBeGreaterThan(0);
  await expect(page.getByRole('link', { name: /vai al commento/ })).toHaveCount(0);

  expect(mentionRows + assignedRows).toBe(all);
});

test('the overdue filter only keeps overdue items', async ({ page }) => {
  await page.goto('/');
  await waitForDashboard(page);

  const overdueTotal = await page
    .getByText(/^\d+ scadut[ae]$/)
    .first()
    .textContent();
  const expected = Number(overdueTotal?.match(/\d+/)?.[0] ?? '0');

  await page.getByRole('button', { name: 'Scadute', exact: true }).click();
  await expect(rows(page)).toHaveCount(expected);
});

test('switching user changes the URL, the data and warns about it', async ({ page }) => {
  await page.goto('/');
  await waitForDashboard(page);

  const mine = await rows(page).allTextContents();

  const name = await selectAnotherUser(page);

  await expect(page).toHaveURL(/\?user=/);
  await waitForDashboard(page);

  await expect(page.getByText(`Stai vedendo il carico di ${name}`)).toBeVisible();
  await expect(page.getByText('Nessuno di questi task è tuo.')).toBeVisible();

  const theirs = await rows(page).allTextContents();
  expect(theirs).not.toEqual(mine);

  await page.getByRole('button', { name: /Torna ai miei/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await waitForDashboard(page);
  await expect(page.getByText(/Stai vedendo il carico di/)).toHaveCount(0);
  expect(await rows(page).allTextContents()).toEqual(mine);
});

test('browser back returns to the previous user', async ({ page }) => {
  await page.goto('/');
  await waitForDashboard(page);

  await selectAnotherUser(page);
  await waitForDashboard(page);
  await expect(page.getByText(/Stai vedendo il carico di/)).toBeVisible();

  await page.goBack();
  await waitForDashboard(page);
  await expect(page.getByText(/Stai vedendo il carico di/)).toHaveCount(0);
});

test('an unknown accountId errors instead of showing an empty dashboard', async ({ page }) => {
  await page.goto('/?user=nope-not-an-account');

  await expect(page.getByText(/Non riesco a caricare le attività/)).toBeVisible();
  await expect(page.getByText(/No Jira user matches/)).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  // The empty state must not claim there is nothing to do.
  await expect(page.getByText(/Niente da fare/)).toHaveCount(0);
});

test('refresh asks the server to bypass the cache', async ({ page }) => {
  await page.goto('/');
  await waitForDashboard(page);

  const refreshRequest = page.waitForRequest((request) =>
    request.url().includes('/api/tasks') && request.url().includes('refresh=1'),
  );
  await page.getByRole('button', { name: /Aggiorna/ }).click();
  await refreshRequest;
  await waitForDashboard(page);

  expect(await rows(page).count()).toBeGreaterThan(0);
});

test('the board filter narrows the list to the picked boards', async ({ page }) => {
  await page.goto('/');
  await waitForDashboard(page);

  const total = await rows(page).count();
  const chips = page.getByTestId('board-chip');
  expect(await chips.count()).toBeGreaterThan(1);

  const first = chips.first();
  const firstCount = Number(await first.getAttribute('data-count'));
  await first.click();
  await expect(rows(page)).toHaveCount(firstCount);
  await expect(first).toHaveAttribute('aria-pressed', 'true');

  // Board filters are additive, not exclusive.
  const second = chips.nth(1);
  const secondCount = Number(await second.getAttribute('data-count'));
  await second.click();
  await expect(rows(page)).toHaveCount(firstCount + secondCount);

  await page.getByRole('button', { name: /Tutte le board/ }).click();
  await expect(rows(page)).toHaveCount(total);
});

test('the board filter combines with the kind filter', async ({ page }) => {
  await page.goto('/');
  await waitForDashboard(page);

  const chip = page.getByTestId('board-chip').first();
  const chipCount = Number(await chip.getAttribute('data-count'));
  await chip.click();

  await page.getByRole('button', { name: 'Menzioni', exact: true }).click();
  const mentionsOnBoard = await rows(page).count();
  expect(mentionsOnBoard).toBeLessThanOrEqual(chipCount);
  expect(await page.getByRole('link', { name: /vai al commento/ }).count()).toBe(mentionsOnBoard);
});

test('hiding a mention survives a reload, and can be undone', async ({ page }) => {
  await page.goto('/');
  await waitForDashboard(page);

  // Only mentions can be hidden, so work on that filter.
  await page.getByRole('button', { name: 'Menzioni', exact: true }).click();
  const before = await rows(page).count();
  expect(before).toBeGreaterThan(0);

  const key = (await rows(page).first().textContent())?.trim() ?? '';
  await page.getByRole('button', { name: `Nascondi ${key}` }).click();

  await expect(rows(page)).toHaveCount(before - 1);
  await expect(page.getByText(/menzion[ei] nascost[ae]/)).toBeVisible();

  // The state lives on the server, so a reload must not bring the row back.
  await page.reload();
  await waitForDashboard(page);
  await page.getByRole('button', { name: 'Menzioni', exact: true }).click();
  await expect(rows(page)).toHaveCount(before - 1);

  // It is still reachable, not lost.
  await page.getByRole('button', { name: 'Mostra', exact: true }).click();
  await expect(page.getByRole('button', { name: `Ripristina ${key}` })).toBeVisible();

  await page.getByRole('button', { name: /Ripristina tutte/ }).click();
  await expect(rows(page)).toHaveCount(before);
});

test('an assigned issue cannot be hidden', async ({ page }) => {
  await page.goto('/');
  await waitForDashboard(page);

  await page.getByRole('button', { name: 'Assegnate', exact: true }).click();
  await expect(rows(page).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Nascondi / })).toHaveCount(0);
});

test.describe('theme', () => {
  test.use({ colorScheme: 'dark' });

  test('follows a dark system by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});

test.describe('theme on a light system', () => {
  test.use({ colorScheme: 'light' });

  test('follows a light system by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('the toggle overrides the system and the choice survives a reload', async ({ page }) => {
    await page.goto('/');
    await waitForDashboard(page);

    const toggle = page.getByRole('button', { name: /^Tema:/ });
    await expect(toggle).toHaveAttribute('data-theme-mode', 'system');

    // system -> light -> dark
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-theme-mode', 'light');
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    await toggle.click();
    await expect(toggle).toHaveAttribute('data-theme-mode', 'dark');
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Dark on a light system must survive a reload, with no flash of the wrong
    // theme: the class is set before the first paint.
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('button', { name: /^Tema:/ })).toHaveAttribute(
      'data-theme-mode',
      'dark',
    );

    // ...and back to following the system.
    await page.getByRole('button', { name: /^Tema:/ }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});

test('never puts the token in the page', async ({ page }) => {
  await page.goto('/');
  await waitForDashboard(page);

  const html = await page.content();
  expect(html).not.toContain('ATATT');
  expect(html).not.toContain('JIRA_API_TOKEN');
  expect(html).not.toContain('Basic ');
});
