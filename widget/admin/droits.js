/*
 * 🔐 Rôles et droits — module de la console d'administration (moteur : admin/gestion.js).
 * Reprise de l'onglet correspondant de l'ancien panneau administration.html.
 */
// --- 7. Onglet « Droits » : matrice rôle × table → règles d'accès Grist --------------------------

const reglesDuPanneau = () => (etat.acl.regles || []).filter((r) => String(r.memo || '').startsWith(MARQUE));

/**
 * Reconstitue la matrice à partir des règles « [Admin] » déjà écrites dans le document,
 * pour que l'onglet Droits montre l'état réel des droits.
 * @returns {{niveaux: object, bloquerAutres: boolean, supportPrive: boolean}}
 *          niveaux[table][rôle] = code de niveau (voir NIVEAUX)
 */
function lireMatrice() {
  // Les deux protections sont cochées par défaut ; décochées seulement si le panneau a déjà écrit des règles sans elles.
  const dejaEcrit = reglesDuPanneau().some((r) => !json(r.userAttributes, {}).name);
  const m = { niveaux: {}, bloquerAutres: gardePresente() || !dejaEcrit, supportPrive: supportPrivePresent() || !dejaEcrit };
  for (const r of reglesDuPanneau()) {
    const t = ressource(r.resource)?.tableId; if (!t) continue;
    const role = /user\.Profil\.Role == "((?:[^"\\]|\\.)*)"/.exec(r.aclFormula || '');
    if (role && !/rec\./.test(r.aclFormula)) (m.niveaux[t] = m.niveaux[t] || {})[JSON.parse('"' + role[1] + '"')] = NIVEAU_DE_PERM[r.permissionsText] || '';
    if ((r.aclFormula || '').trim().startsWith('user.Access != OWNER')) m.bloquerAutres = true;
  }
  return m;
}

/**
 * « Proposition standard » : une matrice raisonnable pour démarrer.
 * Administrateur : tout ; journal invisible aux autres rôles ; support : le Lecteur dépose,
 * les autres modifient ; tables de référence en lecture ; tables métier : Gestionnaire tout,
 * Contributeur modifie, Lecteur lit. Rien n'est écrit avant « Appliquer ces droits ».
 * @returns {object} matrice, même forme que lireMatrice()
 */
function matriceStandard() {
  const m = { niveaux: {}, bloquerAutres: true, supportPrive: true };
  const sensibles = ['Gouv_Utilisateurs', 'Gouv_Entites', 'Gouv_Parametres', 'Gouv_Territoires'];
  for (const t of tablesGerees()) {
    m.niveaux[t] = {};
    for (const r of roles()) {
      let n = 'lire';
      if (r === 'Administrateur') n = 'tout';
      else if (t === 'Gouv_Journal') n = 'aucun';
      else if (t === 'Gouv_Support' || t === 'Gouv_Support_commentaires') n = r === 'Lecteur' ? 'ajout' : 'modif';
      else if (sensibles.includes(t)) n = 'lire';
      else if (r === 'Gestionnaire') n = 'tout';
      else if (r === 'Contributeur') n = 'modif';
      m.niveaux[t][r] = n;
    }
  }
  return m;
}

/** Met un texte entre guillemets, échappé, pour l'insérer sans risque dans une formule Grist. */
const chaine = (s) => JSON.stringify(String(s));

/** Rôle qui traite le support (voit toutes les demandes, les clôt ou les rouvre). */
const ROLE_SUPPORT = 'Administrateur';
/** Condition Grist « la personne n'a pas le rôle support et n'est pas propriétaire ». */
const PAS_SUPPORT = `user.Profil.Role != ${JSON.stringify(ROLE_SUPPORT)} and user.Access != OWNER`;
/**
 * Règles de confidentialité du support, par table (toutes colonnes, sauf mention « cols »).
 * Support : chacun ne voit que ses propres demandes ; seul le support change statut, priorité, assignation.
 * Support_commentaires : chacun ne voit que les échanges de ses demandes et ne modifie que ses messages.
 */
