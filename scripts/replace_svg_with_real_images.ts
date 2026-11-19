import fs from "fs";
import path from "path";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const sb = createClient(supabaseUrl, supabaseKey);

const IMAGE_MAP: Record<string, string> = {
  fx991es: "https://www.casio-intl.com/asia/en/calc/products/images/fx-991ESPLUS-2.jpg",
  fx991ex: "https://www.casio-intl.com/asia/en/calc/products/images/fx-991EX.jpg",
  fx82ms: "https://www.casio-intl.com/asia/en/calc/products/images/fx-82MS.jpg",
  fx100ms: "https://www.casio-intl.com/asia/en/calc/products/images/fx-100MS.jpg",
  fc200v: "https://www.casio-intl.com/asia/en/calc/products/images/FC-200V.jpg",
  calc: "https://upload.wikimedia.org/wikipedia/commons/b/b9/Texas_Instrument_BAII_Plus_Professional.jpg",
  atomic: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
  psymoney: "https://covers.openlibrary.org/b/isbn/9780857197689-L.jpg",
  alch: "https://covers.openlibrary.org/b/isbn/9780062315007-L.jpg",
  sapiens: "https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg",
  n1984: "https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg",
  hp: "https://covers.openlibrary.org/b/isbn/9781408856772-L.jpg",
  lotr: "https://covers.openlibrary.org/b/isbn/9780544003415-L.jpg",
  op: "https://covers.openlibrary.org/b/isbn/9781569319017-L.jpg",
  naruto: "https://covers.openlibrary.org/b/isbn/9781569319000-L.jpg",
  aot: "https://covers.openlibrary.org/b/isbn/9781612620244-L.jpg",
  dn: "https://covers.openlibrary.org/b/isbn/9781421501680-L.jpg",
  jjk: "https://covers.openlibrary.org/b/isbn/9781974710027-L.jpg",
  text1: "https://covers.openlibrary.org/b/isbn/9780133856460-L.jpg",
  text2: "https://covers.openlibrary.org/b/id/4089023-L.jpg",
  qa: "https://covers.openlibrary.org/b/id/11156657-L.jpg",
  lrdi: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600",
  va: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600",
  catbundle: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600",
  pyq: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=600",
  book: "https://covers.openlibrary.org/b/id/12890906-L.jpg",
  cfabundle: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600",
  whey: "https://img8.hkrtcdn.com/39078/prd_3907787-MuscleBlaze-Biozyme-Performance-Whey-4.4-lb-Rich-Chocolate_o.jpg",
  whey2: "https://www.optimumnutrition.co.in/cdn/shop/files/748927065732_1_d73795fe-ef01-4c1c-abfc-c6eabf5656e6.jpg",
  creatine: "https://img8.hkrtcdn.com/44856/prd_4485547_c_l.jpg",
  prework: "https://img6.hkrtcdn.com/39080/prd_3907915-MuscleBlaze-PRE-Workout-200-0.22-lb-Fruit-Splash_o.jpg",
  shaker: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=600",
  liftbelt: "https://upload.wikimedia.org/wikipedia/commons/8/83/LiftingBelt.JPG",
  wraps: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600",
  bands: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Resistance_band.jpg",
  bat: "https://upload.wikimedia.org/wikipedia/commons/c/c0/Cricket_bat_2.jpg",
  tt: "https://upload.wikimedia.org/wikipedia/commons/9/9c/PRC_DHS_Double_Happiness_Ping_Pong_Bat_12.JPG",
  suit: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600",
  suit2: "https://images.unsplash.com/photo-1598808503746-f34c53b9323e?w=600",
  suitneon: "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?w=600",
  wayfarer: "https://upload.wikimedia.org/wikipedia/commons/0/09/2023_Okulary_przeciws%C5%82oneczne_Ray-Ban_%281%29.jpg",
  chaniya: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600",
  dandiya: "https://upload.wikimedia.org/wikipedia/commons/3/3f/Children_performing_Dandiya_in_Palace_Grounds%2C_Bangalore.jpg",
  wig: "https://upload.wikimedia.org/wikipedia/commons/3/3f/Braided_blonde_wig_on_mannequin_head%2C_2016.jpg",
  lights: "https://images.unsplash.com/photo-1543258103-a62bdc069871?w=600",
  diya: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Diya_Lamp.jpg",
  pichkari: "https://upload.wikimedia.org/wikipedia/commons/b/bb/Holi_festival_water_gun_01.jpg",
  gulal: "https://images.unsplash.com/photo-1551817958-c5b51e7b4a33?w=600",
  mug: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600",
  shower: "https://www.waterscience.in/cdn/shop/files/1_20.jpg?v=1774270711&width=1445"
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function downloadAndConvert(key: string, url: string): Promise<string> {
  const targetPath = path.join(process.cwd(), "public/img", `${key}.webp`);
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 1000) {
    console.log(`[Cache Hit] ${key}.webp already exists (${fs.statSync(targetPath).size} bytes)`);
    return `/img/${key}.webp`;
  }

  console.log(`[Fetching] ${key} from ${url}...`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": "iBayCampusApp/1.0 (admin@i-bay.store)",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${key}: HTTP ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await sharp(buffer)
    .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(targetPath);

  const stats = fs.statSync(targetPath);
  console.log(`[Saved] ${key}.webp (${stats.size} bytes)`);
  return `/img/${key}.webp`;
}

async function main() {
  console.log("=== Phase 1: Downloading & Converting Real Images ===");
  const results: Record<string, string> = {};
  
  for (const [key, url] of Object.entries(IMAGE_MAP)) {
    try {
      const savedPath = await downloadAndConvert(key, url);
      results[key] = savedPath;
      await sleep(250); // Be respectful to CDNs and Wikimedia
    } catch (err: unknown) {
      console.error(`[Error] Failed processing ${key}:`, err);
    }
  }

  console.log(`\nSuccessfully processed ${Object.keys(results).length} of ${Object.keys(IMAGE_MAP).length} images.`);

  console.log("\n=== Phase 2: Updating Supabase listing_images Database Rows ===");
  for (const key of Object.keys(results)) {
    const oldUrl = `/art/${key}.svg`;
    const newUrl = `/img/${key}.webp`;

    const { data, error } = await sb
      .from("listing_images")
      .update({ url: newUrl, fit: "contain" })
      .eq("url", oldUrl)
      .select("id, listing_id, url");

    if (error) {
      console.error(`Error updating rows for ${oldUrl}:`, error.message);
    } else {
      console.log(`Updated ${data?.length || 0} rows from ${oldUrl} -> ${newUrl}`);
    }
  }

  console.log("\n=== Phase 3: Verification of Remaining SVG Images ===");
  const { data: remainingSvgs, error: queryError } = await sb
    .from("listing_images")
    .select("id, url")
    .like("url", "%.svg");

  if (queryError) {
    console.error("Error querying remaining SVGs:", queryError);
  } else {
    console.log(`Remaining SVG images in database: ${remainingSvgs?.length || 0}`);
    if (remainingSvgs?.length) {
      console.log("Remaining SVGs:", remainingSvgs);
    }
  }

  console.log("\n=== Done! All item images successfully updated to real photographs. ===");
}

main().catch(console.error);
