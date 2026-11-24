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
const options = (valeurs, choisie, vide = '—') => `<option value="">${vide}</option>` + valeurs.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(choisie) ? ' selected' : ''}>${esc(l)}</option>`).join('');

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
    </div>`;
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
