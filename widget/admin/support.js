/*
 * 🆘 Support — module de la console d'administration (moteur : admin/gestion.js).
 * Reprise de l'onglet correspondant de l'ancien panneau administration.html.
 */
// --- 8. Onglet « Support » -----------------------------------------------------------------------

// ticketOuvert : règle commune à tous les widgets (commun/outils.js) ; couleurStatut : couleur du badge de chaque statut.
const ticketOuvert = (t) => Outils.ticketOuvert(t);
const couleurStatut = { 'Nouveau': 'bleu', 'En cours': 'orange', 'En attente': '', 'Résolu': 'vert', 'Fermé': '' };

/** Échanges d'une demande, du plus ancien au plus récent. */
const echanges = (id) => (etat.d.Gouv_Support_commentaires || []).filter((c) => c.Demande === id).sort((a, b) => (a.CreeLe || 0) - (b.CreeLe || 0));

/**
 * Indique si une demande attend une réponse du support : elle est ouverte et soit encore
 * « Nouveau », soit le dernier message vient du demandeur (les événements automatiques ne comptent pas).
 * @param {object} t  ligne de la table Support
 * @returns {boolean}
 */
function aTraiter(t) {
  if (!ticketOuvert(t)) return false;
  const m = echanges(t.id).filter((c) => c.Type !== 'Événement');
  const dernier = m.length ? m[m.length - 1].CreePar : t.Demandeur;
  return cle(dernier) === cle(t.Demandeur) || t.Statut === 'Nouveau';
}

/**
 * Contenu de l'onglet « Support » : filtre (ouvertes, closes, toutes), liste des demandes
 * (celles qui attendent une réponse en tête, puis les plus récentes) et fiche de la demande choisie.
 * @returns {string} HTML de l'onglet
 */
function ongletSupport() {
  if (!aTable('Gouv_Support')) return `<div class="encadre alerte">Pas de table Support. <button class="bouton petit" data-onglet-aller="structure">Installer →</button></div>`;
  const f = etat.filtres.support;
  const T = (etat.d.Gouv_Support || []).filter((t) => f === 'tous' || (f === 'ouverts') === ticketOuvert(t))
    .sort((a, b) => aTraiter(b) - aTraiter(a) || (b.Dernier_retour || b.CreeLe || 0) - (a.Dernier_retour || a.CreeLe || 0));
  if (!T.some((t) => t.id === etat.ticket)) etat.ticket = T[0]?.id ?? null;
  const t = T.find((x) => x.id === etat.ticket);
  return `
    <div class="barre-outils">
      ${[['ouverts', 'Ouvertes'], ['traites', 'Closes'], ['tous', 'Toutes']].map(([v, l]) => `<button class="bouton petit ${f === v ? 'primaire' : ''}" data-support="${v}">${l}</button>`).join('')}
      <span class="espace"></span><span class="aide" style="margin:0"><span class="a-traiter"></span>${T.filter(aTraiter).length} en attente d'une réponse du support · ${T.length} demande(s)</span>
    </div>
    ${T.length ? `<div class="maitre-detail">
      <nav class="liste-tickets">${T.map((x) => `<button data-ticket="${x.id}" class="${x.id === etat.ticket ? 'actif' : ''}">
        <b>${aTraiter(x) ? '<span class="a-traiter" title="En attente d\'une réponse du support"></span>' : ''}${esc(x.Titre || '(sans titre)')}</b>
        <small>${esc(x.Demandeur || '')} · ${dateFr(x.Dernier_retour || x.CreeLe)}</small><br>
        <span class="badge ${couleurStatut[x.Statut] || ''}">${esc(x.Statut || 'Nouveau')}</span>
        ${x.Priorite === 'Urgente' || x.Priorite === 'Haute' ? `<span class="badge ${x.Priorite === 'Urgente' ? 'rouge' : 'orange'}">${esc(x.Priorite)}</span>` : ''}
        ${echanges(x.id).length ? `<small>· 💬 ${echanges(x.id).filter((c) => c.Type !== 'Événement').length}</small>` : ''}
      </button>`).join('')}</nav>
      ${t ? ficheTicket(t) : ''}
    </div>` : '<p class="vide">Aucune demande dans cette vue.</p>'}`;
}

/**
 * Détail d'une demande : conversation, réponse, clôture ou réouverture, et réglages
 * (statut, priorité, assignation) enregistrés dès qu'ils changent.
 * @param {object} t  ligne de la table Support
 * @returns {string} HTML de la fiche
 */
