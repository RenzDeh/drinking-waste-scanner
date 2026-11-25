// Stelt een set "negatieve" beelden (null images) samen uit COCO val2017:
// foto's ZONDER fles, wijnglas of beker, vooral met personen en binnenruimtes.
// Doel: het model leren dat niet elk beeld een blikje/fles bevat.
//
// Gebruik:  npm run negatives            (standaard 300 beelden)
//           npm run negatives -- 400     (ander aantal)
//
// Resultaat: negatives/  met .jpg's, een leeg COCO-annotatiebestand (=> Roboflow markeert
// ze als null) en CREDITS.csv met licentie + bron per foto (COCO-beelden komen van Flickr).
//
// Licentie: COCO-annotaties CC BY 4.0; de beelden hebben elk hun eigen Flickr-licentie
// (zie CREDITS.csv). Prima voor een schoolproject; vermeld de bron in je README.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const TOTAL = Number(process.argv[2]) || 300
const ROOT = process.cwd()
const CACHE = join(ROOT, '.cache')
const OUT = join(ROOT, 'negatives')
const ZIP = join(CACHE, 'annotations_trainval2017.zip')
const JSON_PATH = join(CACHE, 'annotations', 'instances_val2017.json')
const ANN_URL = 'http://images.cocodataset.org/annotations/annotations_trainval2017.zip'

// COCO-categorieën
const PERSON = 1
const FORBIDDEN = new Set([44 /* bottle */, 46 /* wine glass */, 47 /* cup */])
const INDOOR = new Set([62, 63, 65, 67, 72, 73, 74, 76, 84]) // chair, couch, bed, dining table, tv, laptop, mouse, keyboard, book

// Deterministische shuffle zodat iedereen dezelfde set krijgt
function seeded(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}
function shuffle(arr, rnd) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} bij ${url}`)
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
}

async function main() {
  mkdirSync(CACHE, { recursive: true })
  mkdirSync(OUT, { recursive: true })

  if (!existsSync(JSON_PATH)) {
    if (!existsSync(ZIP)) {
      console.log('Annotaties downloaden (~250 MB, eenmalig)…')
      await download(ANN_URL, ZIP)
    }
    console.log('Uitpakken…')
    // Windows' eigen tar (bsdtar) kan zip's uitpakken; Git Bash' tar niet.
    const tar = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar'
    execFileSync(tar, ['-xf', ZIP, '-C', CACHE, 'annotations/instances_val2017.json'], { stdio: 'inherit' })
  }

  const coco = JSON.parse(readFileSync(JSON_PATH, 'utf8'))
  const catsPerImage = new Map()
  const imgArea = new Map(coco.images.map((i) => [i.id, i.width * i.height]))
  const biggestPerson = new Map() // grootste persoon als fractie van de foto
  for (const a of coco.annotations) {
    if (a.category_id === PERSON) {
      biggestPerson.set(a.image_id, Math.max(biggestPerson.get(a.image_id) ?? 0, a.area / imgArea.get(a.image_id)))
    }
    if (!catsPerImage.has(a.image_id)) catsPerImage.set(a.image_id, new Set())
    catsPerImage.get(a.image_id).add(a.category_id)
  }
  const licenses = new Map(coco.licenses.map((l) => [l.id, l.name]))

  const clean = coco.images.filter((img) => {
    const cats = catsPerImage.get(img.id)
    return cats && ![...cats].some((c) => FORBIDDEN.has(c))
  })
  // Enkel personen die GROOT in beeld staan (zoals iemand voor een webcam/telefoon)
  const withPerson = clean.filter((img) => (biggestPerson.get(img.id) ?? 0) >= 0.15)
  const indoorOnly = clean.filter((img) => {
    const cats = catsPerImage.get(img.id)
    return !cats.has(PERSON) && [...cats].some((c) => INDOOR.has(c))
  })

  const rnd = seeded(42)
  const nPerson = Math.round(TOTAL * 0.65)
  const picked = [...shuffle(withPerson, rnd).slice(0, nPerson), ...shuffle(indoorOnly, rnd).slice(0, TOTAL - nPerson)]
  console.log(`${withPerson.length} geschikte foto's met personen, ${indoorOnly.length} binnenruimtes. ${picked.length} worden gedownload…`)

  const credits = ['bestand,licentie,flickr_url,coco_url']
  const cocoOut = {
    info: { description: 'Null images (geen blik/fles) uit COCO val2017' },
    licenses: coco.licenses,
    categories: [
      { id: 0, name: 'drinking-waste', supercategory: 'none' },
      { id: 1, name: 'can', supercategory: 'drinking-waste' },
      { id: 2, name: 'glass', supercategory: 'drinking-waste' },
      { id: 3, name: 'pet', supercategory: 'drinking-waste' },
    ],
    images: [],
    annotations: [], // bewust leeg => null images
  }

  let done = 0
  const queue = [...picked]
  async function worker() {
    while (queue.length) {
      const img = queue.shift()
      const name = `null_coco_${img.id}.jpg`
      const dest = join(OUT, name)
      try {
        if (!existsSync(dest)) await download(img.coco_url, dest)
        cocoOut.images.push({ id: img.id, file_name: name, width: img.width, height: img.height, license: img.license })
        credits.push(`${name},"${licenses.get(img.license) ?? ''}",${img.flickr_url ?? ''},${img.coco_url}`)
      } catch (e) {
        console.warn(`  overgeslagen ${name}: ${e.message}`)
      }
      done++
      if (done % 25 === 0) console.log(`  ${done}/${picked.length}`)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))

  writeFileSync(join(OUT, '_annotations.coco.json'), JSON.stringify(cocoOut, null, 2))
  writeFileSync(join(OUT, 'CREDITS.csv'), credits.join('\n'))
  console.log(`Klaar: ${cocoOut.images.length} beelden in ${OUT}`)

  // De grote zip is niet meer nodig (de uitgepakte json blijft in .cache voor een volgende run)
  rmSync(ZIP, { force: true })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
