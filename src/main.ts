import { App, ItemView, Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, setIcon, Menu } from "obsidian";

const VIEW_TYPE = "magiofiles-view";

type Level = { name: string; tags: string[] };
type ViewCfg = { id: string; name: string; levels: Level[] };

interface MagiofilesSettings {
  views: ViewCfg[];
  activeViewId: string | null;
  sortMode: "alpha" | "alpha-desc" | "count";
  showFileIcons: boolean;
  showCounts: boolean;
}

const DEFAULT_SETTINGS: MagiofilesSettings = {
  views: [{ id: "default", name: "Default", levels: [] }],
  activeViewId: "default",
  sortMode: "alpha",
  showFileIcons: true,
  showCounts: true,
};

function normalizeTag(tag: string): string {
  const t = tag.trim();
  if (!t) return "";
  return t.startsWith("#") ? t : `#${t}`;
}

function parseTagsInput(input: string): string[] {
  return input
    .split(",")
    .map((s) => normalizeTag(s))
    .filter((s) => !!s);
}

export default class MagiofilesPlugin extends Plugin {
  settings!: MagiofilesSettings;

  async onload() {
    await this.loadSettings();

    this.registerView(
      VIEW_TYPE,
      (leaf) => new MagiofilesView(leaf, this)
    );

    this.addRibbonIcon("folder", "Open Magiofiles", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-magiofiles-view",
      name: "Open Magiofiles panel",
      callback: () => this.activateView(),
    });

    this.addSettingTab(new MagiofilesSettingTab(this.app, this));

    // Auto-open once on first load
    if (!this.app.workspace.getLeavesOfType(VIEW_TYPE).length) {
      this.activateView();
    }
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      const newLeaf = workspace.getLeftLeaf(true);
      if (newLeaf) {
        await newLeaf.setViewState({ type: VIEW_TYPE, active: true });
        leaf = newLeaf;
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  getActiveViewCfg(): ViewCfg {
    const id = this.settings.activeViewId ?? this.settings.views[0].id;
    return (
      this.settings.views.find((v) => v.id === id) ?? this.settings.views[0]
    );
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(skipControlsRender = false) {
    await this.saveData(this.settings);
    // notify all open views to refresh
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      const view = leaf.view as MagiofilesView;
      if (skipControlsRender) {
        view?.refreshFromSettings();
      } else {
        view?.render();
      }
    }
  }
}

class MagiofilesView extends ItemView {
  plugin: MagiofilesPlugin;
  containerEl!: HTMLElement;
  treeEl!: HTMLElement;
  controlsEl!: HTMLElement;
  private controlsObserver: MutationObserver | null = null;
  private expandedPaths = new Set<string>();

  constructor(leaf: WorkspaceLeaf, plugin: MagiofilesPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.icon = "folder";
  }

