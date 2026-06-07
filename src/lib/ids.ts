import { customAlphabet } from 'nanoid';

/**
 * 57 visually unambiguous characters (no 0/O/1/l/I). At 12 chars long that's
 * ~70 bits of entropy - well past "unguessable" for share-link IDs, while
 * staying short enough to read aloud or paste in chat.
 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export const CLIP_ID_LENGTH = 12;

export const newClipId = customAlphabet(ALPHABET, CLIP_ID_LENGTH);

const ID_PATTERN = new RegExp(`^[${ALPHABET}]{${CLIP_ID_LENGTH}}$`);

/** True iff the string is plausibly one of our IDs. Used to reject obviously
 * malformed URL params before a DB round-trip. */
export function isValidClipId(id: string): boolean {
  return ID_PATTERN.test(id);
}
