Error fetching EOC status: Error: Unknown database 'stneoc'
    at f.execute (.next/server/chunks/8491.js:1:566959)
    at M (.next/server/app/api/eoc/status/route.js:111:101)
    at async k (.next/server/app/api/eoc/status/route.js:147:3328)
    at async j (.next/server/app/api/eoc/status/route.js:147:4340)
    at async Module.T (.next/server/app/api/eoc/status/route.js:147:5407) {
  code: 'ER_BAD_DB_ERROR',
  errno: 1049,
  sql: '\n' +
    '            SELECT \n' +
    '                es.id,\n' +
    '                es.eoc_type,\n' +
    '                es.name_th,\n' +
    '                es.name_en,\n' +
    '                es.icon,\n' +
    '                es.color_primary,\n' +
    '                es.color_gradient,\n' +
    '                es.is_active,\n' +
    '                es.activated_at,\n' +
    '                es.deactivated_at,\n' +
    '                es.description,\n' +
    '                es.created_at,\n' +
    '                es.updated_at,\n' +
    '                sess.id as session_id,\n' +
    '                sess.session_number,\n' +
    '                sess.opened_at as session_opened_at,\n' +
    '                sess.festival_type,\n' +
    '                NULL as disease_id,\n' +
    '                NULL as disease_name,\n' +
    '                NULL as open_order_file_path,\n' +
    '                NULL as open_order_file_name,\n' +
    '                sess.status as session_status\n' +
    '            FROM eoc_status es\n' +
    '            \n' +
    '            LEFT JOIN (\n' +
    '                SELECT s.*\n' +
    '                FROM eoc_sessions s\n' +
    '                INNER JOIN (\n' +
    '                    SELECT eoc_type, MAX(id) AS latest_active_id\n' +
    '                    FROM eoc_sessions\n' +
    "                    WHERE status = 'active'\n" +
    '                    GROUP BY eoc_type\n' +
    '                ) latest ON latest.latest_active_id = s.id\n' +
    '            ) sess ON es.eoc_type = sess.eoc_type\n' +
    '        \n' +
    '         ORDER BY es.eoc_type',
  sqlState: '42000',
  sqlMessage: "Unknown database 'stneoc'"
}
Error fetching EOC status: Error: Table 'stneoc.eoc_status' doesn't exist
    at f.execute (.next/server/chunks/8491.js:1:566959)
    at M (.next/server/app/api/eoc/status/route.js:111:101)
    at async k (.next/server/app/api/eoc/status/route.js:147:3328)
    at async j (.next/server/app/api/eoc/status/route.js:147:4340)
    at async Module.T (.next/server/app/api/eoc/status/route.js:147:5407) {
  code: 'ER_NO_SUCH_TABLE',
  errno: 1146,
  sql: '\n' +
    '            SELECT \n' +
    '                es.id,\n' +
    '                es.eoc_type,\n' +
    '                es.name_th,\n' +
    '                es.name_en,\n' +
    '                es.icon,\n' +
    '                es.color_primary,\n' +
    '                es.color_gradient,\n' +
    '                es.is_active,\n' +
    '                es.activated_at,\n' +
    '                es.deactivated_at,\n' +
    '                es.description,\n' +
    '                es.created_at,\n' +
    '                es.updated_at,\n' +
    '                sess.id as session_id,\n' +
    '                sess.session_number,\n' +
    '                sess.opened_at as session_opened_at,\n' +
    '                sess.festival_type,\n' +
    '                NULL as disease_id,\n' +
    '                NULL as disease_name,\n' +
    '                NULL as open_order_file_path,\n' +
    '                NULL as open_order_file_name,\n' +
    '                sess.status as session_status\n' +
    '            FROM eoc_status es\n' +
    '            \n' +
    '            LEFT JOIN (\n' +
    '                SELECT s.*\n' +
    '                FROM eoc_sessions s\n' +
    '                INNER JOIN (\n' +
    '                    SELECT eoc_type, MAX(id) AS latest_active_id\n' +
    '                    FROM eoc_sessions\n' +
    "                    WHERE status = 'active'\n" +
    '                    GROUP BY eoc_type\n' +
    '                ) latest ON latest.latest_active_id = s.id\n' +
    '            ) sess ON es.eoc_type = sess.eoc_type\n' +
    '        \n' +
    '         ORDER BY es.eoc_type',
  sqlState: '42S02',
  sqlMessage: "Table 'stneoc.eoc_status' doesn't exist"
}
Error fetching EOC status: Error: Table 'stneoc.eoc_status' doesn't exist
    at f.execute (.next/server/chunks/8491.js:1:566959)
    at M (.next/server/app/api/eoc/status/route.js:111:101)
    at async k (.next/server/app/api/eoc/status/route.js:147:3328)
    at async j (.next/server/app/api/eoc/status/route.js:147:4340)
    at async Module.T (.next/server/app/api/eoc/status/route.js:147:5407) {
  code: 'ER_NO_SUCH_TABLE',
  errno: 1146,
  sql: '\n' +
    '            SELECT \n' +
    '                es.id,\n' +
    '                es.eoc_type,\n' +
    '                es.name_th,\n' +
    '                es.name_en,\n' +
    '                es.icon,\n' +
    '                es.color_primary,\n' +
    '                es.color_gradient,\n' +
    '                es.is_active,\n' +
    '                es.activated_at,\n' +
    '                es.deactivated_at,\n' +
    '                es.description,\n' +
    '                es.created_at,\n' +
    '                es.updated_at,\n' +
    '                sess.id as session_id,\n' +
    '                sess.session_number,\n' +
    '                sess.opened_at as session_opened_at,\n' +
    '                sess.festival_type,\n' +
    '                NULL as disease_id,\n' +
    '                NULL as disease_name,\n' +
    '                NULL as open_order_file_path,\n' +
    '                NULL as open_order_file_name,\n' +
    '                sess.status as session_status\n' +
    '            FROM eoc_status es\n' +
    '            \n' +
    '            LEFT JOIN (\n' +
    '                SELECT s.*\n' +
    '                FROM eoc_sessions s\n' +
    '                INNER JOIN (\n' +
    '                    SELECT eoc_type, MAX(id) AS latest_active_id\n' +
    '                    FROM eoc_sessions\n' +
    "                    WHERE status = 'active'\n" +
    '                    GROUP BY eoc_type\n' +
    '                ) latest ON latest.latest_active_id = s.id\n' +
    '            ) sess ON es.eoc_type = sess.eoc_type\n' +
    '        \n' +
    '         ORDER BY es.eoc_type',
  sqlState: '42S02',
  sqlMessage: "Table 'stneoc.eoc_status' doesn't exist"
}
Error fetching EOC status: Error: Table 'stneoc.eoc_status' doesn't exist
    at f.execute (.next/server/chunks/8491.js:1:566959)
    at M (.next/server/app/api/eoc/status/route.js:111:101)
    at async k (.next/server/app/api/eoc/status/route.js:147:3328)
    at async j (.next/server/app/api/eoc/status/route.js:147:4340)
    at async Module.T (.next/server/app/api/eoc/status/route.js:147:5407) {
  code: 'ER_NO_SUCH_TABLE',
  errno: 1146,
  sql: '\n' +
    '            SELECT \n' +
    '                es.id,\n' +
    '                es.eoc_type,\n' +
    '                es.name_th,\n' +
    '                es.name_en,\n' +
    '                es.icon,\n' +
    '                es.color_primary,\n' +
    '                es.color_gradient,\n' +
    '                es.is_active,\n' +
    '                es.activated_at,\n' +
    '                es.deactivated_at,\n' +
    '                es.description,\n' +
    '                es.created_at,\n' +
    '                es.updated_at,\n' +
    '                sess.id as session_id,\n' +
    '                sess.session_number,\n' +
    '                sess.opened_at as session_opened_at,\n' +
    '                sess.festival_type,\n' +
    '                NULL as disease_id,\n' +
    '                NULL as disease_name,\n' +
    '                NULL as open_order_file_path,\n' +
    '                NULL as open_order_file_name,\n' +
    '                sess.status as session_status\n' +
    '            FROM eoc_status es\n' +
    '            \n' +
    '            LEFT JOIN (\n' +
    '                SELECT s.*\n' +
    '                FROM eoc_sessions s\n' +
    '                INNER JOIN (\n' +
    '                    SELECT eoc_type, MAX(id) AS latest_active_id\n' +
    '                    FROM eoc_sessions\n' +
    "                    WHERE status = 'active'\n" +
    '                    GROUP BY eoc_type\n' +
    '                ) latest ON latest.latest_active_id = s.id\n' +
    '            ) sess ON es.eoc_type = sess.eoc_type\n' +
    '        \n' +
    '         ORDER BY es.eoc_type',
  sqlState: '42S02',
  sqlMessage: "Table 'stneoc.eoc_status' doesn't exist"
}
Error fetching polygons: Error: ENOENT: no such file or directory, open '/app/ampure.geojson'
    at async B (.next/server/app/api/common/area-polygons/route.js:1:1323)
    at async C (.next/server/app/api/common/area-polygons/route.js:1:1477)
    at async k (.next/server/app/api/common/area-polygons/route.js:12:4147)
    at async j (.next/server/app/api/common/area-polygons/route.js:12:5159)
    at async Module.I (.next/server/app/api/common/area-polygons/route.js:12:6226) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'open',
  path: '/app/ampure.geojson'
}
Error fetching polygons: Error: ENOENT: no such file or directory, open '/app/ampure.geojson'
    at async B (.next/server/app/api/common/area-polygons/route.js:1:1323)
    at async C (.next/server/app/api/common/area-polygons/route.js:1:1477)
    at async k (.next/server/app/api/common/area-polygons/route.js:12:4147)
    at async j (.next/server/app/api/common/area-polygons/route.js:12:5159)
    at async Module.I (.next/server/app/api/common/area-polygons/route.js:12:6226) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'open',
  path: '/app/ampure.geojson'
}
Error fetching polygons: Error: ENOENT: no such file or directory, open '/app/ampure.geojson'
    at async B (.next/server/app/api/common/area-polygons/route.js:1:1323)
    at async C (.next/server/app/api/common/area-polygons/route.js:1:1477)
    at async k (.next/server/app/api/common/area-polygons/route.js:12:4147)
    at async j (.next/server/app/api/common/area-polygons/route.js:12:5159)
    at async Module.I (.next/server/app/api/common/area-polygons/route.js:12:6226) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'open',
  path: '/app/ampure.geojson'
}