function ficheTicket(t) {
  const ouvert = ticketOuvert(t);
  const statuts = choix('Gouv_Support', 'Statut').map((s) => [s, s]);
  const priorites = choix('Gouv_Support', 'Priorite').map((s) => [s, s]);
  const personnes = (etat.d.Gouv_Utilisateurs || []).filter((u) => u.Actif !== false).map((u) => [u.id, u.Nom || u.Courriel]);
  const avecFil = aTable('Gouv_Support_commentaires');
  return `<article class="ticket">
    <header><b>${esc(t.Titre || '(sans titre)')}</b><span class="badge ${couleurStatut[t.Statut] || ''}">${esc(t.Statut || 'Nouveau')}</span>
      ${ouvert ? `<button class="bouton petit primaire" data-action="clore" data-id="${t.id}">✅ Clore la demande</button>`
               : `<button class="bouton petit" data-action="rouvrir" data-id="${t.id}">↩️ Rouvrir</button>`}</header>
    <div class="meta">${esc(t.Demandeur || t.CreePar || '')} · ${dateFr(t.CreeLe)}${t.Categorie ? ' · ' + esc(t.Categorie) : ''}${t.Url_page ? ` · <a href="${esc(t.Url_page)}" target="_blank" rel="noopener">page concernée ↗</a>` : ''}</div>
    ${avecFil ? Outils.conversation(t, echanges(t.id), 'support') : `<div class="encadre alerte">Installez la version 1.2 du sujet Support pour converser. <button class="bouton petit" data-onglet-aller="structure">Structure →</button></div>`}
    ${avecFil ? `<div class="repondre">
      <textarea class="champ" id="rep-${t.id}" placeholder="${ouvert ? 'Votre réponse… (Ctrl+Entrée pour envoyer)' : 'Écrire rouvrira la demande…'}"></textarea>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="bouton primaire" data-action="repondre" data-id="${t.id}">Envoyer</button>
        ${ouvert ? `<button class="bouton petit" data-action="repondre-clore" data-id="${t.id}">Envoyer et clore</button>` : ''}
      </div></div>` : ''}
    <div class="reglages">
      <select class="champ" data-t="${t.id}" data-col="Statut" title="Statut">${options(statuts, t.Statut)}</select>
      <select class="champ" data-t="${t.id}" data-col="Priorite" title="Priorité">${options(priorites, t.Priorite, 'Priorité')}</select>
      <select class="champ" data-t="${t.id}" data-col="Assigne_a" data-type="ref" title="Assignée à">${options(personnes, t.Assigne_a, 'Assigner à…')}</select>
    </div>
  </article>`;
}

/**
 * Répond, clôt ou rouvre une demande. Chaque changement d'état laisse une trace
 * « Événement » dans le fil, visible aussi par le demandeur.
 * @param {HTMLElement} bouton
 * @param {number} id                   identifiant de la demande (table Support)
 * @param {object} options
 * @param {string} [options.texte]      message à ajouter au fil
 * @param {string} [options.statut]     nouveau statut (« Résolu », « En cours »…)
 * @param {string} [options.evenement]  texte de l'événement à inscrire dans le fil
 */
async function traiterTicket(bouton, id, { texte = '', statut = null, evenement = '' }) {
  await occupe(bouton, async () => {
    const t = etat.d.Gouv_Support.find((x) => x.id === id);
    const fil = aTable('Gouv_Support_commentaires'), type = colonne('Gouv_Support_commentaires', 'Type');
    const a = [];
    if (texte && fil) a.push(['AddRecord', 'Gouv_Support_commentaires', null, { Demande: id, Message: texte, ...(type ? { Type: 'Message' } : {}) }]);
    // Écrire sur une demande close la rouvre ; répondre à une demande nouvelle la passe « En cours ».
    if (!statut && texte && (!ticketOuvert(t) || t.Statut === 'Nouveau')) { statut = 'En cours'; evenement = ticketOuvert(t) ? '' : '↩️ Demande rouverte'; }
    if (statut) a.push(['UpdateRecord', 'Gouv_Support', id, { Statut: statut }]);
    if (evenement && fil && type) a.push(['AddRecord', 'Gouv_Support_commentaires', null, { Demande: id, Message: evenement, Type: 'Événement' }]);
    if (!a.length) return;
    await agir(a);
    if (statut) await tracer('Support : ' + statut, '#' + id + ' ' + (t.Titre || ''));
    await actualiser();
  });
}

// Vue du module dans la console
VUES.support = ongletSupport;
declarerVue('support', 'support');
