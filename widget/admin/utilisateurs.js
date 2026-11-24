/*
 * 👥 Utilisateurs — module de la console d'administration (moteur : admin/gestion.js).
 * Reprise de l'onglet correspondant de l'ancien panneau administration.html.
 */
// --- 6. Onglet « Utilisateurs » ------------------------------------------------------------------

/**
 * Utilisateurs à afficher selon les filtres choisis (texte, rôle, statut), triés par courriel.
 * Le statut « Anomalies » ne garde que les courriels mal formés ou en double.
 * @returns {object[]} lignes de la table Utilisateurs
 */
function utilisateursFiltres() {
  const f = etat.filtres;
  const t = cle(f.texte);
  return (etat.d.Gouv_Utilisateurs || []).filter((u) => {
    if (f.statut === 'actifs' && u.Actif === false) return false;
    if (f.statut === 'inactifs' && u.Actif !== false) return false;
    if (f.statut === 'anomalies' && estCourriel(u.Courriel) && !estDoublon(u)) return false;
    if (f.role && (u.Role || '') !== (f.role === '(aucun)' ? '' : f.role)) return false;
    if (t && !cle([u.Courriel, u.Nom, u.Role, nomEntite(u.Entite)].join(' ')).includes(t)) return false;
    return true;
  }).sort((a, b) => cle(a.Courriel).localeCompare(cle(b.Courriel)));
}
// estDoublon : un autre utilisateur a le même courriel ; nomEntite : nom d'une entité d'après son identifiant ;
// options : construit les <option> d'une liste déroulante à partir de paires [valeur, libellé].
const estDoublon = (u) => (etat.d.Gouv_Utilisateurs || []).filter((x) => cle(x.Courriel) && cle(x.Courriel) === cle(u.Courriel)).length > 1;
const nomEntite = (id) => (etat.d.Gouv_Entites || []).find((e) => e.id === id)?.Nom || '';
/**
 * Contenu de l'onglet « Utilisateurs » : filtres, actions groupées sur les personnes cochées,
 * tableau modifiable en direct (chaque changement est enregistré aussitôt, voir enregistrerChamp),
 * ajout en masse et liste des rôles.
 * @returns {string} HTML de l'onglet
 */
