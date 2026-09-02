export const HAMSTER_KIT_STYLE = "hamster-kit";

export const HAMSTER_KIT_NAMES = [
  "rabbit",
  "cat",
  "bear",
  "panda",
  "fox",
  "dino",
  "pig",
  "chick",
  "reindeer",
  "elephant",
  "penguin",
  "koala",
  "tiger",
  "lion",
  "unicorn",
  "octopus",
  "bee",
  "frog",
  "dog",
  "shark",
  "sleepy",
] as const;

export type HamsterKitName = (typeof HAMSTER_KIT_NAMES)[number];

export function isHamsterKitName(value: string): value is HamsterKitName {
  return (HAMSTER_KIT_NAMES as readonly string[]).includes(value);
}
