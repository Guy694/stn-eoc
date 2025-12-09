import csv
import pymysql

conn = pymysql.connect(host="localhost", user="root", password="", db="stnEOC", charset="utf8mb4")
cursor = conn.cursor()

with open('satun_village.csv', encoding='utf-8') as file:
    reader = csv.reader(file)

    for row in reader:
        # ข้าม row ที่ไม่มีข้อมูลครบ
        if len(row) < 21:
            continue
            
        coord_list = row[4].split(",")  # คอลัมน์ที่ 5 (index 4) เป็น coordinates
        points = []

        # group coordinates (lon,lat)
        for i in range(0, len(coord_list), 2):
            if i+1 < len(coord_list):
                lon = coord_list[i].strip()
                lat = coord_list[i+1].strip()
                points.append(f"{lon} {lat}")

        polygon_wkt = "POLYGON((" + ",".join(points) + "))"

        sql = """
            INSERT INTO satun_village_polygon 
            (fid, area_name, regname, num_hh, villcode, num_build, distname, 
             ea_code_15, subdistnam, area_type, areacode, provname, mun_tao_na, 
             provcode, villname, regcode, ea_no, muntaocode, shape_length, shape_area, geom)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                    ST_GeomFromText(%s,4326))
        """

        try:
            cursor.execute(sql, (
                row[5], row[6], row[7], row[8], row[10], row[9],
                row[11], row[12], row[13], row[14], row[15], row[16], row[17],
                row[18], row[19], row[20], row[21], row[22], row[23], row[24], polygon_wkt
            ))
            print(f"Imported: {row[13]} - {row[19]}")
        except Exception as e:
            print(f"Error importing row: {e}")
            continue

conn.commit()
cursor.close()
conn.close()
print("\n✓ Import Completed Successfully!")
