import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { textToApp2AudioFilename, textToAudioFilename } from "./audio-fs";
import {
  app2DictionarySlug,
  collectDictionarySpeakableTexts,
  expectedQuestionIds,
  validateDictionaryEntry,
} from "./dictionary-word";
import { app2DictionaryObjectKey, app2DictionaryPrefix } from "./r2";

const candy = {
  word: "candy",
  phonetic: "/ˈkændi/",
  phoneticUk: "/ˈkændɪ/",
  meaning: "糖果",
  partOfSpeech: "n.",
  example: "She bought a box of candy for her little brother.",
  translation: "她给弟弟买了一盒糖果。",
  questions: [
    {
      id: "candy-zh",
      type: "zh_to_en",
      prompt: "「糖果」的英文是什么？",
      answer: "candy",
      hints: ["首字母是 c", "共 5 个字母"],
    },
    {
      id: "candy-listen",
      type: "listening",
      prompt: "听发音，选择正确的拼写",
      audioText: "candy",
      answer: "candy",
      options: [
        "candy",
        "candle",
        "canteen",
        "canvas",
        "canyon",
        "carbon",
        "career",
        "carpet",
      ],
    },
    {
      id: "candy-choice",
      type: "choice",
      prompt: "选择“糖果”对应的英文",
      answer: "candy",
      options: [
        "candy",
        "cookie",
        "chocolate",
        "bread",
        "sugar",
        "snack",
        "cake",
        "dessert",
      ],
    },
    {
      id: "candy-cloze",
      type: "sentence_cloze",
      prompt: "The children each got a piece of ___ after dinner.",
      translation: "孩子们晚饭后每人得到一块糖果。",
      answer: "candy",
      options: [
        "candy",
        "cookie",
        "chocolate",
        "bread",
        "orange",
        "apple",
        "cake",
        "biscuit",
      ],
    },
    {
      id: "candy-en2zh",
      type: "en_to_zh_choice",
      prompt: "He put a candy in his mouth and smiled.",
      targetForm: "candy",
      answer: "糖果",
      translation: "他把一颗糖放进嘴里，笑了。",
      options: [
        "糖果",
        "饼干",
        "蛋糕",
        "面包",
        "巧克力",
        "水果",
        "零食",
        "甜点",
      ],
    },
    {
      id: "candy-trans",
      type: "sentence_translation",
      prompt: "The store sells different kinds of candy.",
      targetForm: "candy",
      audioText: "The store sells different kinds of candy.",
      answer: "这家商店出售不同种类的糖果。",
      options: [
        "这家商店出售不同种类的糖果。",
        "这家商店出售不同种类的饼干。",
        "这家商店出售不同种类的蛋糕。",
        "这家商店出售不同种类的面包。",
        "这家商店出售不同种类的巧克力。",
        "这家商店出售不同种类的水果。",
        "这家商店出售不同种类的零食。",
        "这家商店出售不同种类的甜点。",
      ],
    },
  ],
};

describe("app2DictionarySlug", () => {
  it("lowercases and is case-insensitive for Candy/candy", () => {
    assert.equal(app2DictionarySlug("Candy"), "candy");
    assert.equal(app2DictionarySlug("candy"), "candy");
    assert.equal(app2DictionarySlug("  CANDY  "), "candy");
  });

  it("collapses spaces and replaces unsafe chars with hyphen", () => {
    assert.equal(app2DictionarySlug("in vain"), "in-vain");
    assert.equal(app2DictionarySlug("  Hello, World!  "), "hello-world");
    assert.equal(app2DictionarySlug("o'clock"), "o-clock");
  });

  it("does not merge color and colour", () => {
    assert.equal(app2DictionarySlug("color"), "color");
    assert.equal(app2DictionarySlug("colour"), "colour");
    assert.notEqual(app2DictionarySlug("color"), app2DictionarySlug("colour"));
  });
});

describe("app2 dictionary R2 keys", () => {
  it("uses shared dictionary/app2/{slug}.json", () => {
    assert.equal(app2DictionaryObjectKey("candy"), "dictionary/app2/candy.json");
    assert.equal(app2DictionaryPrefix(), "dictionary/app2/");
  });
});

