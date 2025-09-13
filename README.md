# Magiofiles (Obsidian Plugin)

A dynamic file explorer for Obsidian that organizes notes into tree structures based on tags, with support for multiple saved views and hierarchical tag grouping.

## Features

### Core Functionality
- **Tag-based organization**: Groups notes by tags into hierarchical folder-like structures
- **Multi-level grouping**: Define multiple hierarchy levels, each filtering by specific tags
- **Dual view mode**: 
  - "By Tags" - shows notes organized by configured tag hierarchies
  - "By Folder" - displays remaining files in their vault folder structure
- **Saved views**: Create, edit, and switch between multiple organizational schemes

### Interface
- **Sidebar panel**: Integrates seamlessly with Obsidian's left sidebar
- **Toolbar controls**: 
  - Settings (⚙️) - configure levels and manage views
  - Sort (↕️) - alphabetical (A→Z, Z→A) or by count
  - Views (📋) - quick switch between saved configurations
- **Tag picker**: Auto-complete interface for tag selection with usage counts
- **Live updates**: Changes reflect immediately without full panel refresh

### Customization
- **File icons**: Optional file type icons (can be toggled in settings)
- **Count display**: Show/hide file counts next to folders
- **Native styling**: Inherits colors, spacing, and behavior from your current theme
- **Expandable sections**: Collapsible "By Tags" and "By Folder" sections with state persistence

### Settings
- **Global settings**: Configure active view, file icons, and count display
- **Level editor**: Define tag hierarchies with intuitive name/tags interface
- **View management**: Create, rename, and delete organizational schemes
- **Tag autocomplete**: Suggests existing tags with usage statistics

## How It Works

1. **Define levels**: Create hierarchical grouping rules (e.g., Level 1: `#project`, Level 2: `#status`)
2. **Tag matching**: Notes with matching tags appear in corresponding folders
3. **Prefix matching**: Supports nested tags (e.g., `#project/work` matches `#project`)
4. **Fallback grouping**: Unmatched notes go to "Others" category
5. **Dual organization**: Tagged notes in "By Tags", remaining files in "By Folder"

## Installation

### Development Setup
- Install dependencies: `npm install`
- Development build (watch): `npm run dev`  
- Production build: `npm run build`
- Type checking: `npm run check`

### Manual Installation
Copy `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/magiofiles/` in your vault, then enable the plugin in Settings → Community plugins.

## Usage

1. **Open panel**: Click the folder icon in the ribbon or use Command Palette
2. **Configure levels**: Click the settings icon (⚙️) to define tag hierarchies
3. **Create views**: Use "Add View" to save different organizational schemes
4. **Browse files**: Navigate the tag-based and folder-based trees
5. **Customize**: Toggle file icons and counts in main settings

## Next Features

- **Dynamic toolbar icon sizing**: Automatic detection and synchronization of toolbar icon sizes from native Obsidian explorer themes

---

# Magiofiles (Obsidian Plugin) - Czech

Dynamický průzkumník souborů pro Obsidian, který organizuje poznámky do stromových struktur podle tagů s podporou více uložených pohledů a hierarchického seskupování tagů.

## Funkce

### Základní funkcionalita
- **Organizace podle tagů**: Seskupuje poznámky podle tagů do hierarchických struktur podobných složkám
- **Víceúrovňové seskupování**: Definice více hierarchických úrovní, každá filtruje podle konkrétních tagů
- **Duální režim zobrazení**:
  - "By Tags" - zobrazuje poznámky organizované podle nakonfigurovaných tag hierarchií
  - "By Folder" - zobrazuje zbývající soubory ve struktuře složek vaultu
- **Uložené pohledy**: Vytvoření, úprava a přepínání mezi více organizačními schématy

### Rozhraní
- **Postranní panel**: Bezproblémová integrace s levým postranním panelem Obsidianu
- **Ovládací prvky toolbaru**:
  - Nastavení (⚙️) - konfigurace úrovní a správa pohledů
  - Řazení (↕️) - abecedně (A→Z, Z→A) nebo podle počtu
  - Pohledy (📋) - rychlé přepínání mezi uloženými konfiguracemi
- **Výběr tagů**: Rozhraní s automatickým dokončováním pro výběr tagů s počty použití
- **Živé aktualizace**: Změny se projeví okamžitě bez kompletního obnovení panelu

### Přizpůsobení
- **Ikony souborů**: Volitelné ikony typů souborů (lze přepnout v nastavení)
- **Zobrazení počtů**: Zobrazit/skrýt počty souborů vedle složek
- **Nativní styling**: Dědí barvy, rozestupy a chování z aktuálního tématu
- **Rozbalitelné sekce**: Sbalitelné sekce "By Tags" a "By Folder" s uchováním stavu

### Nastavení
- **Globální nastavení**: Konfigurace aktivního pohledu, ikon souborů a zobrazení počtů
- **Editor úrovní**: Definice hierarchií tagů s intuitivním rozhraním název/tagy
- **Správa pohledů**: Vytvoření, přejmenování a mazání organizačních schémat
- **Automatické dokončování tagů**: Navrhuje existující tagy se statistikami použití

## Jak to funguje

1. **Definice úrovní**: Vytvoření hierarchických pravidel seskupování (např. Úroveň 1: `#projekt`, Úroveň 2: `#stav`)
2. **Párování tagů**: Poznámky s odpovídajícími tagy se objeví v příslušných složkách
3. **Párování prefixu**: Podporuje vnořené tagy (např. `#projekt/práce` odpovídá `#projekt`)
4. **Záložní seskupování**: Nespárované poznámky jdou do kategorie "Others"
5. **Duální organizace**: Otagované poznámky v "By Tags", zbývající soubory v "By Folder"

## Instalace

### Vývojové prostředí
- Instalace závislostí: `npm install`
- Vývojový build (watch): `npm run dev`
- Produkční build: `npm run build`
- Kontrola typů: `npm run check`

### Ruční instalace
Zkopírujte `main.js`, `manifest.json` a `styles.css` do `.obsidian/plugins/magiofiles/` ve vašem vaultu, poté povolte plugin v Nastavení → Community plugins.

## Použití

1. **Otevření panelu**: Klikněte na ikonu složky na ribbonu nebo použijte Command Palette
2. **Konfigurace úrovní**: Klikněte na ikonu nastavení (⚙️) pro definici hierarchií tagů
3. **Vytvoření pohledů**: Použijte "Add View" pro uložení různých organizačních schémat
4. **Procházení souborů**: Navigace ve stromech založených na tazích a složkách
5. **Přizpůsobení**: Přepínání ikon souborů a počtů v hlavních nastaveních

## Budoucí funkce

- **Dynamická velikost ikon toolbaru**: Automatická detekce a synchronizace velikostí ikon toolbaru z nativních témat Obsidian exploreru