/**
 * Priority ranking.
 *
 * Priorities must never be sorted by name. Jira returns them already ordered,
 * most urgent first — on this instance:
 *   Highest(1), High(2), Medium(3), Low(4), Very Low(10000), Not Clear(10001)
 *
 * The ids show why the API order is the only trustworthy source: 10000 and 10001
 * are custom additions and say nothing about urgency.
 */

/**
 * Manual override, most urgent first. Names must match Jira exactly.
 * Priorities missing from this list keep Jira's own order, ranked after every
 * name listed here. Empty the array to trust Jira completely.
 *
 * The one change against Jira's order: "Not Clear" sits above "Low" instead of
 * dead last. An issue whose priority nobody has decided yet should be looked at,
 * not buried under "Very Low".
 */
export const PRIORITY_ORDER: string[] = [
  'Highest',
  'High',
  'Medium',
  'Not Clear',
  'Low',
  'Very Low',
];
