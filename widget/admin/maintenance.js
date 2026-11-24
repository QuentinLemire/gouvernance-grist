/*
 * 🧱 Maintenance — module de la console d'administration (moteur : admin/gestion.js).
 * Reprise de l'onglet correspondant de l'ancien panneau administration.html.
 */
// --- 9. Onglet « Structure » : sujets transverses du dépôt Git -----------------------------------


/** Décrit une colonne du document au format des fichiers de la norme, pour la publier (règle commune : commun/norme.js). */
const decrireColonne = (c) => Norme.decrire(c, etat.meta.colonnesParId);

/**
 * Publie la norme depuis ce document : chaque sujet est réécrit à partir des tables
 * actuelles, sa version mineure augmente ; les sujets inchangés ne sont pas publiés.
 * Selon le dépôt : GitHub avec jeton → un enregistrement par fichier ; GitLab avec jeton
 * → un seul commit ; sans jeton → fichiers téléchargés et page d'envoi du dépôt ouverte.
 * Réservé au document source (bouton visible seulement si Source_norme = oui).
 * @param {HTMLElement} bouton
 */
async function publierNorme(bouton) {
  await occupe(bouton, async () => {
    await verifierVersionWidget();
    const fichiers = [];
    for (const s of SUJETS) {
      const x = etat.sujets[s.fichier]; if (!x?.def || x.etat === 'absent') continue;
      // Une table peut être partagée entre sujets (ex. Entites, complétée par le sujet Territoires) :
      // chaque sujet ne publie que ses colonnes ; les colonnes nouvelles vont au sujet « principal » de la table.
      const tables = x.def.tables.filter((t) => aTable(t.tableId)).map((t) => {
        const ext = estExtension(s.fichier, t.tableId);
        const miennes = new Set(colonnesDuSujet(s.fichier, t.tableId)), pris = colonnesDesExtensions(t.tableId, s.fichier);
        const garder = (c) => miennes.has(c.colId) || (!ext && !pris.has(c.colId));
        return { tableId: t.tableId, ...(ext ? { extension: true } : {}), columns: etat.meta.parId[t.tableId].colonnes.filter(garder).map(decrireColonne) };
      });
      const avant = JSON.stringify(x.def.tables), apres = JSON.stringify(tables);
      if (avant === apres) continue;
      const v = String(x.def.version || '1.0').split('.'); v[1] = Number(v[1] || 0) + 1;
      fichiers.push({ chemin: 'structure/' + s.fichier + '.json', nom: s.nom, contenu: JSON.stringify({ ...x.def, version: v.join('.'), tables }, null, 2) + '\n' });
    }
    if (!fichiers.length) return message('✅ La norme publiée est déjà identique à ce document.');
    const d = depot();
    if (!d.gitlab && d.jeton) {
      // GitHub : un enregistrement par fichier (l'API demande l'empreinte de la version remplacée).
      const api = `https://api.github.com/repos/${GITHUB.proprietaire}/${GITHUB.depot}/contents/`;
      const entetes = { Authorization: 'Bearer ' + d.jeton, Accept: 'application/vnd.github+json' };
      let publies = 0;
      for (const f of fichiers) {
        // Le fichier actuel est relu par l'API (sans cache) : la copie lue plus haut sur raw.githubusercontent
        // peut dater de quelques minutes et faire croire à une différence qui n'existe plus.
        const actuel = await fetch(api + f.chemin + '?ref=' + GITHUB.branche, { headers: entetes, cache: 'no-store' });
        const info = actuel.ok ? await actuel.json() : null;
        const contenuActuel = info ? new TextDecoder().decode(Uint8Array.from(atob(info.content.replace(/\n/g, '')), (c) => c.charCodeAt(0))) : null;
        if (contenuActuel === f.contenu) continue;   // déjà identique sur GitHub : pas de commit vide
        const r = await fetch(api + f.chemin, { method: 'PUT', headers: entetes, body: JSON.stringify({
          message: 'Norme : ' + f.nom, branch: GITHUB.branche, sha: info ? info.sha : undefined,
          content: btoa(String.fromCharCode(...new TextEncoder().encode(f.contenu))) }) });
        if (!r.ok) throw new Error('GitHub a refusé la publication de ' + f.chemin + ' (' + r.status + ')');
        publies++;
      }
      if (!publies) return message('✅ La norme publiée est déjà identique à ce document.');
      message('✅ Norme publiée sur GitHub : ' + publies + ' sujet(s). Les applications la verront d\'ici quelques minutes.');
    } else if (d.gitlab && d.jeton) {
      const r = await fetch(d.api + '/repository/commits', { method: 'POST', headers: { 'PRIVATE-TOKEN': d.jeton, 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: d.branche, commit_message: 'Norme : ' + fichiers.map((f) => f.nom).join(', '),
          actions: fichiers.map((f) => ({ action: 'update', file_path: f.chemin, content: f.contenu })) }) });
      if (!r.ok) throw new Error('GitLab a refusé la publication (' + r.status + ')');
      message('✅ Norme publiée sur GitLab : ' + fichiers.length + ' sujet(s). Les applications la verront à leur prochaine ouverture.');
    } else {
      fichiers.forEach((f) => telecharger(f.chemin.split('/').pop(), f.contenu, 'application/json'));
      window.open(PAGE_DEPOT + '/upload/main/structure', '_blank', 'noopener');
      message('⬇️ ' + fichiers.length + ' fichier(s) téléchargé(s) : déposez-les dans le dossier structure du dépôt (page ouverte).');
    }
    await tracer('Norme publiée', fichiers.map((f) => f.chemin).join(', '));
    etat.sujets = null; await actualiser();
  });
}

/**
 * Refuse de publier avec une copie périmée de cette page : sa version (?v=… de l'adresse) doit être
 * le dernier commit des widgets. Dépôt injoignable ou page sans version : on laisse publier.
 * @throws {Error} si la page affichée est plus ancienne que le dépôt
 */
