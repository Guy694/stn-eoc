INSERT INTO eoc_status (eoc_type, name_th, name_en, icon, color_primary, color_gradient, is_active, sort_order) 
VALUES ('accident', 'อุบัติเหตุช่วงเทศกาล', 'Accident/Safety', '🚗', 'orange', 'from-orange-500 to-red-600', 0, 3)
ON DUPLICATE KEY UPDATE name_th = VALUES(name_th), name_en = VALUES(name_en);
