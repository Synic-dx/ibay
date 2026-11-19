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

const PACK_DIR = "/Users/ujjwalharsh/Downloads/Real_Pictures_Listing_Pack";
const PUBLIC_IMG_DIR = path.join(process.cwd(), "public/img");

interface PackImageMapping {
  packFile: string;
  outputName: string;
  targetTitles: string[];
  fit: "contain" | "cover";
}

const PACK_MAPPINGS: PackImageMapping[] = [
  {
    packFile: "01_stand-up_night_2_passes.png",
    outputName: "standup.webp",
    targetTitles: ["Stand-up night, 2 passes"],
    fit: "cover",
  },
  {
    packFile: "02_arijit_singh_live_indore_silver_x2.png",
    outputName: "arijit.webp",
    targetTitles: ["Arijit Singh Live, Indore, Silver x2"],
    fit: "cover",
  },
  {
    packFile: "03_navy_two-piece_suit_jacket38_trousers32.png",
    outputName: "suit2.webp",
    targetTitles: ["Navy two-piece suit, jacket 38 / trousers 32"],
    fit: "contain",
  },
  {
    packFile: "04_harry_potter_box_set_books_1_to_7.png",
    outputName: "hp.webp",
    targetTitles: [
      "Harry Potter box set, books 1 to 7 (Bloomsbury paperback)",
      "Harry Potter box set (rent, take your time)",
    ],
    fit: "contain",
  },
  {
    packFile: "05_navratri_chaniya_choli_red_mustard.png",
    outputName: "chaniya.webp",
    targetTitles: ["Navratri chaniya choli, red & mustard mirror work"],
    fit: "contain",
  },
  {
    packFile: "06_casio_fx-991es_plus.png",
    outputName: "fx991es.webp",
    targetTitles: [
      "Casio fx-991ES Plus 2nd Edition scientific calculator",
      "Casio fx-991ES Plus (rent for exam day)",
    ],
    fit: "contain",
  },
  {
    packFile: "07_fairy_lights_5_strings.png",
    outputName: "lights.webp",
    targetTitles: [
      "Fairy lights for event decor, 5 strings (rent)",
      "Philips 10 m LED fairy lights, warm white",
    ],
    fit: "contain",
  },
  {
    packFile: "08_curly_blonde_costume_wig_with_cap.png",
    outputName: "wig.webp",
    targetTitles: ["Curly blonde costume wig with cap"],
    fit: "contain",
  },
  {
    packFile: "09_cultsport_700ml_shaker.png",
    outputName: "shaker.webp",
    targetTitles: ["Cultsport 700 ml shaker bottle"],
    fit: "contain",
  },
  {
    packFile: "10_cultsport_leather_lifting_belt_size_m.png",
    outputName: "liftbelt.webp",
    targetTitles: ["Cultsport leather lifting belt, size M (rent)"],
    fit: "contain",
  },
  {
    packFile: "11_ss_ton_reserve_english_willow_cricket_bat.png",
    outputName: "bat.webp",
    targetTitles: ["SS Ton Reserve Edition English willow cricket bat"],
    fit: "contain",
  },
  {
    packFile: "12_stag_iconic_tt_bat_with_cover.png",
    outputName: "tt.webp",
    targetTitles: ["Stag iconic TT bat with cover"],
    fit: "contain",
  },
  {
    packFile: "13_hockey_sticks_pair.png",
    outputName: "hockey.webp",
    targetTitles: [],
    fit: "contain",
  },
  {
    packFile: "14_usha_mist_air_duos_pedestal_fan.png",
    outputName: "fan.webp",
    targetTitles: ["Usha Mist Air Duos pedestal fan"],
    fit: "contain",
  },
];