async function verifierVersionWidget() {
  if (!/^[0-9a-f]{40}$/.test(VERSION_PAGE)) return;
  let derniere;
  try { derniere = await derniereVersion(); } catch (e) { return; }
  if (derniere !== VERSION_PAGE) throw new Error('Cette page est une copie périmée (version ' + VERSION_PAGE.slice(0, 7) + ', dépôt : ' + derniere.slice(0, 7) + '). Cliquez sur « Mettre les pages à la dernière version », puis publiez.');
}

/**
 * Dernier commit de la branche qui modifie les widgets (dossier widget/), lu par l'API GitHub sans cache :
 * un commit qui ne touche que la documentation ou la structure ne demande pas de mettre les pages à jour.
 * @returns {Promise<string>} identifiant complet du commit
 */
async function derniereVersion() {
  const entetes = { Accept: 'application/vnd.github+json' };
  if (depot().jeton && !depot().gitlab) entetes.Authorization = 'Bearer ' + depot().jeton;
  const r = await fetch(`https://api.github.com/repos/${GITHUB.proprietaire}/${GITHUB.depot}/commits?sha=${GITHUB.branche}&path=widget&per_page=1`, { headers: entetes, cache: 'no-store' });
  if (!r.ok) throw new Error('Dépôt injoignable (' + r.status + ')');
  const [dernier] = await r.json();
  if (!dernier) throw new Error('Aucun widget dans le dépôt');
  return dernier.sha;
}

/**
 * Sections du document qui affichent un widget de la norme, avec leur version (branche ou commit) et leur fichier.
 * @returns {Promise<{id: number, options: object, vue: object, version: string, fichier: string}[]>}
 */
async function sectionsWidgets() {
  return ((await lire('_grist_Views_section')) || []).map((s) => {
    const options = json(s.options, {}), vue = json(options.customView, {});
    const m = (vue.url || '').match(ADRESSE_WIDGET);
    if (!m) return null;
    // ancienne : page encore servie par raw.githack, à faire passer sur GitHub Pages ;
    // version (?v=…) et module (?module=…, outil de la console) lus dans l'adresse, où qu'ils soient
    let parametres = new URLSearchParams();
    try { parametres = new URL(vue.url).searchParams; } catch (e) { /* adresse illisible */ }
    return { id: s.id, options, vue, version: m[1] || parametres.get('v') || GITHUB.branche, fichier: m[2],
      module: parametres.get('module') || '', ancienne: !!m[1] };
  }).filter(Boolean);
}

/** Lit la version des pages et celle du dépôt (affichées dans l'onglet Structure), puis redessine. */
async function chargerVersions() {
  const [sections, derniere] = await Promise.all([sectionsWidgets(), derniereVersion().catch(() => '')]);
  etat.versions = { pages: [...new Set(sections.map((s) => s.version))], derniere };
  afficher();
}

/**
 * Page d'un ancien fichier, d'avant les outils séparés (administration.html, boite-a-outils.html…) :
 * l'outil de la console qui la remplace, ou undefined.
 */
const remplacante = (fichier) => PAGES.find((x) => (x.anciens || []).includes(fichier));

/**
 * Fait pointer toutes les pages de la norme (Accueil, Documentation, Support, Administration et ses outils)
 * sur le dernier commit du dépôt. Les pages se rechargent d'elles-mêmes, sans attendre aucun cache.
 * Document pas encore passé aux outils séparés : les outils qui manquent sont d'abord créés, puis
 * l'ancien panneau devient la Santé du document et la Boîte à outils l'Explorateur (même page, même place).
 * @param {HTMLElement} bouton
 */
async function mettreAJourPages(bouton) {
  await occupe(bouton, async () => {
    const version = await derniereVersion();
    let sections = await sectionsWidgets();
    const anciennes = sections.filter((s) => remplacante(s.fichier));
    if (anciennes.length) {
      // les outils manquants d'abord : cette page-ci sera remplacée (et rechargée) en dernier
      await creerPages(null);
      sections = await sectionsWidgets();
    }
    const cible = (s) => { const r = remplacante(s.fichier); return r ? { fichier: r.fichier, module: r.module } : { fichier: s.fichier, module: s.module }; };
    const aFaire = sections.filter((s) => s.version !== version || s.ancienne || remplacante(s.fichier));
    if (!aFaire.length) return message('✅ Les pages sont déjà à la dernière version (' + version.slice(0, 7) + ').');
    await tracer(anciennes.length ? 'Passage aux outils d\'administration' : 'Pages mises à jour', 'version ' + version.slice(0, 7) + ' : '
      + [...new Set(aFaire.map((s) => s.fichier + (remplacante(s.fichier) ? ' → ' + cible(s).module : '')))].join(', '));
    // En dernier : cette page-ci se recharge aussitôt sa propre adresse changée.
    const moi = (s) => location.href.includes('/widget/' + s.fichier);
    await agir([...aFaire.filter((s) => !moi(s)), ...aFaire.filter(moi)].map((s) => ['UpdateRecord', '_grist_Views_section', s.id, { options: JSON.stringify({ ...s.options,
      customView: JSON.stringify({ ...s.vue, url: URL_WIDGET(version, cible(s).fichier, cible(s).module) }) }) }]));
    message('✅ ' + aFaire.length + ' page(s) mises à la version ' + version.slice(0, 7) + '.');
  });
}

/**
 * Table « extension » d'un sujet : marquée comme telle, ou déjà définie par un sujet dont il dépend
 * (ex. Entites dans Territoires, qui dépend d'Utilisateurs). Le second cas protège d'un fichier publié sans la marque.
 * @param {string} fichier sujet
 * @param {string} tableId
 */
function estExtension(fichier, tableId) {
  const def = etat.sujets[fichier]?.def, t = def?.tables?.find((u) => u.tableId === tableId);
  if (!t) return false;
  if (t.extension) return true;
  return SUJETS.some((o) => {
    const d = etat.sujets[o.fichier]?.def;
    return o.fichier !== fichier && d && (def.dependances || []).includes(d.sujet) && d.tables.some((u) => u.tableId === tableId);
  });
}

