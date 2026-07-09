-- Add village number (moo) to satun_village_polygon and backfill it
-- from the villages table loaded by villages.sql.

ALTER TABLE satun_village_polygon
ADD COLUMN moo VARCHAR(10) NULL COMMENT 'เลขหมู่บ้านจาก villages.sql' AFTER villname;

UPDATE satun_village_polygon svp
JOIN (
    SELECT
        amphoe,
        tambon,
        village_name,
        CAST(
            COALESCE(
                MIN(CASE WHEN moo <> '0' THEN CAST(moo AS UNSIGNED) END),
                MIN(CAST(moo AS UNSIGNED))
            ) AS CHAR
        ) AS moo
    FROM villages
    GROUP BY amphoe, tambon, village_name
) v
    ON TRIM(svp.distname) = TRIM(v.amphoe)
    AND TRIM(svp.subdistnam) = TRIM(v.tambon)
    AND TRIM(svp.villname) = TRIM(v.village_name)
SET svp.moo = v.moo;

CREATE INDEX idx_satun_village_polygon_moo
ON satun_village_polygon (distname, subdistnam, moo, villname);