async function main() {
  console.log("=== Step 1: Converting Pack Images to Optimized WebP ===");
  if (!fs.existsSync(PUBLIC_IMG_DIR)) {
    fs.mkdirSync(PUBLIC_IMG_DIR, { recursive: true });
  }

  for (const m of PACK_MAPPINGS) {
    const srcPath = path.join(PACK_DIR, m.packFile);
    const destPath = path.join(PUBLIC_IMG_DIR, m.outputName);

    if (!fs.existsSync(srcPath)) {
      console.warn(`Source file not found: ${srcPath}`);
      continue;
    }

    const inputBuffer = fs.readFileSync(srcPath);
    await sharp(inputBuffer)
      .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(destPath);

    const stats = fs.statSync(destPath);
    console.log(`Saved ${m.outputName}: ${(stats.size / 1024).toFixed(1)} KB (from ${(inputBuffer.length / 1024).toFixed(1)} KB)`);
  }

  console.log("\n=== Step 2: Updating Listing Images in Supabase Database ===");
  for (const m of PACK_MAPPINGS) {
    const imgUrl = `/img/${m.outputName}`;
    for (const title of m.targetTitles) {
      const { data: listings, error: lErr } = await sb
        .from("listings")
        .select("id, title")
        .eq("title", title);

      if (lErr || !listings || listings.length === 0) {
        console.warn(`Listing not found for title: "${title}"`);
        continue;
      }

      for (const l of listings) {
        // Check existing images
        const { data: existingImgs } = await sb
          .from("listing_images")
          .select("id, url, position")
          .eq("listing_id", l.id);

        if (existingImgs && existingImgs.length > 0) {
          // Update the first image
          const first = existingImgs.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
          const { error: upErr } = await sb
            .from("listing_images")
            .update({ url: imgUrl, fit: m.fit })
            .eq("id", first.id);

          if (upErr) {
            console.error(`Failed to update image for [${l.title}]:`, upErr.message);
          } else {
            console.log(`Updated [${l.title}]: old="${first.url}" -> new="${imgUrl}" (${m.fit})`);
          }
        } else {
          // Insert new image
          const { error: inErr } = await sb
            .from("listing_images")
            .insert({
              listing_id: l.id,
              url: imgUrl,
              fit: m.fit,
              position: 0,
            });

          if (inErr) {
            console.error(`Failed to insert image for [${l.title}]:`, inErr.message);
          } else {
            console.log(`Inserted image for [${l.title}]: "${imgUrl}" (${m.fit})`);
          }
        }
      }
    }
  }

  console.log("\n=== Step 3: Upgrading Remaining SVG References to WebP ===");
  const SVG_TO_WEBP: Record<string, string> = {
    "/art/text1.svg": "/img/text1.webp",
    "/art/text2.svg": "/img/text2.webp",
    "/art/qa.svg": "/img/qa.webp",
    "/art/lrdi.svg": "/img/lrdi.webp",
    "/art/va.svg": "/img/va.webp",
    "/art/catbundle.svg": "/img/catbundle.webp",
    "/art/pyq.svg": "/img/pyq.webp",
    "/art/book.svg": "/img/book.webp",
    "/art/cfabundle.svg": "/img/cfabundle.webp",
    "/art/fx991ex.svg": "/img/fx991ex.webp",
    "/art/fx82ms.svg": "/img/fx82ms.webp",
    "/art/fx100ms.svg": "/img/fx100ms.webp",
    "/art/calc.svg": "/img/calc.webp",
    "/art/dandiya.svg": "/img/dandiya.webp",
    "/art/diya.svg": "/img/diya.webp",
    "/art/pichkari.svg": "/img/pichkari.webp",
    "/art/gulal.svg": "/img/gulal.webp",
    "/art/mug.svg": "/img/mug.webp",
    "/art/shower.svg": "/img/shower.webp",
  };

  for (const [oldUrl, newUrl] of Object.entries(SVG_TO_WEBP)) {
    // Check if webp file actually exists
    const localFile = path.join(process.cwd(), "public", newUrl);
    if (!fs.existsSync(localFile)) {
      console.warn(`Target WebP does not exist locally: ${localFile}, skipping`);
      continue;
    }

    const { data, error } = await sb
      .from("listing_images")
      .update({ url: newUrl, fit: "contain" })
      .eq("url", oldUrl)
      .select("id, url");

    if (error) {
      console.error(`Error updating ${oldUrl}:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`Replaced ${data.length} rows: ${oldUrl} -> ${newUrl}`);
    }
  }

  console.log("\n=== Step 4: Verification of Database Image URLs ===");
  const { data: svgs } = await sb.from("listing_images").select("id, url").like("url", "%.svg");
  console.log(`Remaining SVG image references in listing_images: ${svgs?.length || 0}`);

  console.log("\nFinished successfully!");
}

main().catch(console.error);