/**
 * Colonnes qu'un sujet publie pour une table. Pour une extension : seulement celles que la table
 * principale ne définit pas (Territoire pour Entites), même si un fichier publié en contient d'autres.
 */
function colonnesDuSujet(fichier, tableId) {
  const t = etat.sujets[fichier]?.def?.tables?.find((u) => u.tableId === tableId);
  if (!t) return [];
  const ids = t.columns.map((c) => c.id);
  if (!estExtension(fichier, tableId)) return ids.filter((id) => !colonnesDesExtensions(tableId, fichier).has(id));
  const principales = new Set(SUJETS.filter((o) => o.fichier !== fichier && !estExtension(o.fichier, tableId))
    .flatMap((o) => (etat.sujets[o.fichier]?.def?.tables || []).filter((u) => u.tableId === tableId).flatMap((u) => u.columns.map((c) => c.id))));
  return ids.filter((id) => !principales.has(id));
}

/** Colonnes d'une table apportées par les sujets « extension » (autres que `sauf`). */
function colonnesDesExtensions(tableId, sauf) {
  return new Set(SUJETS.filter((o) => o.fichier !== sauf && estExtension(o.fichier, tableId)).flatMap((o) => colonnesDuSujet(o.fichier, tableId)));
}

/**
 * Ligne d'un sujet de tables dans l'onglet Structure : nom, description, ce qui manque, état.
 * @param {object} s sujet (SUJETS)
 */
function ligneSujet(s) {
  const x = etat.sujets[s.fichier];
  // Colonnes propres au document, à publier : sans celles qu'apporte un module (ex. Entites.Territoire)
  const ajouts = (x.ajouts || []).filter((a) => { const [t, c] = a.split('.'); return !colonnesDesExtensions(t, s.fichier).has(c); });
  const details = (x.manques?.length && x.etat === 'partiel' ? '<br>Manque : ' + esc(x.manques.slice(0, 8).join(', ')) + (x.manques.length > 8 ? '…' : '') : '')
    + (x.desordre && x.etat === 'partiel' ? '<br>Colonnes à remettre dans l\'ordre de la norme' : '');
  return { ajouts, details, x };
}

/**
 * Ligne « Version des pages » : version affichée par les pages de la norme, comparée au dépôt.
 * @returns {string} HTML
 */
function ligneVersion() {
  if (!etat.versions) { chargerVersions(); return ''; }
  const { pages, derniere } = etat.versions, court = (v) => (/^[0-9a-f]{40}$/.test(v) ? v.slice(0, 7) : v);
  const ajour = derniere && pages.length === 1 && pages[0] === derniere;
  return `<div class="sujet"><div><b>Version des pages</b><br><small>Pages : ${esc(pages.map(court).join(', ') || '—')}${derniere ? ' · dépôt : ' + esc(court(derniere)) : ''}${pages.includes(GITHUB.branche) ? ' · « ' + esc(GITHUB.branche) + ' » suit le dépôt mais avec plusieurs minutes de cache' : ''}</small></div>
    ${ajour ? '<span class="badge vert">à jour</span>' : `<button class="bouton petit primaire" data-action="versions">🔄 Mettre les pages à la dernière version</button>`}</div>`;
}

/**
 * Contenu de l'onglet « Structure » : publication (document source seulement), le socle (tables et pages
 * présentes dans toute application), les modules facultatifs (bouton « Installer ») et la traçabilité.
 * Au premier affichage, lance la lecture du dépôt et des pages, et redessine quand elle est terminée.
 * @returns {string} HTML de l'onglet
 */
function ongletStructure() {
  if (!etat.sujets) { chargerSujets().then(afficher); return '<p class="vide">Lecture du dépôt Git…</p>'; }
  if (!etat.pages) { lirePages().then((p) => { etat.pages = p; afficher(); }); return '<p class="vide">Lecture du menu…</p>'; }
  const presentes = new Set(etat.pages.map((p) => p.cle));
  const aPublier = (a) => estSource() && a.length ? '<span class="badge bleu" title="' + esc(a.join(', ')) + '">à publier</span>' : '';
  const etatSocle = { present: '<span class="badge vert">installé</span>', partiel: '<span class="badge orange">incomplet</span>', absent: '<span class="badge orange">absent</span>', inconnu: '<span class="badge rouge">dépôt injoignable</span>' };

  // Socle : tables, puis pages
  const socle = SUJETS.filter((s) => s.obligatoire).map((s) => {
    const { ajouts, details, x } = ligneSujet(s);
    return `<div class="sujet"><div><b>${esc(s.nom)}</b><br><small>${x.def ? esc(x.def.description || '') : ''}${details}</small></div>
      ${aPublier(ajouts)} ${etatSocle[x.etat]} ${x.etat === 'absent' || x.etat === 'partiel' ? `<button class="bouton petit primaire" data-action="installer" data-sujet="${s.fichier}">Réparer</button>` : ''}</div>`;
  }).join('');
  const pagesSocle = PAGES.filter((x) => !x.facultative);
  const manquent = pagesSocle.filter((x) => !presentes.has(x.cle));
  const lignesPages = pagesSocle.map((x) => `<div class="sujet"><div><b>${esc(x.nom)}</b> <small>page</small></div>${presentes.has(x.cle) ? '<span class="badge vert">présente</span>'
    : x.table && !aTable(x.table) ? '<span class="badge">table à installer d\'abord</span>' : '<span class="badge orange">manquante</span>'}</div>`).join('');

  // Modules facultatifs : une ligne par module (ses tables et, s'il en a une, sa page)
  const modules = SUJETS.filter((s) => !s.obligatoire).map((s) => {
    const { ajouts, details, x } = ligneSujet(s);
    const page = PAGES.find((p) => p.sujet === s.fichier);
    const pageOk = !page || presentes.has(page.cle);
    const complet = x.etat === 'present' && pageOk;
    const action = x.etat === 'inconnu' ? etatSocle.inconnu
      : complet ? '<span class="badge">installé</span>'
      : `<button class="bouton petit primaire" data-action="module" data-sujet="${s.fichier}">${x.etat === 'absent' ? 'Installer' : 'Compléter'}</button>`;
    const reste = !complet && x.etat !== 'absent' ? (x.etat !== 'present' ? details : '') + (pageOk ? '' : '<br>Page « ' + esc(page.nom) + ' » à créer') : '';
    return `<div class="sujet"><div><b>${page ? esc(page.nom) : esc(s.nom)}</b>${page ? ' <small>(tables et page)</small>' : ''}<br><small>${x.def ? esc(x.def.description || '') : ''}${reste}</small></div>
      ${aPublier(ajouts)} ${action}</div>`;
  }).join('');

  return `
    ${estSource() ? `<section class="carte" style="border-left:4px solid var(--bleu)"><h2>📤 Ce document est la source de la norme</h2>
      <p class="aide">Modifiez ici les tables standard, puis publiez : toutes les applications verront la nouvelle norme à leur prochaine ouverture. ${depot().jeton ? '' : '<br><b>Sans jeton</b> (Paramètres → Github_jeton), les fichiers sont téléchargés et la page du dépôt s\'ouvre pour les déposer.'}</p>
      <button class="bouton primaire" data-action="publier">📤 Publier la norme</button></section>` : ''}
    <section class="carte"><h2>🧱 Socle</h2>
      <p class="aide">Présent dans toute application. Lu en direct sur le <a href="${PAGE_DEPOT}" target="_blank" rel="noopener">dépôt Git</a> ; « Réparer » ajoute ce qui manque et range les colonnes dans l'ordre de la norme : rien n'est jamais supprimé.</p>
      ${socle}${lignesPages}
      ${ligneVersion()}
      <p><button class="bouton primaire" data-action="pages">${manquent.length ? '➕ Créer les pages du socle et ranger le menu' : '↕️ Ranger le menu'}</button></p>
    </section>
    <section class="carte"><h2>🧩 Modules facultatifs</h2>
      <p class="aide">À installer si l'application en a besoin : « Installer » ajoute les tables, leurs données de référence et la page du menu.</p>
      ${modules}
    </section>
    <section class="carte"><h2>🕓 Traçabilité</h2>
        <p class="aide">Pour ajouter « Créé le / par » et « Modifié le / par » à une table : module <b>🏗️ Atelier</b>, bouton « Traçabilité ».</p>
        <button class="bouton petit" data-onglet-aller="atelier">Ouvrir l'Atelier →</button>
    </section>`;
}