function ongletUtilisateurs() {
  if (!aTable('Gouv_Utilisateurs')) return `<div class="encadre alerte">La table Utilisateurs n'existe pas. <button class="bouton petit" data-onglet-aller="structure">Installer →</button></div>`;
  const f = etat.filtres;
  const U = utilisateursFiltres();
  const ent = (etat.d.Gouv_Entites || []).map((e) => [e.id, e.Nom]);
  const rl = roles().map((r) => [r, r]);
  const sel = [...etat.selection].filter((id) => U.some((u) => u.id === id));
  return `
    <section class="carte">
      <div class="barre-outils">
        <input class="champ" id="u-recherche" placeholder="🔍 Rechercher (courriel, nom, entité…)" value="${esc(f.texte)}" style="min-width:280px">
        <select class="champ" id="u-role">${options([...rl, ['(aucun)', 'Sans rôle']], f.role, 'Tous les rôles')}</select>
        <select class="champ" id="u-statut">${options([['actifs', 'Actifs'], ['inactifs', 'Inactifs'], ['anomalies', '⚠️ Anomalies']], f.statut, 'Tous')}</select>
        <span class="espace"></span>
        <button class="bouton petit" data-action="export-csv">⬇️ Export CSV</button>
      </div>
      <div class="barre-outils" ${sel.length ? '' : 'style="opacity:.55"'}>
        <b>${sel.length} sélectionné(s)</b>
        <select class="champ" id="g-role" ${sel.length ? '' : 'disabled'}>${options(rl, '', 'Changer le rôle…')}</select>
        <button class="bouton petit" data-action="g-activer" ${sel.length ? '' : 'disabled'}>Activer</button>
        <button class="bouton petit" data-action="g-desactiver" ${sel.length ? '' : 'disabled'}>Désactiver</button>
      </div>
      <div class="defile"><table class="tableau">
        <tr><th><input type="checkbox" id="u-tous" ${sel.length && sel.length === U.length ? 'checked' : ''}></th><th>Courriel</th><th>Nom</th><th>Rôle</th><th>Entité</th><th>Actif</th></tr>
        ${U.map((u) => `<tr>
          <td><input type="checkbox" data-sel="${u.id}" ${etat.selection.has(u.id) ? 'checked' : ''}></td>
          <td>${esc(u.Courriel)} ${!estCourriel(u.Courriel) ? '<span class="badge rouge">format</span>' : ''} ${estDoublon(u) ? '<span class="badge orange">doublon</span>' : ''}</td>
          <td><input class="champ" data-u="${u.id}" data-col="Nom" value="${esc(u.Nom)}"></td>
          <td><select class="champ" data-u="${u.id}" data-col="Role">${options(rl, u.Role)}</select></td>
          <td><select class="champ" data-u="${u.id}" data-col="Entite" data-type="ref">${options(ent, u.Entite)}</select></td>
          <td><input type="checkbox" data-u="${u.id}" data-col="Actif" ${u.Actif !== false ? 'checked' : ''}></td>
        </tr>`).join('') || '<tr><td colspan="7" class="vide">Personne ne correspond aux filtres.</td></tr>'}
      </table></div>
    </section>
    <div class="grille-2">
      <section class="carte"><h2>➕ Ajouter des personnes</h2>
        <p class="aide">Un courriel par ligne (copié depuis un tableur ou une messagerie). Les doublons et les adresses mal formées sont ignorés.</p>
        <textarea class="champ" id="ajout-liste" rows="5" style="width:100%" placeholder="prenom.nom@outre-mer.gouv.fr"></textarea>
        <div class="barre-outils" style="margin-top:10px">
          <select class="champ" id="ajout-role">${options(rl, roles().includes('Lecteur') ? 'Lecteur' : '', 'Rôle…')}</select>
          <select class="champ" id="ajout-entite">${options(ent, '', 'Entité…')}</select>
          <button class="bouton primaire" data-action="ajouter">Ajouter</button>
        </div>
      </section>
      <section class="carte"><h2>🎭 Rôles</h2>
        <p class="aide">Les rôles servent à l'onglet Droits. Renommer un rôle ne met pas à jour les personnes qui l'ont déjà.</p>
        <p>${roles().map((r) => `<span class="badge bleu" style="margin:0 6px 6px 0">${esc(r)} · ${(etat.d.Gouv_Utilisateurs || []).filter((u) => u.Role === r).length}</span>`).join('')}</p>
        <div class="barre-outils"><input class="champ" id="nouveau-role" placeholder="Nouveau rôle"><button class="bouton petit" data-action="ajouter-role">Ajouter le rôle</button></div>
      </section>
    </div>
    ${cartePartage()}`;
}

/**
 * Carte « Partage du document Grist » : compare la table Utilisateurs (qui a quel rôle) au partage
 * du document dans Grist (qui peut l'ouvrir, et avec quel accès). Les deux doivent concorder :
 * Grist plafonne les droits (une personne partagée en lecture ne modifie rien, quel que soit son rôle),
 * et une personne partagée mais non inscrite ne voit que l'accueil.
 * @returns {string} HTML de la carte
 */
