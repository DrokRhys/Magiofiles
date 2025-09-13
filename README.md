# Magiofiles (Obsidian plugin)

Zobrazení poznámek jako stromu „složek“ podle tagů s možností definovat a ukládat více pohledů.

## Vývoj

- Instalace závislostí: `npm install`
- Vývojový build (watch): `npm run dev`
- Produkční build: `npm run build`

Výstupem je `main.js`, `manifest.json` a volitelně `styles.css`. Pro ruční instalaci pluginu do trezoru Obsidianu zkopírujte tyto soubory do `.obsidian/plugins/magiofiles/` ve vašem Vaultu a plugin povolte v Nastavení → Community plugins.

## Stav

MVP: postranní panel s výběrem „Pohledu“, editací úrovní (tagy) a stromem, který seskupuje poznámky dle zadaných tagů (match prefix `#tag/...`).