/**
 * Crée les tables et colonnes manquantes d'après des définitions de la norme, sans rien supprimer.
 * Phase 1 : tables manquantes, avec leurs colonnes simples ;
 * phase 2 : les autres colonnes (formules, références), une fois toutes les tables cibles créées ;
 * phase 3 : colonne affichée des références ; enfin, colonnes rangées dans l'ordre de la norme.
 * @param {{tableId: string, columns: object[]}[]} tables
 */
async function creerStructure(tables) {
  const simple = (c) => !c.isFormula && !/^(Ref|RefList):/.test(c.type || '');
  const info = (c) => ({ type: c.type || 'Any', label: c.label || c.id, isFormula: !!c.isFormula, formula: c.formula || '', recalcWhen: c.recalcWhen || 0,
    widgetOptions: c.widgetOptions ? (typeof c.widgetOptions === 'string' ? c.widgetOptions : JSON.stringify(c.widgetOptions)) : '',
    untieColIdFromLabel: true });   // corriger un libellé ne doit jamais renommer la colonne
  for (const t of tables) {
    if (aTable(t.tableId)) continue;
    await agir([['AddTable', t.tableId, t.columns.filter(simple).map((c) => ({ id: c.id, ...info(c) }))]]);
    // AddTable ignore le réglage de recalcul : on le repose (sinon ModifieLe / ModifiePar ne suivraient pas les modifications).
    const aRecalculer = t.columns.filter((c) => simple(c) && c.formula && c.recalcWhen);
    if (aRecalculer.length) await agir(aRecalculer.map((c) => ['ModifyColumn', t.tableId, c.id, { recalcWhen: c.recalcWhen }]));
  }
  await chargerStructure();
  for (const t of tables) for (const c of t.columns) if (!colonne(t.tableId, c.id)) await agir([['AddColumn', t.tableId, c.id, info(c)]]);
  await chargerStructure();
  const a = [];
  for (const t of tables) for (const c of t.columns) {
    const cible = (/^(?:Ref|RefList):(\w+)/.exec(c.type || '') || [])[1];
    const moi = colonne(t.tableId, c.id), vis = cible && c.visibleCol && colonne(cible, c.visibleCol);
    if (moi && vis && moi.visibleCol !== vis.id) a.push(['ModifyColumn', t.tableId, c.id, { visibleCol: vis.id }], ['SetDisplayFormula', t.tableId, null, moi.id, '$' + c.id + '.' + c.visibleCol]);
  }
  if (a.length) await agir(a);
  await rangerColonnes(tables);
}

/**
 * Range les colonnes dans l'ordre de la norme (les colonnes propres à l'application suivent),
 * dans la structure et dans la vue « données brutes » / fiche de chaque table.
 * @param {{tableId: string, columns: object[]}[]} tables
 */
