-- ดูตัวอย่างข้อมูล districts_polygon
SELECT id, dis_name, LEFT(geojson, 200) as geojson_preview FROM districts_polygon LIMIT 2;

-- ดูตัวอย่างข้อมูล tambons_polygon
SELECT id, tam_name, dis_name, LEFT(geojson, 200) as geojson_preview FROM tambons_polygon LIMIT 2;