  getDisplayText(): string {
    return "Magiofiles";
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  async onOpen() {
    const container = this.containerEl;
    container.empty();
    container.addClass("magiofiles-view");
    if (this.plugin.settings.showFileIcons) container.addClass("mgf-icons-on"); else container.removeClass("mgf-icons-on");

    this.controlsEl = container.createDiv({ cls: "magiofiles-controls" });
    this.treeEl = container.createDiv({ cls: "magiofiles-tree nav-files nav-files-container" });

    // Initialize default expanded state on first run
    if (this.expandedPaths.size === 0) {
      this.expandedPaths.add("by-tags");
      this.expandedPaths.add("by-folder");
    }

    // Sync key nav variables from native explorer for perfect alignment
    this.syncNavVarsFromExplorer();
    // Re-sync after layout settles and when layout changes
    window.setTimeout(() => this.syncNavVarsFromExplorer(), 250);
    window.setTimeout(() => this.syncNavVarsFromExplorer(), 1000);
    this.registerEvent(this.app.workspace.on("layout-change", () => this.syncNavVarsFromExplorer()));

    this.render();

    // Observe toolbar changes and enforce icon sizing consistently
    try {
      if (!this.controlsObserver) {
        this.controlsObserver = new MutationObserver(() => {
          this.ensureToolbarIconSizing();
        });
        this.controlsObserver.observe(this.controlsEl, { childList: true, subtree: true });
      }
    } catch {}

    // track active file to highlight selection
    this.registerEvent(this.app.workspace.on("file-open", (f) => {
      this.markSelected(f?.path ?? null);
    }));
  }

  async onClose() {}

  render(skipControls = false) {
    if (!skipControls) {
      this.renderControls();
    }
    this.renderTree();
    const active = this.app.workspace.getActiveFile();
    this.markSelected(active?.path ?? null);
  }

  refreshFromSettings() {
    // Only refresh tree, keep controls panel state
    this.renderTree();
    const active = this.app.workspace.getActiveFile();
    this.markSelected(active?.path ?? null);
  }

  updateCounts(showCounts: boolean) {
    // Update counts display without re-rendering
    const flairElements = this.treeEl.querySelectorAll<HTMLElement>('.tree-item-flair');
    flairElements.forEach(flair => {
      flair.style.display = showCounts ? 'inline' : 'none';
    });
  }

  private syncNavVarsFromExplorer() {
    try {
      const native = document.querySelector(
        ".workspace .nav-files-container:not(.magiofiles-tree)"
      ) as HTMLElement | null;
      if (!native) return;
      const cs = getComputedStyle(native);
      
      // Core navigation variables
      const iconSize = cs.getPropertyValue("--icon-size") || "";
      const navIndent = cs.getPropertyValue("--nav-indentation") || "";
      const bg = cs.getPropertyValue("background-color") || "";
      
      // Guide line variables
      const guideColor = cs.getPropertyValue("--nav-indentation-guide-color") || "";
      const guideWidth = cs.getPropertyValue("--nav-indentation-guide-width") || "";
      const guideOffset = cs.getPropertyValue("--nav-indentation-guide-offset") || "";
      
      // Navigation item variables
      const itemPadding = cs.getPropertyValue("--nav-item-padding") || "";
      const itemBorderRadius = cs.getPropertyValue("--nav-item-border-radius") || "";
      const itemBackgroundHover = cs.getPropertyValue("--nav-item-background-hover") || "";
      const itemBackgroundActive = cs.getPropertyValue("--nav-item-background-active") || "";
      const itemBackgroundSelected = cs.getPropertyValue("--nav-item-background-selected") || "";
      const itemColorActive = cs.getPropertyValue("--nav-item-color-active") || "";
      const itemColorSelected = cs.getPropertyValue("--nav-item-color-selected") || "";
      const itemPaddingLeft = cs.getPropertyValue("--nav-item-padding-left") || "";
      const itemPaddingRight = cs.getPropertyValue("--nav-item-padding-right") || "";
      const itemMargin = cs.getPropertyValue("--nav-item-margin") || "";
      const itemIconMargin = cs.getPropertyValue("--nav-item-icon-margin") || "";
      
      // Toolbar icon variables
      const clickableIconSize = cs.getPropertyValue("--clickable-icon-size") || "";
      const iconSizeM = cs.getPropertyValue("--icon-size-m") || "";
      const iconSizeL = cs.getPropertyValue("--icon-size-l") || "";

      const tree = this.treeEl as HTMLElement;
      
      // Apply core variables
      if (iconSize) tree.style.setProperty("--icon-size", iconSize.trim());
      if (navIndent) tree.style.setProperty("--nav-indentation", navIndent.trim());
      if (bg) tree.style.setProperty("--mgf-nav-bg", bg.trim());
      
      // Apply guide line variables
      if (guideColor) tree.style.setProperty("--nav-indentation-guide-color", guideColor.trim());
      if (guideWidth) tree.style.setProperty("--nav-indentation-guide-width", guideWidth.trim());
      if (guideOffset) tree.style.setProperty("--nav-indentation-guide-offset", guideOffset.trim());
      
      // Apply navigation item variables
      if (itemPadding) tree.style.setProperty("--nav-item-padding", itemPadding.trim());
      if (itemBorderRadius) tree.style.setProperty("--nav-item-border-radius", itemBorderRadius.trim());
      if (itemBackgroundHover) tree.style.setProperty("--nav-item-background-hover", itemBackgroundHover.trim());
      if (itemBackgroundActive) tree.style.setProperty("--nav-item-background-active", itemBackgroundActive.trim());
      if (itemBackgroundSelected) tree.style.setProperty("--nav-item-background-selected", itemBackgroundSelected.trim());
      if (itemColorActive) tree.style.setProperty("--nav-item-color-active", itemColorActive.trim());
      if (itemColorSelected) tree.style.setProperty("--nav-item-color-selected", itemColorSelected.trim());
      if (itemPaddingLeft) tree.style.setProperty("--nav-item-padding-left", itemPaddingLeft.trim());
      if (itemPaddingRight) tree.style.setProperty("--nav-item-padding-right", itemPaddingRight.trim());
      if (itemMargin) tree.style.setProperty("--nav-item-margin", itemMargin.trim());
      if (itemIconMargin) tree.style.setProperty("--nav-item-icon-margin", itemIconMargin.trim());
      
      // Apply toolbar icon variables to controls
      const controls = this.controlsEl as HTMLElement;
      // Ensure toolbar also inherits icon-size from native
      if (iconSize) controls.style.setProperty("--icon-size", iconSize.trim());
      if (clickableIconSize) {
        controls.style.setProperty("--clickable-icon-size", clickableIconSize.trim());
      } else {
        // Fallback A: measure native explorer header icon size
        const headerIcon = document.querySelector(
          '.workspace .nav-header .clickable-icon svg, .workspace .nav-header .clickable-icon, .workspace .nav-action-button svg, .workspace .nav-action-button'
        ) as HTMLElement | null;
        let measured = 0;
        if (headerIcon) {
          const rect = headerIcon.getBoundingClientRect();
          measured = Math.max(rect.width, rect.height);
        }
        // Choose a sane size: prefer measurement if >= 12px, else fallback to iconSize or 24px
        const fallbackFromIcon = iconSize ? iconSize.trim() : '24px';
        const chosenPx = (measured && isFinite(measured) ? Math.round(measured) : 0);
        const finalSize = (chosenPx >= 12 ? `${chosenPx}px` : fallbackFromIcon);
        if (finalSize) controls.style.setProperty('--clickable-icon-size', finalSize);
      }

      // After variables set, force-apply inline sizes on existing toolbar icons to beat theme overrides
      const sizeVar = getComputedStyle(controls).getPropertyValue('--clickable-icon-size') || iconSize || '24px';
      const size = (sizeVar || '').trim() || '24px';
      const applyInlineSize = (el: HTMLElement) => {
        el.style.setProperty('width', size, 'important');
        el.style.setProperty('height', size, 'important');
        const svg = el.querySelector('svg') as HTMLElement | null;
        if (svg) {
          svg.style.setProperty('width', size, 'important');
          svg.style.setProperty('height', size, 'important');
        }
      };
      controls.querySelectorAll<HTMLElement>('.clickable-icon').forEach(applyInlineSize);
      if (iconSizeM) controls.style.setProperty("--icon-size-m", iconSizeM.trim());
      if (iconSizeL) controls.style.setProperty("--icon-size-l", iconSizeL.trim());

      // Mirror native paddings for identical left/right spacing
      const pl = cs.getPropertyValue("padding-left");
      const pr = cs.getPropertyValue("padding-right");
      const pt = cs.getPropertyValue("padding-top");
      const pb = cs.getPropertyValue("padding-bottom");
      if (pt) tree.style.paddingTop = pt;
      if (pr) tree.style.paddingRight = pr;
      if (pb) tree.style.paddingBottom = pb;
      if (pl) tree.style.paddingLeft = pl;
    } catch {}
  }

  private renderControls() {
    const cfg = this.plugin.getActiveViewCfg();

    this.controlsEl.empty();
    this.controlsEl.removeClass("has-levels-open");

    // Toolbar icons (native style): settings (levels), sort, views
    const toolbar = this.controlsEl.createDiv({ cls: "view-actions" });

    // a) Settings (levels panel toggle)
    const levelsToggle = toolbar.createSpan({ cls: "clickable-icon" });
    setIcon(levelsToggle, "settings");
    levelsToggle.setAttr("aria-label", "Levels");
    this.applyToolbarIconInlineSize(levelsToggle);

    // b) Sorting menu
    const sortBtn = toolbar.createSpan({ cls: "clickable-icon" });
    const sortIconName = this.plugin.settings.sortMode === "alpha" ? "arrow-up" : this.plugin.settings.sortMode === "alpha-desc" ? "arrow-down" : "bar-chart-2";
    setIcon(sortBtn, sortIconName);
    sortBtn.setAttr("aria-label", "Sort");
    this.applyToolbarIconInlineSize(sortBtn);
    sortBtn.onclick = async (ev) => {
      const menu = new Menu();
      menu.addItem((i) => i.setTitle("A → Z").setIcon("arrow-up").onClick(async ()=>{ this.plugin.settings.sortMode = "alpha"; await this.plugin.saveSettings(); }));
      menu.addItem((i) => i.setTitle("Z → A").setIcon("arrow-down").onClick(async ()=>{ this.plugin.settings.sortMode = "alpha-desc"; await this.plugin.saveSettings(); }));
      menu.addItem((i) => i.setTitle("Count (desc)").setIcon("bar-chart-2").onClick(async ()=>{ this.plugin.settings.sortMode = "count"; await this.plugin.saveSettings(); }));
      menu.showAtPosition({ x: (ev as MouseEvent).clientX, y: (ev as MouseEvent).clientY });
    };

    // c) Saved views menu
    const viewsBtn = toolbar.createSpan({ cls: "clickable-icon" });
    setIcon(viewsBtn, "layers");
    viewsBtn.setAttr("aria-label", "Views");
    this.applyToolbarIconInlineSize(viewsBtn);
    viewsBtn.onclick = (ev) => {
      const menu = new Menu();
      for (const v of this.plugin.settings.views) {
        menu.addItem((i) =>
          i.setTitle(v.name)
            .setIcon(v.id === (this.plugin.settings.activeViewId ?? "default") ? "check" : "circle")
            .onClick(async () => {
              this.plugin.settings.activeViewId = v.id;
              await this.plugin.saveSettings();
            })
        );
      }
      menu.showAtPosition({ x: (ev as MouseEvent).clientX, y: (ev as MouseEvent).clientY });
    };

    // Global tags suggestions (with counts, sorted by count desc)
    const tagCounts = collectTagCounts(this.app).sort((a,b)=> b.count - a.count || a.name.localeCompare(b.name));

    // Levels table (inline edit)
    const levelsWrap = this.controlsEl.createDiv({ cls: "magiofiles-levels" });
    levelsWrap.style.display = "none";
    levelsToggle.onclick = async () => {
      const visible = levelsWrap.style.display !== "none";
      if (visible) {
        levelsWrap.style.display = "none";
        this.controlsEl.removeClass("has-levels-open");
        return;
      }
      // Opening: ensure at least one level exists and keep panel open
      if (cfg.levels.length === 0) {
        cfg.levels.push({ name: "Level 1", tags: [] });
        await this.plugin.saveSettings();
        // re-render controls to show the first row, then reopen
        this.renderControls();
        const nw = this.controlsEl.querySelector<HTMLElement>(".magiofiles-levels");
        if (nw) {
          nw.style.display = "block";
          this.controlsEl.addClass("has-levels-open");
        }
        return;
      }
      levelsWrap.style.display = "block";
      this.controlsEl.addClass("has-levels-open");
    };
    const header = levelsWrap.createDiv({ text: "Levels (tags form folders)" });
    header.addClass("mgf-muted");

    cfg.levels.forEach((level, idx) => {
      const row = levelsWrap.createDiv({ cls: "magiofiles-level" });
      // level name
      const nameInput = row.createEl("input", { type: "text", value: level.name || `Level ${idx + 1}` });
      nameInput.onchange = async () => {
        level.name = nameInput.value || `Level ${idx + 1}`;
        await this.plugin.saveSettings(true);
      };
      // tags picker (multi-select with suggestions)
      const pickerWrap = row.createDiv({ cls: "mgf-tagpicker", attr: { "data-idx": String(idx) } });
      createTagPicker(pickerWrap, level.tags.map(stripHash), tagCounts, async (tagsNoHash) => {
        level.tags = tagsNoHash.map(normalizeTag);
        await this.plugin.saveSettings(true);
      });
      // remove button
      const delBtn = row.createEl("button", { text: "Remove" });
      delBtn.onclick = async () => {
        cfg.levels.splice(idx, 1);
        await this.plugin.saveSettings();
        // Re-open the panel after render
        setTimeout(() => {
          const levelsPanel = this.controlsEl.querySelector<HTMLElement>(".magiofiles-levels");
          if (levelsPanel) {
            levelsPanel.style.display = "block";
            this.controlsEl.addClass("has-levels-open");
          }
        }, 10);
      };
    });

    const addLevelBtn = levelsWrap.createEl("button", { text: "+ Add level" });
    addLevelBtn.onclick = async () => {
      cfg.levels.push({ name: `Level ${cfg.levels.length + 1}`, tags: [] });
      await this.plugin.saveSettings();
      // Re-open the panel after render
      setTimeout(() => {
        const levelsPanel = this.controlsEl.querySelector<HTMLElement>(".magiofiles-levels");
        if (levelsPanel) {
          levelsPanel.style.display = "block";
          this.controlsEl.addClass("has-levels-open");
        }
      }, 10);
    };

    // === SAVED VIEWS SECTION ===
    const viewsHeader = levelsWrap.createDiv({ text: "Saved Views", cls: "mgf-muted" });
    viewsHeader.style.marginTop = "20px";

    const viewsList = levelsWrap.createDiv({ cls: "magiofiles-views-list" });

    // Display all views with edit/delete
    this.plugin.settings.views.forEach(view => {
      const row = viewsList.createDiv({ cls: "magiofiles-view-item" });
      
      const nameSpan = row.createSpan({ text: view.name, cls: "mgf-view-name" });
      if (view.id === this.plugin.settings.activeViewId) {
        nameSpan.addClass("mgf-active-view");
      }
      
      const actions = row.createDiv({ cls: "mgf-view-actions" });
      
      // Edit button
      const editBtn = actions.createEl("button", { text: "Edit" });
      editBtn.onclick = async () => {
        const newName = prompt("View name:", view.name);
        if (newName && newName.trim()) {
          view.name = newName.trim();
          await this.plugin.saveSettings();
        }
      };
      
      // Delete button
      const delBtn = actions.createEl("button", { text: "Delete" });
      delBtn.onclick = async () => {
        if (this.plugin.settings.views.length === 1) {
          new Notice("Cannot delete the last view");
          return;
        }
        this.plugin.settings.views = this.plugin.settings.views.filter(v => v.id !== view.id);
        if (this.plugin.settings.activeViewId === view.id) {
          this.plugin.settings.activeViewId = this.plugin.settings.views[0].id;
        }
        await this.plugin.saveSettings();
      };
    });

    // Add new view button
    const addViewBtn = levelsWrap.createEl("button", { text: "+ Add View" });
    addViewBtn.onclick = async () => {
      const name = prompt("New view name:", "New View");
      if (name && name.trim()) {
        const newView = {
          id: `view-${Date.now()}`,
          name: name.trim(),
          levels: JSON.parse(JSON.stringify(cfg.levels)) // deep copy current levels
        };
        this.plugin.settings.views.push(newView);
        await this.plugin.saveSettings();
      }
    };
  }

  // Ensure a toolbar icon has explicit inline width/height based on current variables
  private applyToolbarIconInlineSize(el: HTMLElement) {
    try {
      // Force a sane constant size to defeat theme overrides
      const val = '28px';
      el.style.setProperty('width', val, 'important');
      el.style.setProperty('height', val, 'important');
      const svg = el.querySelector('svg') as HTMLElement | null;
      if (svg) {
        svg.style.setProperty('width', val, 'important');
        svg.style.setProperty('height', val, 'important');
      }
    } catch {}
  }

  private ensureToolbarIconSizing() {
    try {
      const icons = this.controlsEl.querySelectorAll<HTMLElement>('.view-actions .clickable-icon');
      icons.forEach((el) => this.applyToolbarIconInlineSize(el));
    } catch {}
  }

  private renderTree() {
    const cfg = this.plugin.getActiveViewCfg();
    this.treeEl.empty();

    const allFiles = this.app.vault.getFiles();
    const mdFiles = this.app.vault.getMarkdownFiles();

    if (!allFiles.length) {
      this.treeEl.createDiv({ text: "No files.", cls: "mgf-muted" });
      return;
    }

    // Prepare tags for markdown files
    const fileTags = new Map<TFile, Set<string>>();
    for (const f of mdFiles) fileTags.set(f, collectTagsForFile(this.app, f));

    // Select files that match at least one configured level tag (md only)
    const matched: Set<TFile> = new Set();
    for (const f of mdFiles) {
      let any = false;
      for (const lvl of cfg.levels) {
        if (tagMatchesAny(fileTags.get(f) ?? new Set(), lvl.tags)) { any = true; break; }
      }
      if (any) matched.add(f);
    }

    // Build By Tags tree (only from matched)
    const tagsRoot: GroupNode = { name: "root", level: -1, files: new Set(matched), children: new Map() };
    for (let lv = 0; lv < cfg.levels.length; lv++) {
      const levelCfg = cfg.levels[lv];
      propagateLevel(tagsRoot, levelCfg.tags, fileTags, lv);
    }

    // Build By Folder tree (mirror of vault) from files NOT in matched
    const folderRoot: GroupNode = { name: "root", level: -1, children: new Map(), files: new Set() };
    for (const f of allFiles) {
      if (matched.has(f)) continue; // no duplicates
      addFileToFolderTree(folderRoot, f.path, f);
    }

    // Render section headers at root level (no extra indentation)

    // By Tags section header
    const tagsItem = this.treeEl.createDiv({ cls: "tree-item nav-folder has-children" });
    const tagsSelf = tagsItem.createDiv({ cls: "tree-item-self nav-folder-title" });
    const tagsChevron = tagsSelf.createSpan({ cls: "tree-item-icon collapse-icon nav-folder-collapse-indicator" });
    setIcon(tagsChevron, "chevron-down");
    tagsSelf.createSpan({ text: "By Tags", cls: "tree-item-inner" });
    if (this.plugin.settings.showCounts) {
      tagsSelf.createSpan({ text: ` (${countFiles(tagsRoot)})`, cls: "tree-item-flair" });
    }
    const tagsWrap = tagsItem.createDiv({ cls: "tree-item-children nav-folder-children" });
    const tagsPath = "by-tags";
    let tagsExpanded = this.expandedPaths.has(tagsPath);
    const toggleTags = () => {
      tagsExpanded = !tagsExpanded;
      if (tagsExpanded) {
        this.expandedPaths.add(tagsPath);
      } else {
        this.expandedPaths.delete(tagsPath);
      }
      tagsItem.toggleClass("is-collapsed", !tagsExpanded);
      tagsSelf.setAttr("aria-expanded", tagsExpanded ? "true" : "false");
      tagsSelf.toggleClass("is-collapsed", !tagsExpanded);
      tagsWrap.style.display = tagsExpanded ? "block" : "none";
    };
    // Initialize state
    if (!tagsExpanded) {
      tagsItem.addClass("is-collapsed");
      tagsSelf.addClass("is-collapsed");
      tagsWrap.style.display = "none";
    }
    tagsSelf.onclick = toggleTags;
    if (tagsRoot.children && tagsRoot.children.size) {
      for (const [name, child] of getSortedEntries(tagsRoot.children, this.plugin.settings.sortMode)) this.renderGroup(child, tagsWrap, name, "by-tags");
    } else {
      tagsWrap.createDiv({ text: "Empty", cls: "mgf-muted" });
    }

    // By Folders section header
    const folderItem = this.treeEl.createDiv({ cls: "tree-item nav-folder has-children" });
    const folderSelf = folderItem.createDiv({ cls: "tree-item-self nav-folder-title" });
    const folderChevron = folderSelf.createSpan({ cls: "tree-item-icon collapse-icon nav-folder-collapse-indicator" });
    setIcon(folderChevron, "chevron-down");
    folderSelf.createSpan({ text: "By Folder", cls: "tree-item-inner" });
    if (this.plugin.settings.showCounts) {
      folderSelf.createSpan({ text: ` (${countFiles(folderRoot)})`, cls: "tree-item-flair" });
    }
    const folderWrap = folderItem.createDiv({ cls: "tree-item-children nav-folder-children" });
    const folderPath = "by-folder";
    let folderExpanded = this.expandedPaths.has(folderPath);
    const toggleFolder = () => {
      folderExpanded = !folderExpanded;
      if (folderExpanded) {
        this.expandedPaths.add(folderPath);
      } else {
        this.expandedPaths.delete(folderPath);
      }
      folderItem.toggleClass("is-collapsed", !folderExpanded);
      folderSelf.setAttr("aria-expanded", folderExpanded ? "true" : "false");
      folderSelf.toggleClass("is-collapsed", !folderExpanded);
      folderWrap.style.display = folderExpanded ? "block" : "none";
    };
    // Initialize state
    if (!folderExpanded) {
      folderItem.addClass("is-collapsed");
      folderSelf.addClass("is-collapsed");
      folderWrap.style.display = "none";
    }
    folderSelf.onclick = toggleFolder;
    if (folderRoot.children && folderRoot.children.size) {
      for (const [name, child] of getSortedEntries(folderRoot.children, this.plugin.settings.sortMode)) this.renderGroup(child, folderWrap, name, "by-folder");
    }
    if (folderRoot.files && folderRoot.files.size) {
      for (const f of [...folderRoot.files].sort((a,b)=>a.basename.localeCompare(b.basename))) this.renderFile(f, folderWrap);
    }
  }

  private renderGroup(node: GroupNode, parent: HTMLElement, displayName: string, parentPath = "") {
    const item = parent.createDiv({ cls: "tree-item nav-folder has-children" });
    const self = item.createDiv({ cls: "tree-item-self nav-folder-title" });
    const chevron = self.createSpan({ cls: "tree-item-icon collapse-icon nav-folder-collapse-indicator" });
    setIcon(chevron, "chevron-down");
    const iconSpacer = self.createSpan({ cls: "tree-item-icon" });
    setIcon(iconSpacer, "folder");
    (iconSpacer as HTMLElement).style.opacity = "0";
    (iconSpacer as HTMLElement).style.pointerEvents = "none";
    iconSpacer.setAttr("aria-hidden", "true");
    self.createSpan({ text: displayName, cls: "tree-item-inner" });
    if (this.plugin.settings.showCounts) {
      const count = countFiles(node);
      self.createSpan({ text: ` (${count})`, cls: "tree-item-flair" });
    }

    const childrenWrap = item.createDiv({ cls: "tree-item-children nav-folder-children" });
    const fullPath = parentPath ? `${parentPath}/${displayName}` : displayName;
    let expanded = this.expandedPaths.has(fullPath);
    const toggle = () => {
      expanded = !expanded;
      if (expanded) {
        this.expandedPaths.add(fullPath);
      } else {
        this.expandedPaths.delete(fullPath);
      }
      item.toggleClass("is-collapsed", !expanded);
      self.setAttr("aria-expanded", expanded ? "true" : "false");
      self.toggleClass("is-collapsed", !expanded);
      childrenWrap.style.display = expanded ? "block" : "none";
    };
    // Initialize state
    if (!expanded) {
      item.addClass("is-collapsed");
      self.addClass("is-collapsed");
      childrenWrap.style.display = "none";
    }
    self.onclick = toggle;

    if (node.children && node.children.size) {
      for (const [name, child] of getSortedEntries(node.children, this.plugin.settings.sortMode)) this.renderGroup(child, childrenWrap, name, fullPath);
    }
    if (node.files && node.files.size) {
      for (const f of [...node.files].sort((a,b)=>a.basename.localeCompare(b.basename))) this.renderFile(f, childrenWrap);
    }
  }

  private renderFile(file: TFile, parent: HTMLElement) {
    const item = parent.createDiv({ cls: "tree-item nav-file" });
    const self = item.createDiv({ cls: "tree-item-self nav-file-title" });
    // Set position relative for icon positioning
    (self as HTMLElement).style.position = "relative";
    
    if (this.plugin.settings.showFileIcons) {
      const ico = self.createSpan({ cls: "tree-item-icon" });
      setIcon(ico, "file" );
    }
    const name = self.createSpan({ cls: "tree-item-inner" });
    name.setText(file.basename);
    (self as HTMLElement).dataset.path = file.path;
    item.onclick = () => {
      this.app.workspace.getLeaf(true).openFile(file);
      this.markSelected(file.path);
    };
  }

  private markSelected(path: string | null) {
    const nodes = this.treeEl.querySelectorAll<HTMLElement>(".nav-file .nav-file-title");
    nodes.forEach((el) => {
      const isActive = (el.dataset.path ?? "") === (path ?? "");
      el.toggleClass("is-active", isActive);
      el.toggleClass("is-selected", isActive);
    });
  }
}

// ---- Grouping helpers ----
type GroupNode = {
  name: string;
  level: number;
  children?: Map<string, GroupNode>;
  files?: Set<TFile>;
};

function collectTagsForFile(app: App, file: TFile): Set<string> {
  const cache = app.metadataCache.getFileCache(file);
  const out = new Set<string>();
  // Inline tags
  const inline = (cache?.tags ?? []) as { tag: string }[];
  for (const t of inline) out.add(t.tag);
  // Frontmatter tags
  const fm: any = cache?.frontmatter;
  const fmTags = fm?.tags;
  if (typeof fmTags === "string") out.add(normalizeTag(fmTags));
  else if (Array.isArray(fmTags)) for (const t of fmTags) out.add(normalizeTag(String(t)));
  return out;
}

function collectTagCounts(app: App): { name: string; count: number }[] {
  const map = new Map<string, number>();
  const files = app.vault.getMarkdownFiles();
  for (const f of files) {
    const set = collectTagsForFile(app, f);
    for (const t of set) {
      const key = stripHash(t);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }
  return [...map.entries()].map(([name, count]) => ({ name, count }));
}

function tagMatchesAny(tagSet: Set<string>, wanted: string[]): string | null {
  // match exact or prefix (wanted is e.g. #proj, so #proj/x matches too)
  for (const w of wanted) {
    for (const t of tagSet) {
      if (t === w || t.startsWith(w + "/")) return w;
    }
  }
  return null;
}

function propagateLevel(root: GroupNode, levelTags: string[], fileTags: Map<TFile, Set<string>>, levelIdx: number) {
  // We split files in this node (and its descendants) by the given level tags.
  const queue: GroupNode[] = [root];
  while (queue.length) {
    const node = queue.pop()!;
    // Only split nodes that currently hold files
    if (!node.files || !node.files.size) {
      if (node.children) for (const child of node.children.values()) queue.push(child);
      continue;
    }
    node.children = node.children ?? new Map();
    const remaining: TFile[] = [];
    for (const f of node.files) {
      const match = tagMatchesAny(fileTags.get(f)!, levelTags);
      if (match) {
        const key = stripHash(match);
        let bucket = node.children.get(key);
        if (!bucket) {
          bucket = { name: key, level: levelIdx, children: new Map(), files: new Set() };
          node.children.set(key, bucket);
        }
        bucket.files!.add(f);
      } else {
        remaining.push(f);
      }
    }
    // Put remaining into "Ostatní"
    if (remaining.length) {
      const key = "Others";
      let bucket = node.children.get(key);
      if (!bucket) {
        bucket = { name: key, level: levelIdx, children: new Map(), files: new Set() };
        node.children.set(key, bucket);
      }
      for (const f of remaining) bucket.files!.add(f);
    }
    // After split, clear files on parent node
    node.files.clear();
  }
}

function stripHash(tag: string): string {
  return tag.startsWith("#") ? tag.slice(1) : tag;
}

function countFiles(node: GroupNode): number {
  let sum = 0;
  if (node.files) sum += node.files.size;
  if (node.children) for (const child of node.children.values()) sum += countFiles(child);
  return sum;
}

function addFileToFolderTree(root: GroupNode, fullPath: string, file: TFile) {
  // Build tree by splitting path into folders and filename; we only create folder nodes for directories.
  const parts = fullPath.split("/");
  const fileName = parts.pop()!; // actual filename
  let node = root;
  for (const folderName of parts) {
    node.children = node.children ?? new Map();
    let next = node.children.get(folderName);
    if (!next) {
      next = { name: folderName, level: (node.level ?? -1) + 1, children: new Map(), files: new Set() };
      node.children.set(folderName, next);
    }
    node = next;
  }
  node.files = node.files ?? new Set();
  node.files.add(file);
}

function getSortedEntries(map: Map<string, GroupNode>, mode: "alpha" | "alpha-desc" | "count"): [string, GroupNode][] {
  const arr = [...map.entries()];
  if (mode === "count") {
    return arr.sort((a, b) => {
      const ca = countFiles(a[1]);
      const cb = countFiles(b[1]);
      if (cb !== ca) return cb - ca;
      return a[0].localeCompare(b[0]);
    });
  }
  if (mode === "alpha-desc") {
    return arr.sort((a, b) => b[0].localeCompare(a[0]));
  }
  // alpha
  return arr.sort((a, b) => a[0].localeCompare(b[0]));
}

class MagiofilesSettingTab extends PluginSettingTab {
  plugin: MagiofilesPlugin;
  constructor(app: App, plugin: MagiofilesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Magiofiles Settings" });

    new Setting(containerEl)
      .setName("Active view")
      .setDesc("Select which view to show in the panel.")
      .addDropdown((dd) => {
        for (const v of this.plugin.settings.views) dd.addOption(v.id, v.name);
        dd.setValue(this.plugin.settings.activeViewId ?? "default");
        dd.onChange(async (val) => {
          this.plugin.settings.activeViewId = val;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Show file icons")
      .setDesc("Display icons next to files in the tree.")
      .addToggle((t) => t.setValue(this.plugin.settings.showFileIcons).onChange(async (v) => {
        this.plugin.settings.showFileIcons = v;
        // Update CSS immediately without re-rendering
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
          const view = leaf.view as MagiofilesView;
          if (view?.containerEl) {
            if (v) {
              view.containerEl.addClass("mgf-icons-on");
            } else {
              view.containerEl.removeClass("mgf-icons-on");
            }
          }
        }
        await this.plugin.saveSettings(true);
      }));

    new Setting(containerEl)
      .setName("Show counts")
      .setDesc("Display file counts next to folders.")
      .addToggle((t) => t.setValue(this.plugin.settings.showCounts).onChange(async (v) => {
        this.plugin.settings.showCounts = v;
        // Update counts display immediately
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
          const view = leaf.view as MagiofilesView;
          view?.updateCounts(v);
        }
        await this.plugin.saveSettings(true);
      }));

    containerEl.createEl("p", { 
      text: "Manage views and levels using the settings icon (⚙) in the Magiofiles panel.",
      cls: "setting-item-description"
    });
  }
}

// Simple prompt modal using browser prompt as a fallback
async function promptModal(app: App, title: string, value: string): Promise<string | null> {
  // For simplicity use window.prompt; can be replaced by nicer modal later.
  return Promise.resolve(window.prompt(title, value));
}

// --- Tag picker (multi-select with suggestions) ---
function createTagPicker(parent: HTMLElement, initial: string[], suggestions: {name: string; count: number}[], onChange: (tagsNoHash: string[]) => void) {
  let selected = Array.from(new Set(initial.map(stripHash)));
  parent.empty();
  parent.addClass("mgf-tagpicker");
  parent.style.position = "relative";

  const list = parent.createDiv({ cls: "mgf-chip-list" });
  const input = parent.createEl("input", { type: "text" });
  input.addClass("mgf-taginput");
  input.placeholder = selected.length ? "" : "tag1, tag2/sub";

  const dropdown = parent.createDiv({ cls: "mgf-suggest" });
  dropdown.hide();

  function renderChips() {
    list.empty();
    for (const t of selected) {
      const chip = list.createSpan({ cls: "mgf-chip" });
      chip.createSpan({ text: t });
      const rm = chip.createSpan({ cls: "mgf-chip-x", text: "×" });
      rm.onclick = () => {
        selected = selected.filter((x) => x !== t);
        renderChips();
        onChange(selected);
        updateDropdown();
      };
    }
  }

  function updateDropdown() {
    const q = input.value.trim().toLowerCase();
    dropdown.empty();
    const avail = suggestions.filter((s) => !selected.includes(s.name));
    const filtered = q ? avail.filter((s) => s.name.toLowerCase().includes(q)) : avail;
    if (!filtered.length) {
      dropdown.hide();
      return;
    }
    for (const s of filtered.slice(0, 400)) {
      const item = dropdown.createDiv({ cls: "mgf-suggest-item" });
      item.createSpan({ text: s.name });
      const c = item.createSpan({ cls: "mgf-muted", text: ` (${s.count})` });
      item.onclick = () => {
        if (!selected.includes(s.name)) selected.push(s.name);
        input.value = "";
        renderChips();
        onChange(selected);
        updateDropdown();
        input.focus();
      };
    }
    dropdown.show();
  }

  function commitInput() {
    const raw = input.value.split(",").map((x) => x.trim()).filter(Boolean);
    if (!raw.length) return;
    for (const r of raw) if (!selected.includes(r)) selected.push(r);
    input.value = "";
    renderChips();
    onChange(selected);
    updateDropdown();
  }

  input.oninput = () => updateDropdown();
  input.onfocus = () => updateDropdown();
  input.onblur = () => setTimeout(() => dropdown.hide(), 150);
  input.onkeydown = (ev: KeyboardEvent) => {
    if (ev.key === "Enter" || ev.key === ",") {
      ev.preventDefault();
      commitInput();
    } else if (ev.key === "Backspace" && !input.value && selected.length) {
      selected.pop();
      renderChips();
      onChange(selected);
      updateDropdown();
    }
  };

  parent.onclick = (e) => {
    if (e.target === parent) input.focus();
  };

  renderChips();
}
