// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest';

import { renderTemplate } from './template-renderer.js';

describe('renderTemplate', () => {
  it('should replace {{payload}} with full JSON-stringified payload', () => {
    const payload = { name: 'Alice', age: 30 };
    const result = renderTemplate('Data: {{payload}}', payload);
    expect(result).toBe(`Data: ${JSON.stringify(payload, null, 2)}`);
  });

  it('should replace {{payload.name}} with top-level string value', () => {
    const payload = { name: 'Bob', role: 'admin' };
    const result = renderTemplate('Hello {{payload.name}}', payload);
    expect(result).toBe('Hello Bob');
  });

  it('should replace {{payload.contact.phone}} with nested value', () => {
    const payload = { contact: { phone: '+1 555 123 4567', email: 'a@b.com' } };
    const result = renderTemplate('Call {{payload.contact.phone}}', payload);
    expect(result).toBe('Call +1 555 123 4567');
  });

  it('should replace {{payload.missing}} with empty string', () => {
    const payload = { name: 'Alice' };
    const result = renderTemplate('Value: [{{payload.missing}}]', payload);
    expect(result).toBe('Value: []');
  });

  it('should replace {{payload.deep.nested.value}} with deep access', () => {
    const payload = { deep: { nested: { value: 42 } } };
    const result = renderTemplate('Answer: {{payload.deep.nested.value}}', payload);
    expect(result).toBe('Answer: 42');
  });

  it('should return empty string for partially missing nested path', () => {
    const payload = { deep: { other: 1 } };
    const result = renderTemplate('Got: [{{payload.deep.nested.value}}]', payload);
    expect(result).toBe('Got: []');
  });

  it('should handle empty payload with {{payload}}', () => {
    const result = renderTemplate('Empty: {{payload}}', {});
    expect(result).toBe(`Empty: ${JSON.stringify({}, null, 2)}`);
  });

  it('should handle empty payload with field access', () => {
    const result = renderTemplate('Name: [{{payload.name}}]', {});
    expect(result).toBe('Name: []');
  });

  it('should return template as-is when no placeholders present', () => {
    const result = renderTemplate('No templates here', { name: 'Alice' });
    expect(result).toBe('No templates here');
  });

  it('should handle mixed static text and multiple templates', () => {
    const payload = { first: 'Jane', last: 'Doe', age: 28 };
    const template = 'Name: {{payload.first}} {{payload.last}}, Age: {{payload.age}}';
    const result = renderTemplate(template, payload);
    expect(result).toBe('Name: Jane Doe, Age: 28');
  });

  it('should stringify nested objects when accessed directly', () => {
    const payload = { meta: { tags: ['a', 'b'], count: 2 } };
    const result = renderTemplate('Meta: {{payload.meta}}', payload);
    expect(result).toBe(`Meta: ${JSON.stringify(payload.meta, null, 2)}`);
  });

  it('should handle null field values as empty string', () => {
    const payload = { name: null };
    const result = renderTemplate('Name: [{{payload.name}}]', payload as Record<string, unknown>);
    expect(result).toBe('Name: []');
  });

  it('should handle boolean values', () => {
    const payload = { active: true, deleted: false };
    const result = renderTemplate('Active: {{payload.active}}, Deleted: {{payload.deleted}}', payload);
    expect(result).toBe('Active: true, Deleted: false');
  });

  it('should handle numeric values', () => {
    const payload = { count: 0, total: 99.5 };
    const result = renderTemplate('{{payload.count}} of {{payload.total}}', payload);
    expect(result).toBe('0 of 99.5');
  });

  it('should handle array field values by stringifying', () => {
    const payload = { items: ['x', 'y', 'z'] };
    const result = renderTemplate('Items: {{payload.items}}', payload);
    expect(result).toBe(`Items: ${JSON.stringify(['x', 'y', 'z'], null, 2)}`);
  });
});