function cartePartage() {
  const entete = '<section class="carte"><h2>🔗 Partage du document Grist</h2>';
  if (!etat.partage) { chargerPartage().then(afficher); return entete + '<p class="vide">Lecture du partage…</p></section>'; }
  if (etat.partage.enCours) return entete + '<p class="vide">Lecture du partage…</p></section>';
  if (etat.partage.erreur) return entete + `<div class="encadre alerte">Partage illisible : seuls les <b>propriétaires</b> du document le voient. (${esc(etat.partage.erreur)})</div></section>`;
  const P = etat.partage;
  const actifs = (etat.d.Gouv_Utilisateurs || []).filter((u) => u.Actif !== false && estCourriel(u.Courriel));
  const inscrits = new Set(actifs.map((u) => cle(u.Courriel)));
  const ordre = (a) => ACCES_GRIST.indexOf(a);
  const libelle = (a) => (a ? LIBELLE_ACCES[a] : 'aucun');
  // 1. Inscrits dont l'accès Grist ne suffit pas à leur rôle
  const aPartager = actifs.filter((u) => u.Role && ordre(accesGrist(u.Courriel)) < ordre(accesNecessaire(u.Role)));
  // 2. Personnes qui ont accès au document sans être inscrites (ou inactives) : elles ne voient que l'accueil
  const personnes = [...P.personnes.values()];
  const nonInscrits = personnes.filter((p) => !p.service && p.acces && p.acces !== 'owners' && !inscrits.has(cle(p.courriel)));
  const proprietaires = personnes.filter((p) => p.acces === 'owners');
  const services = personnes.filter((p) => p.service).length;
  const ligne = (courriel, gauche, droite) => `<tr><td>${esc(courriel)}</td><td>${gauche}</td><td>${droite}</td></tr>`;
  return entete + `
    <p class="aide">Le <b>rôle</b> (table Utilisateurs) dit ce qu'une personne peut faire ; le <b>partage</b> Grist dit si elle peut ouvrir le document.
    Grist plafonne : partagée en lecture, une personne ne modifie rien, quel que soit son rôle.</p>
    ${P.public ? `<div class="encadre">🌐 Le document est ouvert à <b>tout le monde</b> en ${esc(libelle(P.public))} (lien public) : une personne non inscrite n'y voit que l'accueil, grâce aux règles d'accès.</div>` : ''}
    <h3>⚠️ Accès Grist insuffisant pour leur rôle (${aPartager.length})</h3>
    ${aPartager.length ? `<div class="defile"><table class="tableau"><tr><th>Courriel</th><th>Rôle</th><th>Accès Grist → nécessaire</th></tr>
      ${aPartager.map((u) => ligne(u.Courriel, esc(u.Role), `${esc(libelle(accesGrist(u.Courriel)))} → <b>${esc(libelle(accesNecessaire(u.Role)))}</b>`)).join('')}</table></div>
      <div class="barre-outils" style="margin-top:10px"><button class="bouton primaire" data-action="partager">Partager le document avec ces ${aPartager.length} personne(s)</button>
      <span class="aide" style="margin:0">Grist leur enverra une invitation par courriel.</span></div>`
      : '<p class="vide">✅ Chaque personne inscrite a l\'accès Grist que demande son rôle.</p>'}
    <h3>👤 Ont accès au document sans être inscrits ou actifs (${nonInscrits.length})</h3>
    ${nonInscrits.length ? `<p class="aide">Elles ne voient que la page d'accueil. Inscrivez celles qui doivent travailler dans l'application.</p>
      <div class="defile"><table class="tableau"><tr><th>Courriel</th><th>Accès Grist</th><th>Dans Utilisateurs</th></tr>
      ${nonInscrits.map((p) => { const u = (etat.d.Gouv_Utilisateurs || []).find((x) => cle(x.Courriel) === cle(p.courriel));
        return ligne(p.courriel, esc(libelle(p.acces)), u ? '<span class="badge orange">inactif</span>' : '<span class="badge">absent</span>'); }).join('')}</table></div>
      <div class="barre-outils" style="margin-top:10px"><button class="bouton" data-action="preparer-ajout">Préparer leur inscription ↑</button></div>`
      : '<p class="vide">✅ Toute personne qui a accès au document est inscrite.</p>'}
    <h3>👑 Propriétaires (${proprietaires.length})</h3>
    <p class="aide">Ils voient et modifient tout, quelles que soient les règles d'accès.${services ? ` ${services} compte(s) de service ignoré(s).` : ''}</p>
    <p>${proprietaires.map((p) => `<span class="badge bleu" style="margin:0 6px 6px 0">${esc(p.courriel)}</span>`).join('')}</p>
  </section>`;
}

/**
 * Partage le document dans Grist avec les personnes inscrites dont l'accès ne suffit pas à leur rôle
 * (lecture pour un Lecteur, modification pour les autres). Grist envoie une invitation à chacune.
 * Effet : partage du document modifié (API /access), tracé au journal. Rien n'est retiré.
 * @param {HTMLElement} bouton
 */
async function partagerAvec(bouton) {
  const ordre = (a) => ACCES_GRIST.indexOf(a);
  const cibles = (etat.d.Gouv_Utilisateurs || []).filter((u) => u.Actif !== false && estCourriel(u.Courriel) && u.Role
    && ordre(accesGrist(u.Courriel)) < ordre(accesNecessaire(u.Role)));
  if (!cibles.length) return;
  const liste = cibles.map((u) => u.Courriel + ' (' + LIBELLE_ACCES[accesNecessaire(u.Role)] + ')').join(', ');
  if (!await demander(`Partager le document avec ${cibles.length} personne(s) : ${liste} ? Grist leur enverra une invitation par courriel.`, { ok: 'Partager' })) return;
  await occupe(bouton, async () => {
    const users = Object.fromEntries(cibles.map((u) => [u.Courriel.trim().toLowerCase(), accesNecessaire(u.Role)]));
    await Outils.api('/access', { method: 'PATCH', body: JSON.stringify({ delta: { users } }) });
    await tracer('Document partagé', liste);
    message('✅ Document partagé avec ' + cibles.length + ' personne(s).');
    etat.partage = null;
    afficher();
  });
}

/** Recopie les courriels des personnes non inscrites dans « Ajouter des personnes », prêts à être ajoutés. */
function preparerAjout() {
  const inscrits = new Set((etat.d.Gouv_Utilisateurs || []).map((u) => cle(u.Courriel)));
  const absents = [...etat.partage.personnes.values()].filter((p) => !p.service && p.acces && p.acces !== 'owners' && !inscrits.has(cle(p.courriel)));
  $('ajout-liste').value = absents.map((p) => p.courriel).join('\n');
  $('ajout-liste').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('ajout-liste').focus();
  message(absents.length ? absents.length + ' courriel(s) prêts : choisissez le rôle et l\'entité, puis « Ajouter ». (Les inactifs se réactivent dans le tableau.)' : 'Aucune personne absente de la table.');
}

/**
 * Ajoute en une fois les courriels collés dans « Ajouter des personnes ». Accepte les séparateurs
 * retour à la ligne, « ; » et « , », ainsi que le format de messagerie « Nom <adresse> ».
 * Les adresses mal formées ou déjà présentes sont ignorées et signalées.
 * Effet sur le document : nouvelles lignes actives dans Utilisateurs (rôle et entité choisis), tracées au journal.
 * @param {HTMLElement} bouton  bouton « Ajouter »
 */
async function ajouterPersonnes(bouton) {
  const lignes = $('ajout-liste').value.split(/[\n;,]+/).map((s) => s.trim()).filter(Boolean);
  const existants = new Set((etat.d.Gouv_Utilisateurs || []).map((u) => cle(u.Courriel)));
  const ok = [], ignores = [];
  for (const l of lignes) {
    const mail = (l.match(/[^\s<>]+@[^\s<>]+/) || [l])[0];
    if (!estCourriel(mail) || existants.has(cle(mail))) { ignores.push(mail); continue; }
    existants.add(cle(mail)); ok.push(mail);
  }
  if (!ok.length) return message('Aucune nouvelle adresse valide.' + (ignores.length ? ' Ignorées : ' + esc(ignores.join(', ')) : ''), true);
  const role = $('ajout-role').value, entite = Number($('ajout-entite').value) || null;
  await occupe(bouton, async () => {
    await agir([['BulkAddRecord', 'Gouv_Utilisateurs', ok.map(() => null), { Courriel: ok, Role: ok.map(() => role), Entite: ok.map(() => entite), Actif: ok.map(() => true) }]]);
    await tracer('Ajout d\'utilisateurs', ok.length + ' personne(s) : ' + ok.join(', '));
    message('✅ ' + ok.length + ' personne(s) ajoutée(s).' + (ignores.length ? ' ' + ignores.length + ' ignorée(s).' : ''));
    $('ajout-liste').value = '';
    await actualiser();
  });
}

/**
 * Exporte la liste affichée (filtres appliqués) en CSV, séparateur « ; », avec une marque
 * invisible (BOM) en tête pour qu'Excel affiche correctement les accents.
 */
function exporterCsv() {
  const U = utilisateursFiltres();
  const lignes = [['Courriel', 'Nom', 'Rôle', 'Entité', 'Actif']].concat(U.map((u) => [u.Courriel, u.Nom, u.Role, nomEntite(u.Entite), u.Actif !== false ? 'oui' : 'non']));
  const csv = lignes.map((l) => l.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
  telecharger('utilisateurs.csv', '﻿' + csv, 'text/csv');
}

// Vue du module dans la console
VUES.utilisateurs = ongletUtilisateurs;
declarerVue('utilisateurs', 'utilisateurs');
