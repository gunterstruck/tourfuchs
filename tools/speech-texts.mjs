import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'acorn';
import { STORIES } from '../src/features/stories.js';

/** Fixed helper sentences are extracted from syntax, never from customer data. */
export function speechTexts() {
    const texts = new Set(STORIES.flatMap(story => story.steps.filter(s => s.t === 'say').map(s => s.text)));
    const source = readFileSync(resolve('src/ui/showcase.js'), 'utf8');
    const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    function visit(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'CallExpression' && node.callee.name === 'say' && typeof node.arguments[0]?.value === 'string') texts.add(node.arguments[0].value);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value === 'object') visit(value);
        }
    }
    visit(tree);
    return [...texts].sort();
}