const SUPPORT_PRIVE = {
  Gouv_Support: [
    { formule: PAS_SUPPORT + ' and rec.Demandeur != user.Email', perm: '-CRUD' },
    { cols: 'Statut,Priorite,Assigne_a', formule: PAS_SUPPORT, perm: '-U' },
  ],
  Gouv_Support_commentaires: [
    // Colonne Demandeur recopiée de la demande : une règle d'accès Grist ne lit pas une colonne à travers une
    // référence (rec.Demande.Demandeur n'est pas évalué), il lui faut une colonne de la même table.
    { formule: PAS_SUPPORT + ' and rec.Demandeur != user.Email', perm: '-CRUD' },
    { formule: PAS_SUPPORT + ' and rec.CreePar != user.Email', perm: '-UD' },
  ],
};

/**
 * Traduit la matrice (etat.droits) en règles Grist, dans l'ordre où Grist les évalue :
 * pour chaque permission, la première règle de la table qui s'applique à la personne l'emporte.
 * Ordre par table : propriétaires → jetons cachés (Parametres) → confidentialité du support
 * → une règle par rôle → blocage des personnes sans rôle reconnu.
 * @returns {{table: string, cols?: string, formule: string, perm: string}[]}
 */
function construireRegles() {
  const m = etat.droits, out = [];
  for (const t of tablesGerees()) {
    const lignes = Object.entries(m.niveaux[t] || {}).filter(([r, n]) => n && roles().includes(r));
    if (!lignes.length && !m.bloquerAutres && !(m.supportPrive && SUPPORT_PRIVE[t]) && t !== 'Gouv_Parametres') continue;
    out.push({ table: t, formule: 'user.Access == OWNER', perm: '+CRUD' });
    // Les jetons d'accès (clés « …_jeton ») ne sont visibles que des propriétaires du document.
    // Liste explicite : les règles d'accès Grist n'évaluent pas les méthodes comme .endswith() (la règle bloquerait toute la table).
    if (t === 'Gouv_Parametres' && colonne(t, 'Cle')) out.push({ table: t, formule: 'rec.Cle in ["Github_jeton", "Gitlab_jeton"] and user.Access != OWNER', perm: '-CRUD' });
    // Support : chacun ne voit que ses propres demandes et seuls les administrateurs changent statut, priorité, assignation.
    if (m.supportPrive && SUPPORT_PRIVE[t]) for (const r of SUPPORT_PRIVE[t]) out.push({ table: t, ...r });
    for (const [r, n] of lignes) out.push({ table: t, formule: 'user.Profil.Actif and user.Profil.Role == ' + chaine(r), perm: NIVEAUX.find((x) => x.code === n).perm });
    if (m.bloquerAutres) {
      out.push({ table: t, formule: 'user.Access != OWNER', perm: '-CRUD' });
    }
  }
  return out;
}

/**
 * Contenu de l'onglet « Droits » : matrice rôle × table, options (blocage, support privé),
 * aperçu des règles et boutons d'application. Réservé aux propriétaires du document.
 * @returns {string} HTML de l'onglet
 */