async function rangerColonnes(tables) {
  await chargerStructure();
  const [sections, champs] = await Promise.all([lire('_grist_Views_section'), lire('_grist_Views_section_field')]);
  const a = [];
  for (const t of tables) {
    const table = etat.meta.parId[t.tableId]; if (!table) continue;
    // Colonnes de la norme, puis celles de l'application, et la traçabilité toujours en dernier (P4).
    const trace = ['CreeLe', 'CreePar', 'ModifieLe', 'ModifiePar'];
    // Table « extension » (ex. Entites.Territoire, ajoutée par le sujet Territoires) : on ne reclasse que la traçabilité.
    const norme = t.extension ? [] : t.columns.map((c) => c.id).filter((id) => !trace.includes(id));
    const rang = (colId) => { if (trace.includes(colId)) return norme.length + 1 + trace.indexOf(colId); const i = norme.indexOf(colId); return i < 0 ? norme.length : i; };
    const ordre = [...table.colonnes].sort((x, y) => rang(x.colId) - rang(y.colId)); // tri stable : le reste garde son ordre
    a.push(['BulkUpdateRecord', '_grist_Tables_column', ordre.map((c) => c.id), { parentPos: ordre.map((_, i) => i + 1) }]);
    const position = Object.fromEntries(ordre.map((c, i) => [c.id, i]));
    for (const sec of (sections || []).filter((x) => x.id === table.rawViewSectionRef || x.id === table.recordCardViewSectionRef)) {
      const f = (champs || []).filter((x) => x.parentId === sec.id && x.colRef in position).sort((x, y) => position[x.colRef] - position[y.colRef]);
      if (f.length) a.push(['BulkUpdateRecord', '_grist_Views_section_field', f.map((x) => x.id), { parentPos: f.map((_, i) => i + 1) }]);
    }
  }
  if (a.length) await agir(a);
}

// --- Pages standard du menu ----------------------------------------------------------------------

/**
 * Le menu commun à toutes les applications, dans l'ordre. Les pages métier se placent
 * entre Support et Administration.
 * « fichier » : widget du dépôt ; « module » : outil affiché par console.html (?module=…) ;
 * « table » : table rattachée à la page (la page n'est créée que si elle existe) ;
 * « sousPage » : page placée en retrait sous Administration ;
 * « anciens » : fichiers d'avant la console, reconnus pour ranger le menu d'un document pas encore migré ;
 * « native » : page Grist classique, sans widget (reconnue par son nom) : colonnes de la liste, tri (« -Date » :
 *   du plus récent au plus ancien), fiche liée à droite ou non, colonnes techniques cachées de la fiche.
 */
const OUTIL = { fichier: 'console.html', table: 'Gouv_Parametres', sousPage: true };
const PAGES = [
  { cle: 'accueil', nom: '🏠 Accueil', table: 'Gouv_Accueil', fichier: 'accueil.html' },
  // Hors socle : créées par leur bouton « Installer », qui installe aussi leurs tables (sujet du même nom).
  { cle: 'documentation', nom: '📖 Documentation', table: 'Gouv_Documentation', fichier: 'documentation.html', facultative: true, sujet: 'documentation' },
  { cle: 'support', nom: '🆘 Support', table: 'Gouv_Support', fichier: 'support.html', facultative: true, sujet: 'support' },
  // Administration : la Santé du document, puis un outil par page en dessous
  { ...OUTIL, cle: 'administration', nom: '🛡️ Administration', module: 'sante', sousPage: false, anciens: ['administration.html'] },
  // Utilisateurs et Journal : une table suffit (filtres, collage, export natifs de Grist) ; pas de widget
  { cle: 'utilisateurs', nom: '👥 Utilisateurs', table: 'Gouv_Utilisateurs', sousPage: true, native: {
    titre: 'Annuaire', colonnes: ['Nom', 'Courriel', 'Entite', 'Role', 'Actif', 'Acces_Grist'], tri: 'Nom', fiche: true,
    cachees: ['Courriel_cle', 'Courriel_valide', 'Doublon'] } },
  { ...OUTIL, cle: 'droits', nom: '🔐 Rôles et droits', module: 'droits' },
  { ...OUTIL, cle: 'explorateur', nom: '🔍 Explorateur', module: 'explorateur', anciens: ['explorateur.html', 'boite-a-outils.html'] },
  { ...OUTIL, cle: 'atelier', nom: '🏗️ Atelier', module: 'atelier', anciens: ['atelier.html'] },
  { cle: 'journal', nom: '📒 Journal', table: 'Gouv_Journal', sousPage: true, native: {
    titre: 'Journal d\'administration', colonnes: ['Date', 'Auteur', 'Action', 'Detail', 'Personne'], tri: '-Date', fiche: false } },
  { ...OUTIL, cle: 'maintenance', nom: '🧱 Maintenance', module: 'maintenance' },
  { ...OUTIL, cle: 'aide', nom: '❓ Aide', module: 'aide' },
];

/** La page standard affichée par une adresse de widget (fichier, et module pour la console), ou undefined. */
function pageDeLAdresse(url) {
  let u;
  try { u = new URL(url); } catch (e) { return undefined; }
  const fichier = u.pathname.split('/').pop();
  return PAGES.find((x) => (x.fichier === fichier && (x.module || '') === (u.searchParams.get('module') || ''))
    || (x.anciens || []).includes(fichier));
}

/**
 * Pages du document dans l'ordre du menu. Chacune est reconnue comme page standard (« cle »)
 * par l'adresse du widget qu'elle contient, ou à défaut par son nom (émojis ignorés) ;
 * sinon cle = null : c'est une page métier.
 * @returns {Promise<object[]>}
 */
async function lirePages() {
  const [pages, vues, sections] = await Promise.all([lire('_grist_Pages'), lire('_grist_Views'), lire('_grist_Views_section')]);
  const vue = Object.fromEntries((vues || []).map((v) => [v.id, v]));
  return (pages || []).sort((a, b) => a.pagePos - b.pagePos).map((p) => {
    const urls = (sections || []).filter((s) => s.parentId === p.viewRef).map((s) => json(json(s.options, {}).customView, {}).url || '');
    const nom = vue[p.viewRef]?.name || '';
    // page native : reconnue par son nom (émojis ignorés), à condition de ne contenir aucun widget
    const lettres = (t) => t.replace(/[^\p{L}]/gu, '');
    const std = urls.map(pageDeLAdresse).find(Boolean)
      || (!urls.some(Boolean) ? PAGES.find((x) => x.native && lettres(x.nom) === lettres(nom)) : undefined);
    return { ...p, nom, cle: std?.cle || null };
  });
}

