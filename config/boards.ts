/**
 * Board grouping configuration.
 *
 * In Jira an issue has no "board" field: boards are saved filters, so an issue
 * can sit on several boards or on none. On the instance this was measured
 * against, 20 of 65 issues were on more than one board, which makes the
 * tie-break decide the board column for roughly a third of the rows.
 */

/**
 * Boards listed here win, in this order, when an issue belongs to several.
 * Names must match the Jira board name exactly.
 *
 * Empty by default: with no names listed, the tie-break still resolves — a board
 * in the issue's own project beats a cross-project one, then the lowest board id
 * wins — so it is deterministic either way. Fill it in only when you disagree
 * with that outcome, e.g.
 *
 *   export const BOARD_PRIORITY: string[] = ['Team Dev Board', 'Design Cross'];
 */
export const BOARD_PRIORITY: string[] = [];

/**
 * Only query boards whose own project is one of the projects in the issue set.
 * On the measured instance that was 13 boards instead of 35, with identical
 * coverage: the cross-project boards only ever added a second board to issues
 * that already had one.
 *
 * Set to false if an issue ever shows up under "no board" that you know lives on
 * a cross-project board.
 */
export const RESTRICT_BOARDS_TO_ISSUE_PROJECTS = true;
