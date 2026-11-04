-- Renombra la columna de los m² para que coincida con el modelo de datos (area_m2).
-- Solo cambia el nombre: los datos quedan igual, y la restricción "unit_area_positive" sigue
-- funcionando porque Postgres actualiza sola la referencia a la columna.
ALTER TABLE "unit" RENAME COLUMN "area_m_2" TO "area_m2";