/**
 * Crée les pages standard qui manquent (si leur table existe), puis remet le menu dans l'ordre de la norme.
 * Chaque page est un widget personnalisé en accès complet, à la version de la page en cours ;
 * les pages « natives » (Utilisateurs) sont des vues Grist classiques (creerPageNative).
 * @param {HTMLElement} bouton
 */
async function creerPages(bouton, seulement = null) {
  await occupe(bouton, async () => {
    const presentes = new Set((await lirePages()).map((p) => p.cle));
    const tableRef = (t) => etat.meta.parId[t]?.id;
    const creees = [];
    // Sans précision : toutes les pages du socle qui manquent. Avec « seulement » : la page hors socle demandée.
    const voulue = (x) => (seulement ? seulement.includes(x.cle) : !x.facultative);
    // Page hors socle demandée dont la table manque : on installe d'abord son sujet (tables, dépendances, données).
    for (const x of PAGES.filter((p) => seulement && seulement.includes(p.cle) && p.sujet && (!aTable(p.table) || etat.sujets?.[p.sujet]?.etat !== 'present'))) {
      await installerTablesSujet(x.sujet);
      await chargerStructure();
    }
    for (const page of PAGES.filter((x) => !presentes.has(x.cle) && x.table && tableRef(x.table) && voulue(x))) {
      if (page.native) await creerPageNative(page, tableRef(page.table));
      else {
        const r = (await agir([['CreateViewSection', tableRef(page.table), 0, 'custom', null, null]])).retValues[0];
        await agir([
          ['UpdateRecord', '_grist_Views', r.viewRef, { name: page.nom }],
          ['UpdateRecord', '_grist_Views_section', r.sectionRef, { title: page.nom.replace(/^\S+\s/, ''), options: JSON.stringify({ customView: JSON.stringify({
            mode: 'url', url: URL_WIDGET(VERSION_PAGE || GITHUB.branche, page.fichier, page.module), widgetDef: null, access: 'full', pluginId: '', sectionId: '',
            renderAfterReady: false, widgetId: null, widgetOptions: null, columnsMapping: null }) }) }],
        ]);
      }
      creees.push(page.nom);
    }
    await rangerMenu();
    if (creees.length) await tracer('Pages standard créées', creees.join(', '));
    message(creees.length ? '✅ Pages créées : ' + esc(creees.join(', ')) : '✅ Menu remis dans l\'ordre de la norme.');
    // En dernier : ajouter une mise en forme change la structure de la table, ce qui recharge cette page
    if (aTable('Gouv_Utilisateurs')) await marquerCourriels('Gouv_Utilisateurs');
    etat.pages = null; await actualiser();
  });
}

/**
 * Page Grist classique (Utilisateurs, Journal) : une liste avec les colonnes utiles, triée, et si demandé
 * la fiche de la ligne choisie à droite. Réglages dans PAGES (champ « native »). La mise en forme des
 * courriels est posée à part (marquerCourriels), à la fin de creerPages.
 * @param {object} page      entrée de PAGES
 * @param {number} tableRef  identifiant interne de la table
 */
async function creerPageNative(page, tableRef) {
  const n = page.native;
  const r1 = (await agir([['CreateViewSection', tableRef, 0, 'record', null, null]])).retValues[0];
  const r2 = n.fiche ? (await agir([['CreateViewSection', tableRef, r1.viewRef, 'single', null, null]])).retValues[0] : null;
  const sections = [r1.sectionRef, r2?.sectionRef].filter(Boolean);
  const champs = ((await lire('_grist_Views_section_field')) || []).filter((f) => sections.includes(f.parentId));
  const colId = (f) => etat.meta.colonnesParId[f.colRef]?.colId || '';
  const cachees = [...(n.cachees || []), 'manualSort'];
  const retirer = champs.filter((f) => cachees.includes(colId(f)) || colId(f).startsWith('gristHelper')
    || (f.parentId === r1.sectionRef && !n.colonnes.includes(colId(f))));
  // la liste dans l'ordre demandé (et non celui de la table)
  const gardes = champs.filter((f) => f.parentId === r1.sectionRef && !retirer.includes(f)).sort((x, y) => n.colonnes.indexOf(colId(x)) - n.colonnes.indexOf(colId(y)));
  // tri : « Nom » croissant, « -Date » décroissant (Grist note un tri décroissant par l'identifiant en négatif)
  const tri = colonne(page.table, n.tri.replace(/^-/, ''))?.id;
  await agir([
    ...(retirer.length ? [['BulkRemoveRecord', '_grist_Views_section_field', retirer.map((f) => f.id)]] : []),
    ['BulkUpdateRecord', '_grist_Views_section_field', gardes.map((f) => f.id), { parentPos: gardes.map((_, i) => i + 1) }],
    ['UpdateRecord', '_grist_Views', r1.viewRef, { name: page.nom, ...(r2 ? { layoutSpec: JSON.stringify({ children: [{ children: [{ size: 125, leaf: r1.sectionRef }, { size: 75, leaf: r2.sectionRef }] }], collapsed: [] }) } : {}) }],
    ['UpdateRecord', '_grist_Views_section', r1.sectionRef, { title: n.titre, sortColRefs: JSON.stringify(tri ? [n.tri.startsWith('-') ? -tri : tri] : []) }],
    ...(r2 ? [['UpdateRecord', '_grist_Views_section', r2.sectionRef, { title: 'Fiche', linkSrcSectionRef: r1.sectionRef, linkSrcColRef: 0, linkTargetColRef: 0 }]] : []),
  ]);
}