function ongletDroits() {
  if (!etat.acl.regles) return '<div class="encadre alerte">Seuls les <b>propriétaires</b> du document peuvent gérer les droits.</div>';
  if (!aTable('Gouv_Utilisateurs') || !roles().length) return '<div class="encadre alerte">Il faut d\'abord des utilisateurs avec des rôles (onglet Utilisateurs).</div>';
  if (!etat.droits) etat.droits = lireMatrice();
  const m = etat.droits;
  const metier = tablesMetier();
  const nbMetier = [...metier.values()].reduce((a, b) => a + b, 0);
  const garde = gardePresente();
  return `
    <section class="carte">
      <h2>🔐 Qui peut faire quoi ?</h2>
      <p class="aide">Pour chaque table, choisissez ce que chaque rôle peut faire. Le rôle vient de la table Utilisateurs (via le courriel de connexion). Une personne <b>inactive</b> n'a aucun rôle. Les <b>propriétaires</b> gardent toujours tous les droits.</p>
      ${metier.size ? `<div class="encadre">⚙️ ${metier.size} table(s) ont des <b>règles métier</b> (${nbMetier} règles : droits selon l'entité, le bureau, l'étape…). Le panneau ne les modifie pas ; elles se gèrent dans <i>Permissions avancées</i>.</div>` : ''}
      ${!garde ? `<div class="encadre alerte">⚠️ Les personnes non inscrites ne sont pas bloquées. <button class="bouton petit" data-action="garde">Ne leur montrer que l'accueil</button></div>` : ''}
      <div class="barre-outils">
        <button class="bouton petit" data-action="standard">✨ Proposition standard</button>
        <button class="bouton petit" data-action="vider">Tout effacer</button>
        <label><input type="checkbox" id="bloquer-autres" ${m.bloquerAutres ? 'checked' : ''}> Bloquer toute personne sans rôle reconnu</label>
        ${aTable('Gouv_Support') ? `<label title="Seuls les ${ROLE_SUPPORT}s voient toutes les demandes et peuvent les clore"><input type="checkbox" id="support-prive" ${m.supportPrive ? 'checked' : ''}> Support : chacun ne voit que ses demandes</label>` : ''}
      </div>
      <div class="defile"><table class="tableau matrice">
        <tr><th>Table</th>${roles().map((r) => `<th>${esc(r)}</th>`).join('')}</tr>
        ${etat.meta.tables.filter((t) => !HORS_MATRICE.includes(t.tableId)).map((t) => metier.has(t.tableId)
          ? `<tr class="metier"><td class="table">${esc(t.tableId)}</td><td colspan="${roles().length}" title="${metier.get(t.tableId)} règle(s) propres à l'application, dans Permissions avancées">⚙️ règles métier (${metier.get(t.tableId)})</td></tr>`
          : `<tr><td class="table">${esc(t.tableId)}</td>
          ${roles().map((r) => `<td><select class="champ" data-mat-table="${esc(t.tableId)}" data-mat-role="${esc(r)}">${NIVEAUX.map((n) => `<option value="${n.code}" ${(m.niveaux[t.tableId] || {})[r] === n.code || (!(m.niveaux[t.tableId] || {})[r] && !n.code) ? 'selected' : ''}>${n.libelle}</option>`).join('')}</select></td>`).join('')}
        </tr>`).join('')}
      </table></div>
    </section>
    <section class="carte">
      <h2>👀 Aperçu des règles</h2>
      <pre class="apercu" id="apercu-regles"></pre>
      <div class="barre-outils">
        <button class="bouton primaire" data-action="appliquer-droits">Appliquer ces droits</button>
        <button class="bouton" data-action="retirer-droits">Retirer les règles du panneau</button>
        <span class="aide" style="margin:0">Vérifiez ensuite avec « Voir en tant que » dans <i>Permissions avancées</i>.</span>
      </div>
    </section>`;
}

/** Réécrit l'aperçu des règles qui seraient écrites (rien n'est écrit dans le document). */
function majApercu() {
  const el = $('apercu-regles'); if (!el) return;
  const r = construireRegles();
  let t = '', tableEnCours = '';
  for (const x of r) { if (x.table !== tableEnCours) { tableEnCours = x.table; t += '\n▸ ' + x.table + '\n'; } t += '   ' + (x.cols ? '[' + x.cols + '] ' : '') + 'si ' + x.formule.padEnd(70) + ' → ' + x.perm + '\n'; }
  el.textContent = r.length ? t.trim() : 'Aucune règle : le document reste ouvert à toute personne qui y a accès.';
}

/**
 * Écrit (ou retire) les règles du panneau dans les règles d'accès du document.
 * Étapes : crée les « ressources » Grist manquantes (table × colonnes visées), déclare l'attribut
 * user.Profil s'il n'existe pas, supprime les anciennes règles [Admin] puis ajoute les nouvelles,
 * placées avant toutes les autres. Les règles écrites à la main ne sont pas touchées.
 * @param {HTMLElement} bouton
 * @param {boolean} retirer  vrai : retire seulement les règles du panneau, sans en écrire
 */
async function appliquerDroits(bouton, retirer) {
  await occupe(bouton, async () => {
    const regles = retirer ? [] : construireRegles();
    let ressources = etat.acl.ressources;
    const cles = [...new Set(regles.map((r) => r.table + '|' + (r.cols || '*')))].map((k) => k.split('|'));
    const besoin = regles.length ? [['*', '*'], ...cles] : [];
    const manquantes = besoin.filter(([t, c]) => !ressources.some((r) => r.tableId === t && r.colIds === c));
    if (manquantes.length) {
      await agir([['BulkAddRecord', '_grist_ACLResources', manquantes.map(() => null), { tableId: manquantes.map((m) => m[0]), colIds: manquantes.map((m) => m[1]) }]]);
      ressources = (await lire('_grist_ACLResources')) || [];
    }
    const idRes = (t, c = '*') => ressources.find((r) => r.tableId === t && r.colIds === c).id;
    // Les règles du panneau passent avant toutes les autres, sauf les règles [Intégrité] remises juste devant elles.
    let pos = Math.min(0, ...etat.acl.regles.map((r) => Number(r.rulePos) || 0)) - 1000;
    const integrite = etat.acl.regles.filter((r) => String(r.memo || '').startsWith(INTEGRITE));
    const devant = integrite.map((r, i) => ['UpdateRecord', '_grist_ACLRules', r.id, { rulePos: pos - 500 + i }]);
    const nouvelles = [];
    const attributExiste = etat.acl.regles.some((r) => json(r.userAttributes, {}).name === ATTRIBUT && json(r.userAttributes, {}).tableId === 'Gouv_Utilisateurs');
    if (regles.length && !attributExiste) {
      nouvelles.push({ resource: idRes('*'), aclFormula: '', permissionsText: '', rulePos: pos++, memo: MARQUE + ' attribut',
        userAttributes: JSON.stringify({ name: ATTRIBUT, tableId: 'Gouv_Utilisateurs', charId: 'Email', lookupColId: colonne('Gouv_Utilisateurs', 'Courriel_cle') ? 'Courriel_cle' : 'Courriel' }) });
    }
    for (const r of regles) nouvelles.push({ resource: idRes(r.table, r.cols), aclFormula: r.formule, permissionsText: r.perm, rulePos: pos++, memo: MARQUE, userAttributes: '' });
    // L'attribut user.Profil n'est jamais retiré : d'autres règles (page d'accueil…) peuvent s'en servir.
    const anciennes = reglesDuPanneau().filter((r) => !json(r.userAttributes, {}).name);
    const actions = [...(retirer ? [] : devant)];
    if (anciennes.length) actions.push(['BulkRemoveRecord', '_grist_ACLRules', anciennes.map((r) => r.id)]);
    if (nouvelles.length) {
      const cles = Object.keys(nouvelles[0]);
      actions.push(['BulkAddRecord', '_grist_ACLRules', nouvelles.map(() => null), Object.fromEntries(cles.map((k) => [k, nouvelles.map((n) => n[k])]))]);
    }
    if (actions.length) await agir(actions);
    // « Bloquer toute personne sans rôle reconnu » : la garde du document (non inscrits, inactifs, sans rôle → accueil seulement)
    if (!retirer && etat.droits.bloquerAutres && !gardePresente()) { etat.acl.regles = await lire('_grist_ACLRules'); await poserGarde(null); }
    if (!retirer) await reglesDocumentation();
    await tracer(retirer ? 'Droits retirés' : 'Droits appliqués', retirer ? anciennes.length + ' règle(s) retirée(s)' : regles.length + ' règle(s) sur ' + new Set(regles.map((r) => r.table)).size + ' table(s)');
    message(retirer ? '✅ Règles du panneau retirées.' : '✅ ' + regles.length + ' règles appliquées.');
    await actualiser();
  });
}

/**
 * Documentation : lecture pour les personnes inscrites (actives et avec un rôle), modification
 * réservée aux propriétaires du document (décision du 24/11/2026). Règles [Gouvernance] posées sur
 * la table elle-même, donc avant les règles générales ; les propriétaires passent ensuite par la
 * règle « Propriétaires : tous les droits ». Rien n'est fait si elles sont déjà là.
 */
async function reglesDocumentation() {
  if (!aTable('Gouv_Documentation')) return;
  let res = (await lire('_grist_ACLResources')) || [];
  const regles = (await lire('_grist_ACLRules')) || [];
  if (regles.some((r) => String(r.memo || '').startsWith('[Gouvernance] Documentation'))) return;
  const actions = [];
  // les anciennes règles du panneau sur cette table ne servent plus
  const doc = res.find((r) => r.tableId === 'Gouv_Documentation' && r.colIds === '*');
  const anciennes = doc ? regles.filter((r) => r.resource === doc.id && String(r.memo || '').startsWith(MARQUE)) : [];
  if (anciennes.length) actions.push(['BulkRemoveRecord', '_grist_ACLRules', anciennes.map((r) => r.id)]);
  if (!doc) {
    await agir([['AddRecord', '_grist_ACLResources', null, { tableId: 'Gouv_Documentation', colIds: '*' }]]);
    res = (await lire('_grist_ACLResources')) || [];
  }
  const id = res.find((r) => r.tableId === 'Gouv_Documentation' && r.colIds === '*').id;
  actions.push(['BulkAddRecord', '_grist_ACLRules', [null, null], {
    resource: [id, id],
    aclFormula: ['user.Access != OWNER and user.Profil and user.Profil.Actif and user.Profil.Role', 'user.Access != OWNER'],
    permissionsText: ['+R-CUD', '-CRUD'],
    rulePos: [5, 6],
    memo: ['[Gouvernance] Documentation : lecture pour les inscrits', '[Gouvernance] Documentation : modification réservée aux propriétaires'],
    userAttributes: ['', ''],
  }]);
  await agir(actions);
  await tracer('Documentation protégée', 'Modification réservée aux propriétaires du document');
}

/**
 * Pose la « garde » de base : une personne absente de Utilisateurs (ou inactive) ne voit que
 * la table Accueil ; les propriétaires gardent tous les droits. Ces règles portent la mention
 * [Gouvernance] et non [Admin] : « Retirer les règles du panneau » ne les enlève donc pas.
 * @param {HTMLElement} bouton
 */
async function poserGarde(bouton) {
  if (!aTable('Gouv_Accueil')) return message("Installez d'abord la page d'accueil publique (onglet Structure).", true);
  await occupe(bouton, async () => {
    let res = etat.acl.ressources;
    const manque = [['*', '*'], ['Gouv_Accueil', '*']].filter(([t]) => !res.some((r) => r.tableId === t && r.colIds === '*'));
    if (manque.length) {
      await agir([['BulkAddRecord', '_grist_ACLResources', manque.map(() => null), { tableId: manque.map((m) => m[0]), colIds: manque.map(() => '*') }]]);
      res = await lire('_grist_ACLResources');
    }
    const id = (t) => res.find((r) => r.tableId === t && r.colIds === '*').id;
    const attribut = etat.acl.regles.some((r) => json(r.userAttributes, {}).name === ATTRIBUT);
    const a = [];
    if (!attribut) a.push({ resource: id('*'), aclFormula: '', permissionsText: '', rulePos: 1, memo: '[Gouvernance] attribut', userAttributes: JSON.stringify({ name: ATTRIBUT, tableId: 'Gouv_Utilisateurs', charId: 'Email', lookupColId: colonne('Gouv_Utilisateurs', 'Courriel_cle') ? 'Courriel_cle' : 'Courriel' }) });
    a.push({ resource: id('Gouv_Accueil'), aclFormula: 'True', permissionsText: '+R-CUD', rulePos: 2, memo: '[Gouvernance] Accueil lisible par tous', userAttributes: '' });
    a.push({ resource: id('*'), aclFormula: 'user.Access == OWNER', permissionsText: 'all', rulePos: 3, memo: '[Gouvernance] Propriétaires : tous les droits', userAttributes: '' });
    a.push({ resource: id('*'), aclFormula: 'not user.Profil or not user.Profil.Actif or not user.Profil.Role', permissionsText: 'none', rulePos: 4, memo: '[Gouvernance] Non inscrits, inactifs ou sans rôle : Accueil seulement', userAttributes: '' });
    const cles = Object.keys(a[0]);
    await agir([['BulkAddRecord', '_grist_ACLRules', a.map(() => null), Object.fromEntries(cles.map((k) => [k, a.map((x) => x[k])]))]]);
    await tracer('Garde posée', 'Non inscrits : page d\'accueil seulement');
    await reglesDocumentation();
    message('✅ Les personnes non inscrites ne voient plus que la page d\'accueil.');
    await actualiser();
  });
}

// Vue du module dans la console
VUES.droits = ongletDroits;
declarerVue('droits', 'droits');
