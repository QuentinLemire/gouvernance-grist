/*
 * =====================================================================
 *  Structure du document et analyse des widgets — outils d'administration
 * =====================================================================
 *
 *  À quoi ça sert
 *  --------------
 *  Les pages d'administration (Explorateur, Santé, Atelier…) ont toutes besoin
 *  de la même chose : savoir quelles tables, colonnes, pages et vues contient
 *  le document, et ce que fait chaque widget (tables et colonnes qu'il lit,
 *  adresses internet qu'il appelle). Ce fichier le fait une seule fois pour toutes.
 *
 *  Comment l'utiliser
 *  ------------------
 *  Après grist-plugin-api.js et commun/outils.js :
 *      <script src="commun/structure.js"></script>
 *      const doc = await Structure.lire();            // tables, pages, sections
 *      const w = Structure.widget(section);           // réglages d'une vue « widget »
 *      const a = await Structure.analyserWidget(section, doc);
 *      // a.tables  : [{ id, colonnes: ['Nom', …] }]  tables et colonnes utilisées
 *      // a.absentes: ['Utilisateurs']                tables citées mais absentes du document
 *      // a.sorties : [{ domaine, adresses: [{ url, genre }] }]  appels vers internet
 *      // a.ecrit : le widget écrit-il dans le document ? a.jeton : false, 'lecture' ou 'ecriture' (jeton d'accès à l'API)
 *      Structure.typeFrancais('Ref:Gouv_Entites')     // « Réf. → Gouv_Entites »
 *
 *  Lecture seule : rien n'est écrit dans le document.
 *
 *  Comment l'analyse trouve les tables et colonnes
 *  -----------------------------------------------
 *  On ne devine pas en lisant le code « comme un programme » (trop fragile : nos
 *  widgets nomment leurs tables par des variables). On part du DICTIONNAIRE du
 *  document : chaque table dont le nom apparaît entre guillemets dans le code est
 *  utilisée ; parmi ses colonnes, celles dont le nom apparaît comme champ
 *  (.Nom, 'Nom', Nom:) le sont aussi. La table affichée par la vue compte toujours.
 */