describe("validateDictionaryEntry candy fixture", () => {
  it("accepts a candy-like 6-question paper word", () => {
    const entry = validateDictionaryEntry(candy, {
      expectedWord: "candy",
      source: { corpus: "custom", rank: 0, paperId: "custom-0-v1" },
    });
    assert.equal(entry.word, "candy");
    assert.deepEqual(
      entry.questions.map((q) => q.type),
      [
        "zh_to_en",
        "listening",
        "choice",
        "sentence_cloze",
        "en_to_zh_choice",
        "sentence_translation",
      ],
    );
    assert.deepEqual(entry.questions.map((q) => q.id), expectedQuestionIds("candy"));
    assert.equal(entry._source?.paperId, "custom-0-v1");
  });

  it("accepts AI casing when spelling matches fold, rejects colour rewrite", () => {
    const entry = validateDictionaryEntry(
      { ...candy, word: "candy" },
      { expectedWord: "CANDY" },
    );
    assert.equal(entry.word, "candy");
    assert.equal(entry.questions[0]?.answer, "candy");
    assert.throws(() =>
      validateDictionaryEntry(
        { ...candy, word: "colour" },
        { expectedWord: "color" },
      ),
    );
  });

  it("keeps AI dictionary casing for proper nouns and acronyms", () => {
    const make = (head: string, example: string, en2zh: string, trans: string) => {
      const ids = expectedQuestionIds(head);
      return {
        word: head,
        phonetic: "/x/",
        meaning: "测试",
        partOfSpeech: "n.",
        example,
        translation: "测试例句。",
        questions: [
          {
            id: ids[0],
            type: "zh_to_en",
            prompt: "「测试」的英文是什么？",
            answer: head,
            hints: ["提示一", "提示二"],
          },
          {
            id: ids[1],
            type: "listening",
            prompt: "听发音，选择正确的拼写",
            answer: head,
            audioText: head,
            options: [head, "a", "b", "c", "d", "e", "f", "g"],
          },
          {
            id: ids[2],
            type: "choice",
            prompt: "选择“测试”对应的英文",
            answer: head,
            options: [head, "a", "b", "c", "d", "e", "f", "g"],
          },
          {
            id: ids[3],
            type: "sentence_cloze",
            prompt: "We study ___ today.",
            answer: head,
            translation: "我们今天学习它。",
            options: [head, "a", "b", "c", "d", "e", "f", "g"],
          },
          {
            id: ids[4],
            type: "en_to_zh_choice",
            prompt: en2zh,
            targetForm: head,
            answer: "测试",
            translation: "这是一句完整中文翻译。",
            options: ["测试", "甲", "乙", "丙", "丁", "戊", "己", "庚"],
          },
          {
            id: ids[5],
            type: "sentence_translation",
            prompt: trans,
            targetForm: head,
            audioText: trans,
            answer: "这是另一句完整中文翻译。",
            options: [
              "这是另一句完整中文翻译。",
              "错译一。",
              "错译二。",
              "错译三。",
              "错译四。",
              "错译五。",
              "错译六。",
              "错译七。",
            ],
          },
        ],
      };
    };

    const london = validateDictionaryEntry(
      make(
        "London",
        "Many people live in London.",
        "London is busy today.",
        "I flew to London yesterday.",
      ),
      { expectedWord: "LONDON" },
    );
    assert.equal(london.word, "London");
    assert.equal(london.questions[0]?.answer, "London");

    const usa = validateDictionaryEntry(
      make(
        "USA",
        "She visited the USA last year.",
        "The USA is large.",
        "He works in the USA now.",
      ),
      { expectedWord: "usa" },
    );
    assert.equal(usa.word, "USA");
  });

  it("keeps valid questions and drops bad ones instead of failing all", () => {
    const five = validateDictionaryEntry({
      ...candy,
      questions: candy.questions.slice(0, 5),
    });
    assert.equal(five.questions.length, 5);

    const withDrag = validateDictionaryEntry({
      ...candy,
      questions: [
        ...candy.questions.slice(0, 5),
        { ...candy.questions[5], type: "drag", id: "candy-trans" },
      ],
    });
    assert.equal(withDrag.questions.length, 5);
    assert.ok(withDrag.questions.every((q) => q.type !== "drag"));

    const badListening = {
      ...candy.questions[1],
      options: ["candy", "only-two"],
    };
    const filtered = validateDictionaryEntry({
      ...candy,
      questions: [candy.questions[0], badListening, ...candy.questions.slice(2)],
    });
    assert.equal(filtered.questions.length, 5);
    assert.ok(filtered.questions.every((q) => q.type !== "listening"));

    assert.throws(() =>
      validateDictionaryEntry({
        ...candy,
        questions: [{ ...candy.questions[1], options: ["x"] }],
      }),
    );
  });
});

describe("lowercase app2 audio filename", () => {
  it("matches the app2 client convention", () => {
    assert.equal(textToApp2AudioFilename("candy"), "candy.mp3");
    assert.equal(
      textToApp2AudioFilename("The store sells different kinds of candy."),
      "the_store_sells_different_kinds_of_candy.mp3",
    );
    assert.equal(textToApp2AudioFilename("A: Hello."), "hello.mp3");
    assert.equal(
      collectDictionarySpeakableTexts(candy as never).includes(
        "The store sells different kinds of candy.",
      ),
      true,
    );
    const speakable = collectDictionarySpeakableTexts(candy as never);
    assert.equal(
      speakable.includes("He put a candy in his mouth and smiled."),
      true,
      "en_to_zh_choice prompt must be spoken",
    );
    assert.equal(
      speakable.includes(
        "The children each got a piece of candy after dinner.",
      ),
      true,
      "sentence_cloze filled sentence must be spoken",
    );
  });

  it("does not change course audio filenames (no lowercase)", () => {
    assert.equal(
      textToAudioFilename("The store sells different kinds of candy."),
      "The_store_sells_different_kinds_of_candy.mp3",
    );
  });
});
