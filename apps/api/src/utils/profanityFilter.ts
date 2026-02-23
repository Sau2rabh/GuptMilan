/**
 * Profanity filter utility.
 * Uses a simple blocklist approach. Can be extended with an AI moderation API.
 */

const BLOCKED_WORDS = [
  'fuck', 'shit', 'asshole', 'bitch', 'cunt', 'dick', 'pussy', 'bastard',
  'motherfucker', 'faggot', 'nigger', 'nigga', 'whore', 'slut', 'retard',
  'rape', 'kill yourself', 'kys', 'go die',
];

/**
 * Check if a message contains profanity
 */
export function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((word) => lower.includes(word));
}

/**
 * Censor profanity in a message, replacing matched words with asterisks
 */
export function censorMessage(text: string): string {
  let result = text;
  for (const word of BLOCKED_WORDS) {
    const regex = new RegExp(word, 'gi');
    result = result.replace(regex, '*'.repeat(word.length));
  }
  return result;
}
