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

async function waitForDashboard(page: Page, refreshLabel = 'Aggiorna') {
  await expect(page.getByRole('button', { name: new RegExp(refreshLabel) })).toBeEnabled();
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
  // The message is translated client-side from the error code, so it follows the
  // reader's language rather than the server's.
  await expect(page.getByText(/Nessun utente Jira corrisponde/)).toBeVisible();
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

test.describe('search', () => {
  test('narrows the list, tolerates a typo, and clears', async ({ page }) => {
    await page.goto('/');
    await waitForDashboard(page);

    const total = await rows(page).count();
    const box = page.getByTestId('search-box');

    // Take a word from the first row's summary and look for it.
    const firstSummary = ((await rows(page).first().locator('..').textContent()) ?? '').trim();
    const word = (firstSummary.match(/[A-Za-z]{6,}/) ?? ['the'])[0];

    await box.fill(word);
    const found = await rows(page).count();
    expect(found).toBeGreaterThan(0);
    expect(found).toBeLessThan(total);

    // The same word with a letter dropped must still find something: this is the
    // whole point of a fuzzy index rather than a substring filter.
    await box.fill(word.slice(0, 3) + word.slice(4));
    expect(await rows(page).count()).toBeGreaterThan(0);

    // Nonsense finds nothing, and says so instead of showing everything.
    await box.fill('zzzzqqqqwwww');
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByText(/Nessun risultato per/)).toBeVisible();

    await page.getByRole('button', { name: /Cancella la ricerca/ }).click();
    await expect(rows(page)).toHaveCount(total);
  });

  test('finds a row by its issue key, and combines with the filters', async ({ page }) => {
    await page.goto('/');
    await waitForDashboard(page);

    const key = ((await rows(page).first().textContent()) ?? '').trim();
    await page.getByTestId('search-box').fill(key);

    await expect(rows(page).first()).toHaveText(key);

    // A filter that excludes the match leaves nothing, rather than ignoring one
    // of the two conditions.
    const kinds = ['Assegnate', 'Menzioni'];
    const counts: number[] = [];
    for (const kind of kinds) {
      await page.getByRole('button', { name: kind, exact: true }).click();
      counts.push(await rows(page).count());
    }
    expect(counts.filter((count) => count > 0)).toHaveLength(1);
  });

  test('the slash key focuses the search box', async ({ page }) => {
    await page.goto('/');
    await waitForDashboard(page);

    await page.keyboard.press('/');
    await expect(page.getByTestId('search-box')).toBeFocused();

    // And Escape empties it.
    await page.keyboard.type('hotspot');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('search-box')).toHaveValue('');
  });
});

test.describe('new since last look', () => {
  test('badges the rows that changed, and clears when marked as seen', async ({ page }) => {
    await page.goto('/');
    await waitForDashboard(page);

    // Acknowledge everything: from here on, nothing is new.
    type Row = { issue: { key: string; updated: string }; mention: { commentId: string } | null };
    const payload = (await (await page.request.get('/api/tasks')).json()) as { items: Row[] };
    expect(payload.items.length).toBeGreaterThan(1);

    // The same marker the app computes: the comment for a mention, the update
    // time for assigned work.
    const marker = (row: Row) =>
      row.mention ? `comment:${row.mention.commentId}` : `updated:${row.issue.updated}`;

    const all = Object.fromEntries(payload.items.map((row) => [row.issue.key, marker(row)]));

    await page.request.post('/api/seen', { data: { seen: all } });
    await page.reload();
    await waitForDashboard(page);
    await expect(page.locator('[data-new-badge]')).toHaveCount(0);
    await expect(page.getByTestId('new-count')).toHaveCount(0);

    // Now forget one row, which is what a fresh comment or a new issue looks
    // like from the dashboard's point of view.
    const partial = { ...all };
    delete partial[payload.items[0].issue.key];
    await page.request.post('/api/seen', { data: { seen: partial } });

    await page.reload();
    await waitForDashboard(page);
    await expect(page.locator('[data-new-badge]')).toHaveCount(1);
    await expect(page.getByTestId('new-count')).toContainText('1');

    // The filter keeps only what is new, and combines with the board chips.
    await page.getByRole('button', { name: 'Novità', exact: true }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator('[data-new-badge]')).toHaveCount(1);

    await page.getByRole('button', { name: 'Tutte', exact: true }).click();
    expect(await rows(page).count()).toBeGreaterThan(1);

    // Marking as seen clears it, without a refetch.
    await page.getByRole('button', { name: /Segna come viste/ }).click();
    await expect(page.locator('[data-new-badge]')).toHaveCount(0);

    // And it stays cleared across a reload, because it is stored server-side.
    await page.reload();
    await waitForDashboard(page);
    await expect(page.locator('[data-new-badge]')).toHaveCount(0);
  });
});

test.describe('language', () => {
  test('follows the browser language, and lets you change it', async ({ page }) => {
    await page.goto('/');
    await waitForDashboard(page);

    // The context locale is it-IT, so Italian is what the browser asked for.
    const picker = page.getByRole('button', { name: 'Lingua' });
    await expect(picker).toHaveAttribute('data-locale', 'it');
    await expect(page.getByRole('button', { name: 'Menzioni', exact: true })).toBeVisible();

    await picker.click();
    await page.locator('[data-locale-option="de"]').click();

    // Every visible string follows, and so does the document language.
    await expect(page.getByRole('button', { name: 'Erwähnungen', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Was ist jetzt zu tun' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    // The choice outlives a reload.
    await page.reload();
    await waitForDashboard(page, 'Aktualisieren');
    await expect(page.getByRole('button', { name: 'Sprache' })).toHaveAttribute('data-locale', 'de');

    // And English is one click away.
    await page.getByRole('button', { name: 'Sprache' }).click();
    await page.locator('[data-locale-option="en"]').click();
    await expect(page.getByRole('button', { name: 'Mentions', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Refresh/ })).toBeVisible();

    // Put it back, so the other tests find the language they expect.
    await page.getByRole('button', { name: 'Language' }).click();
    await page.locator('[data-locale-option="it"]').click();
    await expect(page.getByRole('button', { name: /Aggiorna/ })).toBeVisible();
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
