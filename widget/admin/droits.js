/*
 * 🔐 Rôles et droits — module de la console d'administration (moteur : admin/gestion.js).
 * Reprise de l'onglet correspondant de l'ancien panneau administration.html.
 */
// --- 7. Onglet « Droits » : matrice rôle × table → règles d'accès Grist --------------------------


/**
 * Reconstitue la matrice à partir des règles « [Admin] » déjà écrites dans le document,
 * pour que l'onglet Droits montre l'état réel des droits. Pas de case « héritée » : une case sans
 * règle écrite reçoit le droit de la proposition standard (comptée dans « proposees », à appliquer).
 * @returns {{niveaux: object, bloquerAutres: boolean, supportPrive: boolean, proposees: number}}
 *          niveaux[table][rôle] = code de niveau (voir NIVEAUX)
 */
function lireMatrice() {
  // Les deux protections sont cochées par défaut ; décochées seulement si le panneau a déjà écrit des règles sans elles.
  const dejaEcrit = reglesDuPanneau().some((r) => !json(r.userAttributes, {}).name);
  const m = { niveaux: {}, bloquerAutres: gardePresente() || !dejaEcrit, supportPrive: supportPrivePresent() || !dejaEcrit };
  for (const r of reglesDuPanneau()) {
    const t = ressource(r.resource)?.tableId; if (!t) continue;
    // rôle de la règle : « user.X.Role == "r" » (un rôle par personne) ou « "r" in user.X.Role » (plusieurs)
    const role = /user\.\w+\.Role == ("(?:[^"\\]|\\.)*")/.exec(r.aclFormula || '') || /("(?:[^"\\]|\\.)*") in user\.\w+\.Role/.exec(r.aclFormula || '');
    if (role && !/rec\./.test(r.aclFormula)) (m.niveaux[t] = m.niveaux[t] || {})[JSON.parse(role[1])] = NIVEAU_DE_PERM[r.permissionsText] || '';
    if ((r.aclFormula || '').trim().startsWith('user.Access != OWNER')) m.bloquerAutres = true;
  }
  const standard = matriceStandard().niveaux;
  m.proposees = 0;
  for (const t of tablesGerees()) for (const r of roles()) {
    if ((m.niveaux[t] || {})[r]) continue;
    (m.niveaux[t] = m.niveaux[t] || {})[r] = standard[t]?.[r] || 'lire';
    m.proposees++;
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
  const sensibles = [registre().table, 'Gouv_Entites', 'Gouv_Parametres', 'Gouv_Territoires'];
  for (const t of tablesGerees()) {
    m.niveaux[t] = {};
    for (const r of roles()) {
      let n = 'lire';
      if (rolesAdmin().includes(r)) n = 'tout';
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

/** Condition Grist « la personne n'administre pas l'application (rôles du support) et n'est pas propriétaire ». */
const pasSupport = () => rolesAdmin().map((r) => `not (${aLeRole(r)})`).join(' and ') + ' and user.Access != OWNER'
  + (condAdministrateurs() ? ` and not (${condAdministrateurs()})` : '');
/**
 * Règles de confidentialité du support, par table (toutes colonnes, sauf mention « cols »).
 * Support : chacun ne voit que ses propres demandes ; seul le support change statut, priorité, assignation.
 * Support_commentaires : chacun ne voit que les échanges de ses demandes et ne modifie que ses messages.
 */
const SUPPORT_PRIVE = () => ({
  Gouv_Support: [
    { formule: pasSupport() + ' and rec.Demandeur != user.Email', perm: '-CRUD' },
    { cols: 'Statut,Priorite,Assigne_a', formule: pasSupport(), perm: '-U' },
  ],
  Gouv_Support_commentaires: [
    // Colonne Demandeur recopiée de la demande : une règle d'accès Grist ne lit pas une colonne à travers une
    // référence (rec.Demande.Demandeur n'est pas évalué), il lui faut une colonne de la même table.
    { formule: pasSupport() + ' and rec.Demandeur != user.Email', perm: '-CRUD' },
    { formule: pasSupport() + ' and rec.CreePar != user.Email', perm: '-UD' },
  ],
});

/**
 * Traduit la matrice (etat.droits) en règles Grist, dans l'ordre où Grist les évalue :
 * pour chaque permission, la première règle de la table qui s'applique à la personne l'emporte.
 * Ordre par table : propriétaires → jetons cachés (Parametres) → confidentialité du support
 * → une règle par rôle → blocage des personnes sans rôle reconnu.
 * @returns {{table: string, cols?: string, formule: string, perm: string}[]}
 */
function construireRegles() {
  const m = etat.droits, out = [], prive = SUPPORT_PRIVE();
  for (const t of tablesGerees()) {
    const lignes = Object.entries(m.niveaux[t] || {}).filter(([r, n]) => n && roles().includes(r));
    if (!lignes.length && !m.bloquerAutres && !(m.supportPrive && prive[t]) && t !== 'Gouv_Parametres') continue;
    out.push({ table: t, formule: 'user.Access == OWNER', perm: '+CRUD' });
    // Les jetons d'accès (clés « …_jeton ») ne sont visibles que des propriétaires du document.
    // Liste explicite : les règles d'accès Grist n'évaluent pas les méthodes comme .endswith() (la règle bloquerait toute la table).
    if (t === 'Gouv_Parametres' && colonne(t, 'Cle')) out.push({ table: t, formule: 'rec.Cle in ["Github_jeton", "Gitlab_jeton"] and user.Access != OWNER', perm: '-CRUD' });
    // Les administrateurs choisis dans les Paramètres : tous les droits sur la table (après les jetons, qu'ils ne voient pas)
    if (condAdministrateurs()) out.push({ table: t, formule: condAdministrateurs(), perm: '+CRUD' });
    // Support : chacun ne voit que ses propres demandes et seuls les administrateurs changent statut, priorité, assignation.
    if (m.supportPrive && prive[t]) for (const r of prive[t]) out.push({ table: t, ...r });
    for (const [r, n] of lignes) out.push({ table: t, formule: condRole(r), perm: NIVEAUX.find((x) => x.code === n).perm });
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
  if (!aTable(registre().table) || !roles().length) return `<div class="encadre alerte">Il faut d'abord des utilisateurs avec des rôles (table ${esc(registre().table)}).</div>`;
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
      ${m.proposees ? `<div class="encadre">✏️ ${m.proposees} case(s) n'avaient pas de droit écrit : la proposition standard y est mise. Vérifiez, puis « Appliquer ces droits ».</div>` : ''}
      ${ressourcesOrphelines().length ? `<div class="encadre">🧹 Règles d'accès sur des tables qui n'existent plus : ${ressourcesOrphelines().map((r) => '<code>' + esc(r.tableId) + '</code>').join(', ')}. Grist refuse tout changement de règles tant qu'elles sont là : elles seront retirées au prochain enregistrement des droits (elles ne protègent plus rien).</div>` : ''}
      <div class="encadre">👤 <b>Administrateurs</b> (Maintenance › Paramètres) : ${administrateurs().length ? esc(administrateurs().join(', ')) + ' : tous les droits sur ces tables.' : 'aucun choisi.'}</div>
      ${!garde ? `<div class="encadre alerte">⚠️ Les personnes non inscrites ne sont pas bloquées. <button class="bouton petit" data-action="garde">Ne leur montrer que l'accueil</button></div>` : ''}
      <div class="barre-outils">
        <button class="bouton petit" data-action="standard">✨ Proposition standard</button>
        <label><input type="checkbox" id="bloquer-autres" ${m.bloquerAutres ? 'checked' : ''}> Bloquer toute personne sans rôle reconnu</label>
        ${aTable('Gouv_Support') ? `<label title="Seuls les rôles ${esc(rolesAdmin().join(', '))} voient toutes les demandes et peuvent les clore"><input type="checkbox" id="support-prive" ${m.supportPrive ? 'checked' : ''}> Support : chacun ne voit que ses demandes</label>` : ''}
      </div>
      <div class="defile"><table class="tableau matrice">
        <tr><th>Table</th>${roles().map((r) => `<th>${esc(r)}</th>`).join('')}</tr>
        ${etat.meta.tables.filter((t) => !HORS_MATRICE.includes(t.tableId)).map((t) => metier.has(t.tableId)
          ? `<tr class="metier"><td class="table">${esc(t.tableId)}</td><td colspan="${roles().length}" title="${metier.get(t.tableId)} règle(s) propres à l'application, dans Permissions avancées">⚙️ règles métier (${metier.get(t.tableId)})</td></tr>`
          : `<tr><td class="table">${esc(t.tableId)}</td>
          ${roles().map((r) => `<td><select class="champ" data-mat-table="${esc(t.tableId)}" data-mat-role="${esc(r)}">${NIVEAUX.filter((n) => n.code).map((n) => `<option value="${n.code}" ${(m.niveaux[t.tableId] || {})[r] === n.code || (!(m.niveaux[t.tableId] || {})[r] && !n.code) ? 'selected' : ''}>${n.libelle}</option>`).join('')}</select></td>`).join('')}
        </tr>`).join('')}
      </table></div>
    </section>
    <section class="carte">
      <h2>👀 Aperçu des règles</h2>
      <pre class="apercu" id="apercu-regles"></pre>
      <div class="barre-outils">
        <button class="bouton primaire" data-action="appliquer-droits">Appliquer ces droits</button>
        <button class="bouton" data-action="retirer-droits">Retirer les règles du panneau</button>
        <span class="aide" style="margin:0">Vérifiez ensuite avec « Voir en tant que » ci-dessous.</span>
      </div>
    </section>
    ${carteSimulation()}`;
}

/**
 * Carte « Voir en tant que » : ce qu'une personne inscrite peut faire, table par table, d'après les droits
 * APPLIQUÉS (pas la matrice en cours de modification) ; plus un lien qui ouvre le vrai document avec ses
 * droits (mode « Voir en tant que » de Grist, réservé aux propriétaires), pour tout vérifier, règles métier comprises.
 * @returns {string} HTML de la carte
 */
function carteSimulation() {
  if (etat.adresseDoc === undefined) { etat.adresseDoc = ''; Outils.adresseDocument().then((a) => { etat.adresseDoc = a; afficher(); }).catch(() => {}); }
  const U = (etat.d[registre().table] || []).filter((u) => estCourriel(u.Courriel)).sort((a, b) => cle(a.Courriel).localeCompare(cle(b.Courriel)));
  const choisi = etat.simulation || '';
  const lien = choisi && etat.adresseDoc
    ? `<a class="bouton" href="${esc(etat.adresseDoc + '?aclAsUser_=' + encodeURIComponent(choisi))}" target="_blank" rel="noopener">Ouvrir le document en tant que cette personne ↗</a>` : '';
  return `<section class="carte"><h2>🎭 Voir en tant que</h2>
    <p class="aide">Ce qu'une personne peut faire, d'après les droits <b>appliqués</b>. Le lien ouvre le document avec ses droits, pour vérifier en vrai (réservé aux propriétaires).</p>
    <div class="barre-outils">
      <select class="champ" id="simu-personne" style="min-width:320px"><option value="">Choisir une personne…</option>
        ${U.map((u) => `<option value="${esc(u.Courriel)}" ${cle(u.Courriel) === cle(choisi) ? 'selected' : ''}>${esc(u.Courriel)}${rolesDe(u).length ? ' — ' + esc(rolesDe(u).join(', ')) : ''}${u.Actif === false ? ' (inactif)' : ''}</option>`).join('')}
      </select>${lien}
    </div>
    ${choisi ? simulation(choisi) : ''}
  </section>`;
}

/** Résultat de la simulation pour un courriel : un message, ou un tableau table → droits. */
function simulation(courriel) {
  const u = (etat.d[registre().table] || []).find((x) => cle(x.Courriel) === cle(courriel));
  const encadre = (classe, texte) => `<div class="encadre ${classe}" style="margin-top:12px">${texte}</div>`;
  const sesRoles = rolesDe(u);
  if (!u || u.Actif === false || !sesRoles.length) {
    const pourquoi = !u ? 'absente de la table Utilisateurs' : u.Actif === false ? 'inactive' : 'sans rôle';
    return gardePresente()
      ? encadre('', `🏠 Personne ${pourquoi} : elle <b>ne voit que la page d'accueil</b> (sauf si elle est propriétaire du document).`)
      : encadre('alerte', `⚠️ Personne ${pourquoi}, et les non-inscrits ne sont pas bloqués : elle a les droits par défaut du document.`);
  }
  const m = lireMatrice();
  const metier = tablesMetier();
  const lignes = etat.meta.tables.filter((t) => !HORS_MATRICE.includes(t.tableId)).map((t) => {
    if (metier.has(t.tableId)) return [t.tableId, '⚙️ Règles métier : à vérifier avec le lien « Ouvrir en tant que »'];
    // plusieurs rôles : le plus large l'emporte (NIVEAUX va du plus restreint au plus large)
    const rang = (c) => NIVEAUX.findIndex((x) => x.code === c);
    const code = sesRoles.map((r) => (m.niveaux[t.tableId] || {})[r] || '').sort((a, b) => rang(b) - rang(a))[0] || '';
    return [t.tableId, code ? esc(NIVEAUX.find((x) => x.code === code).libelle) : '— Règle par défaut du document'];
  });
  return `<div class="defile" style="margin-top:12px"><table class="tableau"><tr><th>Table</th><th>${esc(sesRoles.join(', '))} : ce qu'elle peut faire</th></tr>
    ${lignes.map(([t, d]) => `<tr><td class="table">${esc(t)}</td><td>${d}</td></tr>`).join('')}</table></div>
    <p class="aide">À condition que le document soit partagé avec elle dans Grist :
    partagée en lecture, elle ne modifie rien. Un propriétaire du document voit tout, quelles que soient les règles.</p>`;
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
 * utilisateur du registre (user.Profil par défaut) s'il n'existe pas, supprime les anciennes règles [Admin] puis ajoute les nouvelles,
 * placées avant toutes les autres. Les règles écrites à la main ne sont pas touchées.
 * @param {HTMLElement} bouton
 * @param {boolean} retirer  vrai : retire seulement les règles du panneau, sans en écrire
 */
async function appliquerDroits(bouton, retirer) {
  await occupe(bouton, async () => {
    const regles = retirer ? [] : construireRegles();
    const plan = planAcl();
    // Les règles du panneau passent avant toutes les autres, sauf les règles [Intégrité] et [Priorité] remises juste devant elles.
    let pos = Math.min(0, ...etat.acl.regles.map((r) => Number(r.rulePos) || 0)) - 1000;
    if (!retirer) etat.acl.regles.filter(estPrioritaire)
      .forEach((r, i) => plan.actions.push(['UpdateRecord', '_grist_ACLRules', r.id, { rulePos: pos - 500 + i }]));
    // L'attribut du registre n'est jamais retiré : d'autres règles (page d'accueil…) peuvent s'en servir.
    const anciennes = reglesDuPanneau().filter((r) => !json(r.userAttributes, {}).name);
    if (anciennes.length) plan.actions.push(['BulkRemoveRecord', '_grist_ACLRules', anciennes.map((r) => r.id)]);
    if (regles.length && !registre().declare) plan.regle('*', '*', { aclFormula: '', permissionsText: '', rulePos: pos++, memo: MARQUE + ' attribut', userAttributes: attributProfil() });
    for (const r of regles) plan.regle(r.table, r.cols, { aclFormula: r.formule, permissionsText: r.perm, rulePos: pos++, memo: MARQUE });
    // « Bloquer toute personne sans rôle reconnu » : la garde du document (non inscrits, inactifs, sans rôle → accueil seulement)
    if (!retirer && etat.droits.bloquerAutres && !gardePresente()) planGarde(plan);
    if (!retirer) planDocumentation(plan);
    if (!retirer && aTable('Gouv_Administration') && !verrouAdminPresent()) REGLES_VERROU_ADMIN.forEach((r) => plan.regle('Gouv_Administration', '*', r));
    await tracer(retirer ? 'Droits retirés' : 'Droits appliqués', retirer ? anciennes.length + ' règle(s) retirée(s)' : regles.length + ' règle(s) sur ' + new Set(regles.map((r) => r.table)).size + ' table(s)');
    message(retirer ? '✅ Règles du panneau retirées.' : '✅ ' + regles.length + ' règles appliquées.');
    // En un seul envoi : changer les règles recharge le document, et donc cette page
    await plan.envoyer();
    await actualiser();
  });
}

/**
 * Prépare des changements de règles d'accès pour les envoyer EN UNE FOIS : Grist recharge le document
 * (et cette page) à chaque changement de règles, si bien qu'un second envoi ne partirait jamais.
 * Les ressources (table et colonnes visées) qui manquent reçoivent leur identifiant d'avance.
 * @returns {{actions: Array, ressource: Function, regle: Function, envoyer: Function}}
 */
function planAcl() {
  const ressources = (etat.acl.ressources || []).slice();
  let prochaine = Math.max(0, ...ressources.map((r) => r.id)) + 1;
  const nouvelles = [], regles = [], actions = [];
  const ressource = (t, c = '*') => {
    let r = ressources.find((x) => x.tableId === t && x.colIds === c);
    if (!r) { r = { id: prochaine++, tableId: t, colIds: c }; ressources.push(r); nouvelles.push(r); }
    return r.id;
  };
  return {
    actions,
    ressource,
    /** Ajoute une règle sur la table t (colonnes c) ; champs : aclFormula, permissionsText, rulePos, memo, userAttributes. */
    regle(t, c, champs) { regles.push({ resource: ressource(t, c || '*'), userAttributes: '', ...champs }); },
    async envoyer() {
      const tout = [];
      // d'abord les règles orphelines (table supprimée) : sans ça, Grist refuse tout l'envoi
      const orphelines = ressourcesOrphelines();
      if (orphelines.length) {
        const ids = new Set(orphelines.map((r) => r.id));
        const reglesOrphelines = (etat.acl.regles || []).filter((r) => ids.has(r.resource)).map((r) => r.id);
        if (reglesOrphelines.length) tout.push(['BulkRemoveRecord', '_grist_ACLRules', reglesOrphelines]);
        tout.push(['BulkRemoveRecord', '_grist_ACLResources', [...ids]]);
        await tracer('Règles orphelines retirées', orphelines.map((r) => r.tableId).join(', ') + ' (tables qui n\'existent plus)');
      }
      if (nouvelles.length) tout.push(['BulkAddRecord', '_grist_ACLResources', nouvelles.map((r) => r.id), { tableId: nouvelles.map((r) => r.tableId), colIds: nouvelles.map((r) => r.colIds) }]);
      tout.push(...actions);
      if (regles.length) {
        const cles = ['resource', 'aclFormula', 'permissionsText', 'rulePos', 'memo', 'userAttributes'];
        tout.push(['BulkAddRecord', '_grist_ACLRules', regles.map(() => null), Object.fromEntries(cles.map((k) => [k, regles.map((r) => r[k])]))]);
      }
      if (tout.length) await agir(tout);
    },
  };
}

/** Attribut utilisateur (user.Profil par défaut) : la ligne du registre de la personne connectée (par son courriel). */
const attributProfil = () => { const t = registre().table; return JSON.stringify({ name: registre().attribut, tableId: t, charId: 'Email',
  lookupColId: colonne(t, 'Courriel_cle') ? 'Courriel_cle' : 'Courriel' }); };

/**
 * Documentation : lecture pour les personnes inscrites (actives et avec un rôle), modification
 * réservée aux propriétaires du document (décision du 24/11/2026). Règles [Gouvernance] posées sur
 * la table elle-même, donc avant les règles générales ; les propriétaires passent ensuite par la
 * règle « Propriétaires : tous les droits ». Rien n'est ajouté au plan si elles sont déjà là.
 * @param {object} plan  planAcl()
 */
function planDocumentation(plan) {
  if (!aTable('Gouv_Documentation')) return;
  const regles = etat.acl.regles || [];
  if (regles.some((r) => String(r.memo || '').startsWith('[Gouvernance] Documentation'))) return;
  // les anciennes règles du panneau sur cette table ne servent plus
  const doc = (etat.acl.ressources || []).find((r) => r.tableId === 'Gouv_Documentation' && r.colIds === '*');
  const anciennes = doc ? regles.filter((r) => r.resource === doc.id && String(r.memo || '').startsWith(MARQUE)) : [];
  if (anciennes.length) plan.actions.push(['BulkRemoveRecord', '_grist_ACLRules', anciennes.map((r) => r.id)]);
  plan.regle('Gouv_Documentation', '*', { aclFormula: 'user.Access != OWNER and ' + condInscrit(), permissionsText: '+R-CUD', rulePos: 5, memo: '[Gouvernance] Documentation : lecture pour les inscrits' });
  plan.regle('Gouv_Documentation', '*', { aclFormula: 'user.Access != OWNER', permissionsText: '-CRUD', rulePos: 6, memo: '[Gouvernance] Documentation : modification réservée aux propriétaires' });
}

/**
 * Pose la « garde » de base : une personne absente de Utilisateurs (ou inactive) ne voit que
 * la table Accueil ; les propriétaires gardent tous les droits. Ces règles portent la mention
 * [Gouvernance] et non [Admin] : « Retirer les règles du panneau » ne les enlève donc pas.
 * @param {HTMLElement} bouton
 */
async function poserGarde(bouton) {
  if (!aTable('Gouv_Accueil')) return message("Installez d'abord la page d'accueil publique (Maintenance).", true);
  await occupe(bouton, async () => {
    const plan = planAcl();
    planGarde(plan);
    planDocumentation(plan);
    await tracer('Garde posée', 'Non inscrits : page d\'accueil seulement');
    message('✅ Les personnes non inscrites ne voient plus que la page d\'accueil.');
    await plan.envoyer();   // en un seul envoi : changer les règles recharge cette page
    await actualiser();
  });
}

/** Règles de la garde, ajoutées au plan (avec l'attribut du registre s'il manque). */
function planGarde(plan) {
  if (!aTable('Gouv_Accueil')) return;
  if (!registre().declare) {
    plan.regle('*', '*', { aclFormula: '', permissionsText: '', rulePos: 1, memo: '[Gouvernance] attribut', userAttributes: attributProfil() });
  }
  plan.regle('Gouv_Accueil', '*', { aclFormula: 'True', permissionsText: '+R-CUD', rulePos: 2, memo: '[Gouvernance] Accueil lisible par tous' });
  plan.regle('*', '*', { aclFormula: 'user.Access == OWNER', permissionsText: 'all', rulePos: 3, memo: '[Gouvernance] Propriétaires : tous les droits' });
  plan.regle('*', '*', { aclFormula: condNonInscrit(), permissionsText: 'none', rulePos: 4, memo: '[Gouvernance] Non inscrits, inactifs ou sans rôle : Accueil seulement' });
}

// Vue du module dans la console
VUES.droits = ongletDroits;
declarerVue('droits', 'droits');