/** Mise en forme conditionnelle de la colonne Courriel : rouge si invalide, orange si en double (une seule fois). */
async function marquerCourriels(table) {
  const c = colonne(table, 'Courriel');
  if (!c || !colonne(table, 'Courriel_valide') || !colonne(table, 'Doublon')) return;
  // Grist rend une liste sous la forme ['L', id, id…]
  const liste = (v) => (Array.isArray(v) ? v : json(v, [])) || [];
  if (liste(c.rules).length > 1) return;   // déjà des règles : on n'y touche pas
  await agir([['AddEmptyRule', table, 0, c.id], ['AddEmptyRule', table, 0, c.id]]);
  const regles = liste(((await lire('_grist_Tables_column')) || []).find((x) => x.id === c.id).rules).slice(1);
  const wo = json(c.widgetOptions, {});
  wo.rulesOptions = [{ fillColor: '#FFE9E9', textColor: '#CE0500' }, { fillColor: '#FEECC2', textColor: '#716043' }];
  await agir([
    ['UpdateRecord', '_grist_Tables_column', regles[0], { formula: 'not $Courriel_valide' }],
    ['UpdateRecord', '_grist_Tables_column', regles[1], { formula: '$Doublon' }],
    ['UpdateRecord', '_grist_Tables_column', c.id, { widgetOptions: JSON.stringify(wo) }],
  ]);
}

/**
 * Ordre du menu : Accueil › Documentation, Support ; pages métier ; Administration › ses outils.
 * Les pages métier gardent leur ordre et leur retrait d'origine ; celles déjà rangées sous Administration
 * (ex. Référentiel, Données des agents) y restent, après les outils.
 */
async function rangerMenu() {
  const pages = await lirePages();
  const de = (cle) => pages.filter((p) => p.cle === cle);
  // Pages métier placées en retrait sous Administration : le bloc qui suit la page Administration
  const iAdmin = pages.findIndex((p) => p.cle === 'administration'), sousAdmin = new Set();
  if (iAdmin >= 0) for (let i = iAdmin + 1; i < pages.length && pages[i].indentation > 0; i++) if (!pages[i].cle) sousAdmin.add(pages[i].id);
  const metier = pages.filter((p) => !p.cle && !sousAdmin.has(p.id));
  const ordre = [
    // Accueil en tête, avec Documentation et Support rangées dessous (pages d'aide et de contact).
    ...de('accueil').map((p) => [p, 0]),
    ...['documentation', 'support'].flatMap(de).map((p) => [p, 1]),
    ...metier.map((p) => [p, p.indentation]),
    ...de('administration').map((p) => [p, 0]),
    // les outils d'administration, puis les pages métier déjà rangées sous Administration
    ...PAGES.filter((x) => x.sousPage).flatMap((x) => de(x.cle)).map((p) => [p, 1]),
    ...pages.filter((p) => sousAdmin.has(p.id)).map((p) => [p, p.indentation]),
  ];
  if (ordre.length && ordre[0][1]) ordre[0][1] = 0; // une page ne peut pas commencer le menu en retrait
  await agir([['BulkUpdateRecord', '_grist_Pages', ordre.map(([p]) => p.id), { pagePos: ordre.map((_, i) => i + 1), indentation: ordre.map(([, n]) => n) }]]);
}

/**
 * Installe un sujet de la norme et ceux dont il dépend (champ « dependances » du fichier),
 * puis charge ses données de référence si la table est vide. Rien n'est supprimé.
 * @param {HTMLElement} bouton
 * @param {string} fichier  nom du sujet (ex. « support »)
 */
async function installerSujet(bouton, fichier) {
  await occupe(bouton, async () => {
    const vus = await installerTablesSujet(fichier);
    message('✅ Installé : ' + esc([...vus].join(', ')));
    etat.sujets = null;
    await actualiser();
  });
}

/**
 * Installe un module facultatif : ses tables (et dépendances, données de référence) puis sa page, s'il en a une.
 * @param {HTMLElement} bouton
 * @param {string} fichier sujet du module
 */
function installerModule(bouton, fichier) {
  const page = PAGES.find((p) => p.sujet === fichier);
  return page ? creerPages(bouton, [page.cle]) : installerSujet(bouton, fichier);
}

/**
 * Installe les tables d'un sujet de la norme et de ses dépendances, puis leurs données de référence
 * (si la table est vide). Ne supprime rien. Rend la liste des sujets installés.
 */
/**
 * Repère les tables de la norme dans « Données source » : 🧱 devant une table du socle, 🧩 devant
 * une table de module ; les tables propres à l'application ne sont pas touchées.
 * Le titre reprend le nom exact de la table : Grist recalcule l'identifiant d'après le titre, et
 * « 🧱 Utilisateurs » redonne bien Utilisateurs (un autre titre renommerait la table).
 * @param {Iterable<string>} fichiers  sujets installés
 */
async function etiqueterTables(fichiers) {
  const [tables, sections] = await Promise.all([lire('_grist_Tables'), lire('_grist_Views_section')]);
  const actions = [];
  for (const f of fichiers) {
    const sujet = SUJETS.find((x) => x.fichier === f);
    const def = etat.sujets?.[f]?.def || await lireDepot('structure/' + f + '.json');
    for (const t of def.tables.filter((u) => !u.extension)) {
      const tab = (tables || []).find((x) => x.tableId === t.tableId);
      const sec = tab && (sections || []).find((x) => x.id === tab.rawViewSectionRef);
      const titre = (sujet && sujet.obligatoire ? '🧱 ' : '🧩 ') + t.tableId;
      if (sec && sec.title !== titre) actions.push(['UpdateRecord', '_grist_Views_section', sec.id, { title: titre }]);
    }
  }
  if (actions.length) await agir(actions);
}

async function installerTablesSujet(fichier) {
  {
    // On installe aussi les sujets dont celui-ci dépend.
    const aFaire = [fichier], vus = new Set(), tables = [];
    while (aFaire.length) {
      const f = aFaire.shift(); if (vus.has(f)) continue; vus.add(f);
      const def = etat.sujets?.[f]?.def || await lireDepot('structure/' + f + '.json');
      tables.push(...def.tables);
      (def.dependances || []).forEach((d) => aFaire.push(d.toLowerCase()));
    }
    await creerStructure(tables);
    await etiqueterTables(vus);
    // Données de référence publiques (territoires) si la table est encore vide.
    for (const f of vus) {
      if (!DONNEES[f]) continue;
      const jeu = await lireDepot('donnees/' + DONNEES[f]);
      if (!((await lire(jeu.tableId)) || []).length) {
        const cles = Object.keys(jeu.records[0]);
        await agir([['BulkAddRecord', jeu.tableId, jeu.records.map(() => null), Object.fromEntries(cles.map((k) => [k, jeu.records.map((r) => r[k])]))]]);
      }
    }
    await tracer('Sujet installé', [...vus].join(', '));
    return vus;
  }
}

