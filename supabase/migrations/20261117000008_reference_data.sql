-- =====================================================================
-- i-bay schema, part 8: reference data (categories and shop-by-moment
-- collections). These are part of the app, not demo content. No users,
-- listings or deals are seeded: everything else comes from real accounts.
-- =====================================================================
insert into public.categories (id, name, short_name, "group", description, icon, cover_url, cover_fit, sort) values
  ('preprocess', 'Getups & Costumes', 'Getups', 'Seasons', 'Wigs, costumes and props for club and committee interviews, preprocesses, class presentations and theme nights. Rent by the hour.', 'drama', '/img/kurta-pink.webp', 'cover', 0),
  ('formals', 'Placement Formals', 'Formals', 'Seasons', 'Suits, blazers, formal shoes, belts', 'shirt', '/img/blazer.webp', 'contain', 1),
  ('ethnic', 'Ethnic & Festive', 'Ethnic', 'Seasons', 'Kurtas, sarees for cultural nights', 'sparkles', '/img/kurta-cream.webp', 'cover', 2),
  ('events', 'Fest & Event Gear', 'Event gear', 'Seasons', 'For Atharv Ranbhoomi and club events: cameras, speakers, lights, props', 'party', '/img/speaker.webp', 'contain', 3),
  ('books', 'Books & Stationery', 'Books', 'Study', 'Textbooks, case packs, stationery', 'book', '/img/text1.webp', 'contain', 4),
  ('exam', 'CFA, CAT & Exam Prep', 'CFA & CAT', 'Study', 'CFA, CAT, FRM books, bundles, calculators', 'grad', '/img/fx991ex.webp', 'contain', 5),
  ('gadgets', 'Laptops & Gadgets', 'Gadgets', 'Study', 'Laptops, headphones, power banks', 'laptop', '/img/smartwatch.webp', 'contain', 6),
  ('room', 'Room & Hostel', 'Room', 'Hostel life', 'Mattresses, lamps, curtains, decor', 'bed', '/img/shower.webp', 'contain', 7),
  ('appliances', 'Appliances & Kitchen', 'Appliances', 'Hostel life', 'Coolers, fans, fridges, kettles', 'fridge', '/img/cooler.webp', 'contain', 8),
  ('food', 'Food Drops', 'Food drops', 'Hostel life', 'Extra orders, gone in minutes', 'food', '/img/noodles.webp', 'contain', 9),
  ('free', 'Free & Giveaways', 'Free stuff', 'Hostel life', 'Free to whoever picks it up', 'gift', '/img/plant.webp', 'contain', 10),
  ('gym', 'Gym Corner', 'Gym Corner', 'Play', 'Protein, creatine, belts, gym wear', 'dumbbell', '/img/whey.webp', 'contain', 11),
  ('sports', 'Sports Gear', 'Sports', 'Play', 'Racquets, bats, balls, court shoes', 'trophy', '/img/racquet.webp', 'contain', 12),
  ('hobbies', 'Music, Games & Hobbies', 'Hobbies', 'Play', 'Guitars, keyboards, board games', 'music', '/img/ukulele.webp', 'contain', 13),
  ('reads', 'Novels, Comics & Manga', 'Novels & manga', 'Play', 'Bestsellers, box sets, manga volumes', 'book', '/img/op.webp', 'contain', 14),
  ('travel', 'Cycles & Travel', 'Travel', 'Play', 'Cycles, helmets, bags, tents', 'bike', '/img/cycle.webp', 'contain', 15),
  ('clothing', 'Clothing & Accessories', 'Clothing', 'Play', 'Jackets, shoes, watches, shades', 'shirt', '/img/wayfarer.webp', 'contain', 16),
  ('tickets', 'Tickets', 'Tickets', 'Play', 'Concerts, matches, stand-up', 'ticket', null, 'contain', 17)
on conflict (id) do update set name = excluded.name, short_name = excluded.short_name, "group" = excluded."group", description = excluded.description, icon = excluded.icon, cover_url = excluded.cover_url, cover_fit = excluded.cover_fit, sort = excluded.sort;

insert into public.collections (id, name, description, rule, sort) values
  ('starter', 'Freshers'' starter kit', 'Everything for a new hostel room', '{"tags_any":["starter"]}'::jsonb, 0),
  ('moveout', 'Move-out sale', 'Seniors clearing their rooms', '{"tags_any":["moveout"]}'::jsonb, 1),
  ('placement', 'Placement season', 'Formals and exam prep', '{"categories":["formals","exam"]}'::jsonb, 2),
  ('fest', 'Fest season · ARB', 'Atharv Ranbhoomi: sports kit, cameras, speakers', '{"categories":["events","sports"],"exclude_tags":["garba","diwali","holi","navratri","dandiya"]}'::jsonb, 3),
  ('garba', 'Garba Night', 'Chaniya cholis, kurtas, dandiya sticks', '{"tags_any":["garba"]}'::jsonb, 4),
  ('diwali', 'Diwali', 'Ethnic wear, lights, diyas, decor', '{"tags_any":["diwali"]}'::jsonb, 5),
  ('holi', 'Holi', 'White kurtas, pichkaris, organic gulal', '{"tags_any":["holi"]}'::jsonb, 6),
  ('santa', 'Secret Santa', 'Gifts under ₹500', '{"tags_any":["santa"]}'::jsonb, 7)
on conflict (id) do update set name = excluded.name, description = excluded.description, rule = excluded.rule, sort = excluded.sort;
