import re
import json

# อ่านไฟล์ SQL
with open(r'c:\newxampp\htdocs\stn-eoc\stneoc (4).sql', 'r', encoding='utf-8') as f:
    sql_content = f.read()

# หา CREATE TABLE statements
table_pattern = r'CREATE TABLE `([^`]+)`\s*\((.*?)\)\s*ENGINE'
tables = {}

for match in re.finditer(table_pattern, sql_content, re.DOTALL):
    table_name = match.group(1)
    table_def = match.group(2)
    
    # หา columns
    columns = []
    for line in table_def.split('\n'):
        line = line.strip()
        if line and not line.startswith('PRIMARY') and not line.startswith('KEY') and not line.startswith('UNIQUE') and not line.startswith('CONSTRAINT'):
            col_match = re.match(r'`([^`]+)`\s+([^\s,]+)', line)
            if col_match:
                columns.append({
                    'name': col_match.group(1),
                    'type': col_match.group(2)
                })
    
    tables[table_name] = {
        'columns': columns,
        'foreign_keys': [],
        'referenced_by': []
    }

# หา Foreign Keys
fk_pattern = r'FOREIGN KEY \(`([^`]+)`\) REFERENCES `([^`]+)`\s*\(`([^`]+)`\)'
for match in re.finditer(fk_pattern, sql_content):
    fk_column = match.group(1)
    ref_table = match.group(2)
    ref_column = match.group(3)
    
    # หาว่า FK นี้อยู่ใน table ไหน
    for table_name, table_data in tables.items():
        if any(col['name'] == fk_column for col in table_data['columns']):
            table_data['foreign_keys'].append({
                'column': fk_column,
                'references_table': ref_table,
                'references_column': ref_column
            })
            if ref_table in tables:
                tables[ref_table]['referenced_by'].append({
                    'table': table_name,
                    'column': fk_column
                })

# สร้างรายงาน
print("=" * 80)
print("DATABASE SCHEMA ANALYSIS - stneoc")
print("=" * 80)
print(f"\nTotal Tables: {len(tables)}")
print("\n" + "=" * 80)

# แสดงตารางทั้งหมด
print("\n📊 ALL TABLES:")
print("-" * 80)
for i, table_name in enumerate(sorted(tables.keys()), 1):
    table = tables[table_name]
    print(f"{i:3d}. {table_name:40s} ({len(table['columns'])} columns)")

# แสดง Relations
print("\n" + "=" * 80)
print("\n🔗 FOREIGN KEY RELATIONS:")
print("-" * 80)
for table_name in sorted(tables.keys()):
    table = tables[table_name]
    if table['foreign_keys']:
        print(f"\n{table_name}:")
        for fk in table['foreign_keys']:
            print(f"  └─ {fk['column']} → {fk['references_table']}.{fk['references_column']}")

# ตารางที่ไม่มี FK (อาจไม่ได้ใช้)
print("\n" + "=" * 80)
print("\n⚠️  TABLES WITHOUT FOREIGN KEYS (Potentially Unused):")
print("-" * 80)
orphan_tables = [name for name, data in tables.items() if not data['foreign_keys'] and not data['referenced_by']]
for table_name in sorted(orphan_tables):
    print(f"  • {table_name}")

# ตารางที่ถูก reference มากที่สุด
print("\n" + "=" * 80)
print("\n🎯 MOST REFERENCED TABLES:")
print("-" * 80)
ref_count = [(name, len(data['referenced_by'])) for name, data in tables.items()]
ref_count.sort(key=lambda x: x[1], reverse=True)
for table_name, count in ref_count[:10]:
    if count > 0:
        print(f"  {table_name:40s} ({count} references)")

# บันทึกผลลัพธ์เป็น JSON
output = {
    'total_tables': len(tables),
    'tables': {name: {
        'column_count': len(data['columns']),
        'foreign_keys': data['foreign_keys'],
        'referenced_by': data['referenced_by']
    } for name, data in tables.items()},
    'orphan_tables': orphan_tables
}

with open(r'c:\newxampp\htdocs\stn-eoc\database_analysis.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print("\n" + "=" * 80)
print("\n✅ Analysis complete! Results saved to database_analysis.json")
print("=" * 80)
