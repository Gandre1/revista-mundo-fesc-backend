-- Solo para bases locales de desarrollo. No aplicar en produccion.
UPDATE `users`
SET
  `email` = CASE `id`
    WHEN '7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad' THEN 'gexonrodriguez1822@gmail.com'
    WHEN 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' THEN 'editor@fesc.edu.co'
    WHEN 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' THEN 'reviewer@fesc.edu.co'
    WHEN 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' THEN 'admin@fesc.edu.co'
  END,
  `password` = CASE `id`
    WHEN '7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad' THEN '$2b$10$nRS5fvcJ3Wc0wO2bA8J1IOfLHenCBiW8IUq03zfcdeg1eBMYl/Uze'
    WHEN 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' THEN '$2b$10$wvUg8bw5QF5v2KbMhDQhuexZEG6EGQczWMa0.NOHwnZBC/L0jjChe'
    WHEN 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' THEN '$2b$10$JjP66s6Rr0f3L1bDj07yv.nE4PaLOEg/EcdEB7V702Mk9TfJ/bYry'
    WHEN 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' THEN '$2b$10$plLi.O.MkBItkrXfOTaQnemZUGLOfQ3Wo8QM7pAtpP2ge0gYg2DPy'
  END
WHERE `id` IN (
  '7d9cc614-f3d1-4d41-8ddf-17fe42ba05ad',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
);
