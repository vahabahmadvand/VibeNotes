import { test, describe } from 'node:test';
import assert from 'node:assert';
import { extractChecklist, updateChecklistItem, addChecklistItem } from '../src/checklist.js';

describe('Checklist management utilities', () => {
  test('extracts all checklist items with indices and status', () => {
    const raw = `# Tasks\n\n- [ ] Task 1\n- [x] Task 2\nSome notes\n- [ ] Task 3`;
    const tasks = extractChecklist(raw);

    assert.strictEqual(tasks.length, 3);
    assert.strictEqual(tasks[0].index, 0);
    assert.strictEqual(tasks[0].text, 'Task 1');
    assert.strictEqual(tasks[0].checked, false);

    assert.strictEqual(tasks[1].index, 1);
    assert.strictEqual(tasks[1].text, 'Task 2');
    assert.strictEqual(tasks[1].checked, true);

    assert.strictEqual(tasks[2].index, 2);
    assert.strictEqual(tasks[2].text, 'Task 3');
    assert.strictEqual(tasks[2].checked, false);
  });

  test('toggles and checks items by index', () => {
    const raw = `- [ ] Task 1\n- [ ] Task 2`;
    
    // Check item 0
    const res1 = updateChecklistItem(raw, { index: 0, checked: true });
    assert.ok(res1.modifiedItem);
    assert.strictEqual(res1.modifiedItem?.checked, true);
    assert.ok(res1.updatedText.includes('- [x] Task 1'));

    // Toggle item 1
    const res2 = updateChecklistItem(res1.updatedText, { index: 1 });
    assert.ok(res2.modifiedItem);
    assert.strictEqual(res2.modifiedItem?.checked, true);
    assert.ok(res2.updatedText.includes('- [x] Task 2'));

    // Uncheck item 0
    const res3 = updateChecklistItem(res2.updatedText, { index: 0, checked: false });
    assert.ok(res3.modifiedItem);
    assert.strictEqual(res3.modifiedItem?.checked, false);
    assert.ok(res3.updatedText.includes('- [ ] Task 1'));
  });

  test('updates item by substring text match', () => {
    const raw = `- [ ] Deploy to production\n- [ ] Fix bug #123`;
    const res = updateChecklistItem(raw, { text: 'production', checked: true });

    assert.ok(res.modifiedItem);
    assert.strictEqual(res.modifiedItem?.text, 'Deploy to production');
    assert.strictEqual(res.modifiedItem?.checked, true);
    assert.ok(res.updatedText.includes('- [x] Deploy to production'));
  });

  test('appends new checklist item', () => {
    const raw = `# My Note\n\n- [ ] Existing task`;
    const res = addChecklistItem(raw, 'New task added via MCP');

    assert.ok(res.newItem);
    assert.strictEqual(res.newItem.text, 'New task added via MCP');
    assert.strictEqual(res.newItem.checked, false);
    assert.ok(res.updatedText.includes('- [ ] New task added via MCP'));
  });
});
