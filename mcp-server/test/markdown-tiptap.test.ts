import { test, describe } from 'node:test';
import assert from 'node:assert';
import { markdownToTipTap, tipTapToMarkdown } from '../src/markdown-tiptap.js';

describe('Markdown to TipTap conversion', () => {
  test('converts headings with correct level', () => {
    const md = '# Main Title\n\n## Subtitle';
    const doc = markdownToTipTap(md);

    assert.strictEqual(doc.type, 'doc');
    assert.strictEqual(doc.content?.length, 2);
    assert.strictEqual(doc.content?.[0].type, 'heading');
    assert.strictEqual(doc.content?.[0].attrs?.level, 1);
    assert.strictEqual(doc.content?.[0].content?.[0].text, 'Main Title');

    assert.strictEqual(doc.content?.[1].type, 'heading');
    assert.strictEqual(doc.content?.[1].attrs?.level, 2);
    assert.strictEqual(doc.content?.[1].content?.[0].text, 'Subtitle');
  });

  test('converts fenced code blocks with language', () => {
    const md = '```rust\nfn main() {\n    println!("Hello");\n}\n```';
    const doc = markdownToTipTap(md);

    assert.strictEqual(doc.content?.length, 1);
    const codeNode = doc.content?.[0];
    assert.strictEqual(codeNode?.type, 'codeBlock');
    assert.strictEqual(codeNode?.attrs?.language, 'rust');
    assert.strictEqual(codeNode?.content?.[0].text, 'fn main() {\n    println!("Hello");\n}');
  });

  test('converts markdown tables to TipTap table structure', () => {
    const md = `| Method | Route | Status |
| :--- | :--- | :--- |
| GET | /notes | 200 |
| POST | /notes | 201 |`;

    const doc = markdownToTipTap(md);
    assert.strictEqual(doc.content?.length, 1);
    const tableNode = doc.content?.[0];
    assert.strictEqual(tableNode?.type, 'table');
    assert.strictEqual(tableNode?.content?.length, 3); // header + 2 data rows

    // Header row
    const headerRow = tableNode?.content?.[0];
    assert.strictEqual(headerRow?.type, 'tableRow');
    assert.strictEqual(headerRow?.content?.[0].type, 'tableHeader');
    assert.strictEqual(headerRow?.content?.[0].content?.[0].content?.[0].text, 'Method');

    // Data rows
    const dataRow1 = tableNode?.content?.[1];
    assert.strictEqual(dataRow1?.type, 'tableRow');
    assert.strictEqual(dataRow1?.content?.[0].type, 'tableCell');
    assert.strictEqual(dataRow1?.content?.[0].content?.[0].content?.[0].text, 'GET');
  });

  test('converts checklists / task lists with checked state', () => {
    const md = `- [ ] Buy milk\n- [x] Read docs\n- [ ] Deploy server`;
    const doc = markdownToTipTap(md);

    assert.strictEqual(doc.content?.length, 1);
    const taskList = doc.content?.[0];
    assert.strictEqual(taskList?.type, 'taskList');
    assert.strictEqual(taskList?.content?.length, 3);

    assert.strictEqual(taskList?.content?.[0].attrs?.checked, false);
    assert.strictEqual(taskList?.content?.[0].content?.[0].content?.[0].text, 'Buy milk');

    assert.strictEqual(taskList?.content?.[1].attrs?.checked, true);
    assert.strictEqual(taskList?.content?.[1].content?.[0].content?.[0].text, 'Read docs');
  });

  test('converts inline formatting (bold, italic, strike, underline, code, links)', () => {
    const md = 'Here is **bold**, *italic*, <u>underline</u>, ~~strike~~, `inline_code`, and [VibeNotes](https://vibenotes.app)';
    const doc = markdownToTipTap(md);

    const para = doc.content?.[0];
    assert.strictEqual(para?.type, 'paragraph');
    const texts = para?.content || [];

    const boldNode = texts.find((t) => t.text === 'bold');
    assert.ok(boldNode?.marks?.some((m) => m.type === 'bold'));

    const italicNode = texts.find((t) => t.text === 'italic');
    assert.ok(italicNode?.marks?.some((m) => m.type === 'italic'));

    const underlineNode = texts.find((t) => t.text === 'underline');
    assert.ok(underlineNode?.marks?.some((m) => m.type === 'underline'));

    const strikeNode = texts.find((t) => t.text === 'strike');
    assert.ok(strikeNode?.marks?.some((m) => m.type === 'strike'));

    const codeNode = texts.find((t) => t.text === 'inline_code');
    assert.ok(codeNode?.marks?.some((m) => m.type === 'code'));

    const linkNode = texts.find((t) => t.text === 'VibeNotes');
    assert.ok(linkNode?.marks?.some((m) => m.type === 'link' && m.attrs?.href === 'https://vibenotes.app'));
  });

  test('converts TipTap doc back to clean Markdown', () => {
    const originalMd = `# Project Notes\n\n- [ ] Task 1\n- [x] Task 2\n\n\`\`\`ts\nconst greeting = "hello";\n\`\`\``;
    const doc = markdownToTipTap(originalMd);
    const convertedMd = tipTapToMarkdown(doc);

    assert.ok(convertedMd.includes('# Project Notes'));
    assert.ok(convertedMd.includes('- [ ] Task 1'));
    assert.ok(convertedMd.includes('- [x] Task 2'));
    assert.ok(convertedMd.includes('```ts\nconst greeting = "hello";\n```'));
  });
});