// --- 10. Onglet « Paramètres » -------------------------------------------------------------------

/**
 * Contenu de l'onglet « Paramètres » : valeurs modifiables directement (les jetons sont masqués
 * comme des mots de passe) et journal complet des actions d'administration.
 * @returns {string} HTML de l'onglet
 */
function ongletParametres() {
  const P = (etat.d.Gouv_Parametres || []);
  const J = (etat.d.Gouv_Journal || []).slice().sort((a, b) => (b.Date || 0) - (a.Date || 0));
  return `
    <section class="carte"><h2>⚙️ Paramètres de l'application</h2>
      ${aTable('Gouv_Parametres') ? `<table class="tableau">${P.map((p) => `<tr><td style="width:220px"><b>${esc(p.Cle)}</b><br><small class="vide">${esc(p.Description)}</small></td>
        <td><input class="champ" style="width:100%;max-width:none" data-p="${p.id}" value="${esc(p.Valeur)}" ${/_jeton$/.test(p.Cle) ? 'type="password" autocomplete="off"' : ''}>${p.Cle === 'Logo_DGOM' && p.Valeur ? `<img class="apercu-logo" src="${esc(p.Valeur)}" alt="">` : ''}</td></tr>`).join('')}</table>`
        : `<div class="encadre alerte">Pas de table Parametres. <button class="bouton petit" data-onglet-aller="structure">Installer →</button></div>`}
    </section>
    <section class="carte"><h2>📒 Journal d'administration</h2>
      ${J.length ? `<div class="defile"><table class="tableau"><tr><th>Date</th><th>Qui</th><th>Action</th><th>Détail</th></tr>${J.map((j) => `<tr><td>${dateFr(j.Date)}</td><td>${esc(j.Auteur)}</td><td>${esc(j.Action)}</td><td>${esc(j.Detail)}</td></tr>`).join('')}</table></div>` : '<p class="vide">Journal vide.</p>'}
    </section>`;
}

// Vue du module dans la console : la structure de la norme, puis les paramètres et le journal
// --- Sauvegardes du document -----------------------------------------------------------------------

/**
 * Carte « Sauvegardes » : les versions que Grist garde automatiquement (API /snapshots), avec un lien
 * pour ouvrir chacune (en lecture seule), et le téléchargement d'une copie complète du document.
 * @returns {string} HTML de la carte
 */
function carteSauvegardes() {
  const entete = `<section class="carte"><h2>💾 Sauvegardes</h2>
    <p class="aide">Grist enregistre automatiquement des versions du document. Ouvrez-en une pour la consulter (lecture seule) ;
    pour revenir en arrière, utilisez <i>Historique du document</i> dans Grist. Avant une grosse modification, téléchargez une copie.</p>`;
  if (!etat.sauvegardes) {
    etat.sauvegardes = { enCours: true };
    Promise.all([Outils.api('/snapshots').then((r) => r.json()), Outils.adresseDocument()])
      .then(([r, adresse]) => { etat.sauvegardes = { liste: r.snapshots || [], adresse }; })
      .catch((e) => { etat.sauvegardes = { erreur: e.message }; })
      .then(afficher);
  }
  const S = etat.sauvegardes;
  const copie = '<button class="bouton primaire" data-action="telecharger-copie">📥 Télécharger une copie (.grist)</button>';
  if (S.enCours) return entete + '<p class="vide">Lecture des sauvegardes…</p></section>';
  if (S.erreur) return entete + `<div class="encadre alerte">Sauvegardes illisibles : ${esc(S.erreur)}</div><div class="barre-outils">${copie}</div></section>`;
  const date = (d) => new Date(d).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
  const ilYa = (d) => {
    const min = Math.round((Date.now() - new Date(d)) / 60000);
    return min < 60 ? `il y a ${min} min` : min < 1440 ? `il y a ${Math.round(min / 60)} h` : `il y a ${Math.round(min / 1440)} j`;
  };
  // une sauvegarde s'ouvre à …/doc/<identifiant de la version> (sans « /doc/ », Grist ne la retrouve pas)
  const base = S.adresse.replace(/\/[^/]+$/, '/doc/');
  return entete + `
    <div class="barre-outils">${copie}<span class="aide" style="margin:0">${S.liste.length} sauvegarde(s) disponibles.</span></div>
    <div class="defile"><table class="tableau"><tr><th>Version du</th><th></th><th></th></tr>
      ${S.liste.slice(0, 12).map((v) => `<tr><td>${esc(date(v.lastModified))}</td><td class="discret">${esc(ilYa(v.lastModified))}</td>
        <td><a class="bouton petit" href="${esc(base + v.docId)}" target="_blank" rel="noopener">Ouvrir ↗</a></td></tr>`).join('')}
    </table></div>
    ${S.liste.length > 12 ? `<p class="aide">Les ${S.liste.length - 12} plus anciennes sont dans <i>Historique du document</i>.</p>` : ''}
  </section>`;
}

/**
 * Télécharge une copie complète du document (fichier .grist : données, pages, règles), datée.
 * Rien n'est modifié ; le téléchargement est noté au journal.
 * @param {HTMLElement} bouton
 */
async function telechargerCopie(bouton) {
  await occupe(bouton, async () => {
    const fichier = await (await Outils.api('/download')).blob();
    const nom = (parametres().Nom_application || 'document').replace(/[^\p{L}\p{N}]+/gu, '-') + '-' + new Date().toISOString().slice(0, 10) + '.grist';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(fichier);
    a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    await tracer('Copie du document téléchargée', nom);
    message('✅ Copie téléchargée : ' + nom);
  });
}

VUES.structure = () => ongletStructure() + carteSauvegardes() + ongletParametres();
VUES.parametres = VUES.structure;
declarerVue('maintenance', 'structure');