window.Structure = (() => {
  const META = ['_grist_Tables', '_grist_Tables_column', '_grist_Views', '_grist_Views_section',
    '_grist_Views_section_field', '_grist_Pages'];

  // ===== 1. Lecture de la structure =====

  /**
   * Lit la structure complète du document (tables, colonnes, pages, vues).
   * @returns {Promise<{tables: Object[], pages: Object[], sections: Object[], table: Function}>}
   *   - tables   : [{ ref, id, resume, colonnes: [{ ref, id, libelle, type, formule, texteFormule,
   *                 declencheur, detachee }] }]   (resume : table de regroupement)
   *   - pages    : [{ id, vue, nom, niveau }] dans l'ordre du menu (niveau 1 = sous-page)
   *   - sections : [{ ref, vue, titre, table, genre, options, champs: ['Nom', …] }]
   *   - table(id): la table de cet identifiant, ou undefined
   */
  async function lire() {
    const [T, C, V, S, F, P] = (await Promise.all(META.map((t) => grist.docApi.fetchTable(t)))).map(Outils.enLignes);
    const colonnesDe = (ref) => C
      .filter((c) => c.parentId === ref && c.colId !== 'manualSort' && !c.colId.startsWith('gristHelper_'))
      .sort((a, b) => a.parentPos - b.parentPos)
      .map((c) => ({
        ref: c.id, id: c.colId, libelle: c.label || c.colId, type: c.type,
        formule: !!c.isFormula, texteFormule: c.formula || '',
        // colonne de données avec formule de déclenchement : 0 = à la création, 2 = à chaque modification
        declencheur: !c.isFormula && c.formula ? c.recalcWhen : null,
        detachee: !!c.untieColIdFromLabel,
      }));
    const tables = T.filter((t) => !t.tableId.startsWith('GristHidden'))
      .map((t) => ({ ref: t.id, id: t.tableId, resume: !!t.summarySourceTable, colonnes: colonnesDe(t.id) }));
    const idTable = new Map(T.map((t) => [t.id, t.tableId]));
    const idColonne = new Map(C.map((c) => [c.id, c.colId]));
    const vues = new Map(V.map((v) => [v.id, v.name]));
    const pages = P.slice().sort((a, b) => a.pagePos - b.pagePos)
      .map((p) => ({ id: p.id, vue: p.viewRef, nom: vues.get(p.viewRef) || '', niveau: p.indentation || 0 }));
    // seules les vues posées sur une page (les vues « brutes » des données source n'ont pas de page)
    const sections = S.filter((s) => vues.has(s.parentId)).map((s) => ({
      ref: s.id, vue: s.parentId, titre: s.title || '', table: idTable.get(s.tableRef) || '', genre: s.parentKey,
      options: s.options || '',
      champs: F.filter((f) => f.parentId === s.id).sort((a, b) => a.parentPos - b.parentPos).map((f) => idColonne.get(f.colRef)),
    }));
    return { tables, pages, sections, table: (id) => tables.find((t) => t.id === id) };
  }

  /** Nom de la page qui contient une vue, avec sa page parente (« Pilotage › Fiche d'arrivée »). */
  function cheminPage(doc, vue) {
    const i = doc.pages.findIndex((p) => p.vue === vue);
    if (i < 0) return '(page inconnue)';
    const p = doc.pages[i];
    if (!p.niveau) return p.nom;
    const parent = doc.pages.slice(0, i).reverse().find((q) => q.niveau < p.niveau);
    return (parent ? parent.nom + ' › ' : '') + p.nom;
  }

  // ===== 2. Réglages d'un widget =====

  /**
   * Réglages d'une vue « widget personnalisé ». Grist range l'essentiel dans options.customView,
   * une chaîne JSON : adresse du widget, niveau d'accès et, pour le « Custom widget builder »,
   * le code lui-même (widgetOptions._js et _html).
   * @param {Object} section  une section de Structure.lire()
   * Widget de la galerie Grist (Markdown, Graphique, TCD…) : Grist n'enregistre pas son adresse (url vide), seulement
   * son identifiant (widgetId, ex. « @gristlabs/widget-markdown ») et sa fiche (widgetDef, avec l'adresse publique).
   * @returns {{url: string, acces: string, builder: boolean, galerie: string, nomGalerie: string, js: string, html: string, colonnesLiees: Object}}
   */
  function widget(section) {
    let o = {};
    try { o = JSON.parse(section.options || '{}'); } catch (e) { /* options illisibles */ }
    let cv = o.customView || {};
    if (typeof cv === 'string') { try { cv = JSON.parse(cv); } catch (e) { cv = {}; } }
    const wo = cv.widgetOptions || {};
    const builder = typeof wo._js === 'string' || /custom-widget-builder/.test(cv.url || '');
    const galerie = !cv.url && cv.widgetId ? cv.widgetId : '';
    return { url: cv.url || cv.widgetDef?.url || '', acces: cv.access || '', builder, galerie, nomGalerie: galerie ? cv.widgetDef?.name || galerie : '',
      js: wo._js || '', html: wo._html || '', colonnesLiees: cv.columnsMapping || {} };
  }

  // ===== 3. Téléchargement du code d'un widget chargé par adresse =====

  /** Télécharge un texte, abandonné au bout de 8 secondes (un hôte lent ne doit pas tout bloquer). */
  async function telecharger(url) {
    const arret = new AbortController();
    const minuteur = setTimeout(() => arret.abort(), 8000);
    try {
      const r = await fetch(url, { signal: arret.signal });
      return r.ok ? await r.text() : null;
    } catch (e) { return null; } finally { clearTimeout(minuteur); }
  }

  /**
   * Code complet d'un widget : son HTML et son JavaScript, plus les scripts et feuilles de style
   * du MÊME site qu'il charge (ex. commun/outils.js, commun/dsfr-grist.css) — ils font partie du
   * widget, et une feuille de style peut elle-même charger des polices ailleurs. Les fichiers
   * d'autres sites (bibliothèques sur un CDN) ne sont pas lus : ils apparaissent dans les sorties.
   * @returns {Promise<{code: string, base: string, illisible: boolean}>}
   */
  async function codeComplet(w) {
    if (w.builder) return { code: w.html + '\n' + w.js, base: '', illisible: false };
    if (!w.url) return { code: '', base: '', illisible: true };
    const html = await telecharger(w.url);
    if (html === null) return { code: '', base: w.url, illisible: true };
    const origine = new URL(w.url).origin;
    // fichiers chargés par balise, ou par le petit chargeur commun('…') des pages de la norme
    const chemins = [
      ...[...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["']([^"']+\.(?:js|css))["']/gi)].map((m) => m[1]),
      ...[...html.matchAll(/\bcommun\(\s*['"]([\w.-]+\.(?:js|css))['"]\s*\)/g)].map((m) => 'commun/' + m[1]),
    ];
    const locaux = [...new Set(chemins)].map((c) => new URL(c, w.url)).filter((u) => u.origin === origine);
    const fichiers = await Promise.all(locaux.map((u) => telecharger(u.href)));
    return { code: [html, ...fichiers.filter(Boolean)].join('\n'), base: w.url, illisible: false };
  }

  // ===== 4. Analyse =====

  /** Échappe un nom pour l'utiliser dans une expression régulière. */
  const motif = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /** Le nom apparaît-il comme une table : entre guillemets, ou comme clé d'objet (Depart: […]) ? */
  const citeTable = (code, id) => new RegExp('[\'"`]' + motif(id) + '[\'"`]|(?<![\\w$.])' + motif(id) + '\\s*:').test(code);
  /** Le nom apparaît-il comme un champ : .Nom, 'Nom', "Nom", `Nom` ou Nom: ? */
  const citeColonne = (code, id) => new RegExp('(?:\\.|[\'"`])' + motif(id) + '(?![\\w$])|(?<![\\w$.])' + motif(id) + '\\s*:').test(code);

  /** Sites qui ne servent qu'à nommer des formats XML (espaces de noms) : jamais appelés. */
  const ESPACES_DE_NOMS = ['schemas.openxmlformats.org', 'schemas.microsoft.com', 'purl.org', 'ns.adobe.com'];

  /** Domaine lisible d'une adresse (« cdn.jsdelivr.net »). */
  const domaine = (url) => { try { return new URL(url).hostname; } catch (e) { return url; } };

  /**
   * Adresses internet que le code appelle ou charge, avec leur genre :
   * script, style, image, cadre (iframe), appel (fetch), adresse (citée dans le code).
   */
  function sorties(code, base) {
    const trouvees = [];
    const ajoute = (url, genre) => {
      let absolue = url;
      try { absolue = new URL(url, base || undefined).href; } catch (e) { if (!/^https?:/i.test(url)) return; }
      if (!/^https?:/i.test(absolue)) return;
      // pas une vraie sortie : texte d'exemple (« https://… »), ou nom d'un format XML, qu'aucun navigateur
      // n'appelle (www.w3.org/2000/svg, schemas.openxmlformats.org dans un export Excel…)
      let hote = '';
      try { hote = new URL(absolue).hostname; } catch (e) { return; }
      if (!hote.includes('.') || /…/.test(absolue) || /^https?:\/\/www\.w3\.org\/(19|20)\d\d\//.test(absolue)
        || ESPACES_DE_NOMS.includes(hote)) return;
      trouvees.push({ url: absolue, genre });
    };
    const balises = { script: 'script', link: 'style', img: 'image', iframe: 'cadre', source: 'média' };
    for (const m of code.matchAll(/<(script|link|img|iframe|source)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"'$]+)["']/gi)) {
      ajoute(m[2], balises[m[1].toLowerCase()]);
    }
    for (const m of code.matchAll(/@import\s+(?:url\()?["']?([^"')\s]+)/gi)) ajoute(m[1], 'style');
    for (const m of code.matchAll(/url\(\s*["']?(https?:[^"')\s]+)/gi)) ajoute(m[1], 'style');
    for (const m of code.matchAll(/\bfetch\(\s*([`'"])(https?:[^`'"$\s]+)/gi)) ajoute(m[2], 'appel');
    for (const m of code.matchAll(/[`'"](https?:\/\/[^`'"\s<>$]+)/gi)) {
      if (!trouvees.some((t) => t.url.startsWith(m[1]))) ajoute(m[1], 'adresse');
    }
    // une même adresse n'est gardée qu'une fois (son genre le plus parlant)
    const rang = { script: 0, style: 1, cadre: 2, appel: 3, image: 4, 'média': 5, adresse: 6 };
    const parUrl = new Map();
    for (const t of trouvees) if (!parUrl.has(t.url) || rang[t.genre] < rang[parUrl.get(t.url).genre]) parUrl.set(t.url, t);
    const parDomaine = new Map();
    for (const t of parUrl.values()) {
      const d = domaine(t.url);
      if (!parDomaine.has(d)) parDomaine.set(d, []);
      parDomaine.get(d).push(t);
    }
    return [...parDomaine.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, adresses]) => ({ domaine: d, adresses }));
  }

  /**
   * Appels à l'API REST du document lui-même (adresse obtenue avec un jeton : grist.docApi.getAccessToken).
   * Ce n'est pas une sortie vers un autre site, mais un accès direct aux données qui contourne
   * l'interface de Grist : on le signale à part.
   */
  function apiDuDocument(code) {
    if (!/getAccessToken/.test(code) || !/baseUrl/.test(code)) return [];
    const chemins = [...new Set([...code.matchAll(/\$\{[^}]*baseUrl\}(\/[^`'"?\s$]*)/g)].map((m) => m[1]))];
    return [{ domaine: 'Serveur Grist (API du document, avec jeton)',
      adresses: (chemins.length ? chemins : ['/']).map((c) => ({ url: c, genre: 'appel' })) }];
  }

  /**
   * Analyse un widget : tables et colonnes utilisées, tables absentes, sorties vers internet.
   * @param {Object} section  une section « custom » de Structure.lire()
   * @param {Object} doc      résultat de Structure.lire()
   * @returns {Promise<{url, builder, galerie, nomGalerie, acces, illisible, tables, absentes, sorties, ecrit, jeton}>}
   */
  async function analyserWidget(section, doc) {
    const w = widget(section);
    const { code, base, illisible } = await codeComplet(w);
    // tables : citées entre guillemets, plus la table affichée par la vue
    const tables = doc.tables.filter((t) => !t.resume && (t.id === section.table || citeTable(code, t.id)))
      .map((t) => ({
        id: t.id,
        principale: t.id === section.table,
        colonnes: t.colonnes.filter((c) => citeColonne(code, c.id) || Object.values(w.colonnesLiees).flat().includes(c.id))
          .map((c) => c.id),
      }));
    // tables nommées dans une lecture ou une écriture mais qui n'existent pas dans ce document
    const connues = new Set(doc.tables.map((t) => t.id));
    const citees = [
      ...[...code.matchAll(/\b(?:fetchTable|lire|lireTable)\(\s*['"`]([A-Za-z]\w*)['"`]/g)].map((m) => m[1]),
      ...[...code.matchAll(/['"](?:Bulk)?(?:Add|Update|Remove)Record['"]\s*,\s*['"]([A-Za-z]\w*)['"]/g)].map((m) => m[1]),
    ];
    const absentes = [...new Set(citees)].filter((t) => !connues.has(t) && !t.startsWith('_grist_'));
    return {
      url: w.url, builder: w.builder, galerie: w.galerie, nomGalerie: w.nomGalerie, acces: w.acces, illisible,
      tables, absentes,
      // d'où vient le widget lui-même (sauf le « builder », hébergé par Grist et dont le code est dans le document)
      origine: w.url ? domaine(w.url) + (w.builder ? ' (Custom widget builder)' : '') : '',
      sorties: [...sorties(code, base), ...apiDuDocument(code)],
      ecrit: /applyUserActions|sendActions|\.(?:addRecords|updateRecords|destroyRecords|upsert)\(/.test(code),
      // jeton d'accès à l'API du document : 'lecture' si toutes les demandes sont en lecture seule, sinon 'ecriture'
      jeton: !/getAccessToken/.test(code) ? false
        : [...code.matchAll(/getAccessToken\(([^)]*)\)/g)].every((m) => /readOnly\s*:\s*true/.test(m[1])) ? 'lecture' : 'ecriture',
    };
  }

  // ===== 5. Types en français =====

  /** Type Grist → libellé en français (« Réf. → Gouv_Entites », « Texte », « Date et heure »…). */
  function typeFrancais(type) {
    if (!type) return 'Texte';
    if (type.startsWith('RefList:')) return 'Réf. multiple → ' + type.slice(8);
    if (type.startsWith('Ref:')) return 'Réf. → ' + type.slice(4);
    if (type.startsWith('DateTime')) return 'Date et heure';
    return ({ Text: 'Texte', Numeric: 'Décimal', Int: 'Entier', Bool: 'Booléen', Date: 'Date', Choice: 'Choix',
      ChoiceList: 'Choix multiple', Attachments: 'Pièces jointes', Any: 'Calcul' })[type] || type;
  }

  return { lire, cheminPage, widget, analyserWidget, sorties, typeFrancais };
})();
