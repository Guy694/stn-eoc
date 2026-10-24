/**
 * @jest-environment node
 *
 * กันปัญหา "ข้อความถูกบีบเป็นคอลัมน์แคบคำละบรรทัด" บนมือถือ
 * เกิดเมื่อแถว flex มีข้อความหลักแบบ flex-1/min-w-0 (ไม่ตัดด้วย truncate)
 * อยู่ข้างข้อความยาวที่ห้ามหด (shrink-0 / whitespace-nowrap / flex-none)
 * จอแคบจึงเหลือที่ให้ข้อความหลักแค่ไม่กี่ตัวอักษร
 * วิธีแก้: ให้แถว flex-wrap แล้วให้ข้อความหลัก basis-full (ขึ้นบรรทัดใหม่บนมือถือ)
 * หรือใช้ flex-col บนมือถือ หรือ truncate ข้อความหลัก
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.resolve(__dirname, '..', '..');
const STIFF_TEXT_MIN = 20;

function listJsx(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === '__tests__') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) listJsx(full, out);
        else if (entry.name.endsWith('.jsx')) out.push(full);
    }
    return out;
}

function classOf(el) {
    const attr = el.openingElement.attributes.find((a) => a.name && a.name.name === 'className');
    if (!attr || !attr.value) return '';
    if (attr.value.type === 'StringLiteral') return attr.value.value;
    const expr = attr.value.expression;
    if (!expr) return '';
    if (expr.type === 'TemplateLiteral') return expr.quasis.map((q) => q.value.raw).join(' ');
    if (expr.type === 'StringLiteral') return expr.value;
    return '';
}

// นับขนาดข้อความโดยประมาณ: ตัวอักษรจริง + 6 ต่อค่าที่แทรกด้วย {...}
function textWeight(el) {
    let n = 0;
    (function walk(node) {
        for (const child of node.children || []) {
            if (child.type === 'JSXText') n += (child.value.match(/[฀-๿a-zA-Z0-9]/g) || []).length;
            else if (child.type === 'JSXExpressionContainer' && child.expression.type !== 'JSXEmptyExpression') n += 6;
            else if (child.type === 'JSXElement' && /^[a-z]/.test(child.openingElement.name.name || '')) walk(child);
        }
    })(el);
    return n;
}

const has = (cls, token) => cls.split(/\s+/).includes(token);

function findSqueezeRows(file) {
    const ast = parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
    const hits = [];
    traverse(ast, {
        JSXElement(p) {
            const cls = classOf(p.node);
            const tokens = cls.split(/\s+/);
            if (!tokens.includes('flex') && !tokens.includes('inline-flex')) return;
            if (tokens.includes('flex-col') && !tokens.some((t) => /^(sm|md|lg):flex-row$/.test(t))) return;
            const kids = p.node.children.filter((k) => k.type === 'JSXElement').map((k) => ({ k, c: classOf(k) }));
            const stiff = kids.filter((x) => (has(x.c, 'shrink-0') || has(x.c, 'whitespace-nowrap') || has(x.c, 'flex-none'))
                && !/\bw-\d/.test(x.c) && textWeight(x.k) >= STIFF_TEXT_MIN);
            if (!stiff.length) return;
            const grow = kids.filter((x) => (has(x.c, 'flex-1') || has(x.c, 'grow') || has(x.c, 'min-w-0'))
                && !/truncate|line-clamp/.test(x.c) && !stiff.includes(x) && textWeight(x.k) > 0);
            if (!grow.length) return;
            if (tokens.includes('flex-wrap') && grow.some((x) => /basis-full|w-full/.test(x.c))) return;
            hits.push(`${path.relative(ROOT, file)}:${p.node.loc.start.line}`);
        },
    });
    return hits;
}

describe('mobile layout guardrails', () => {
    test('ไม่มีแถว flex ที่บีบข้อความหลักให้เหลือคอลัมน์แคบบนมือถือ', () => {
        const files = [...listJsx(path.join(ROOT, 'app')), ...listJsx(path.join(ROOT, 'components'))];
        const hits = files.flatMap(findSqueezeRows);
        expect(hits).toEqual([]);
    });

    test('ตัวตรวจจับรูปแบบที่เคยเกิดปัญหาได้จริง', () => {
        const tmp = path.join(require('os').tmpdir(), `squeeze-${process.pid}.jsx`);
        fs.writeFileSync(tmp, `export default () => (<li className="flex flex-wrap items-start gap-x-3 px-5">
          <span className="min-w-0 flex-1"><b>{row.title}</b> — {row.body}</span>
          <span className="shrink-0 text-xs">{formatDateTime(row.created_at)} • ถึง {row.delivered}/{row.recipients} เครื่อง</span>
        </li>);`);
        try {
            expect(findSqueezeRows(tmp)).toHaveLength(1);
        } finally {
            fs.unlinkSync(tmp);
        }
    });
});
