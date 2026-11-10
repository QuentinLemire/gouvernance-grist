/*
 * =====================================================================
 *  Outils communs des widgets « Gouvernance Grist »
 * =====================================================================
 *  À charger après grist-plugin-api.js. Fournit :
 *    - Outils.lire(table)        lit une table Grist en lignes (null si interdite)
 *    - Outils.parametres()       { Cle: Valeur } depuis la table Parametres
 *    - Outils.entete(params)     remplit l'en-tête (logo DGOM, nom de l'application)
 *    - Outils.markdown(texte)    HTML sûr à partir de Markdown (marked + DOMPurify)
 *    - Outils.esc(texte)         échappe le HTML
 *    - Outils.conversation(...)  fil d'échanges d'une demande de support (bulles)
 *    - Outils.ticketOuvert(t)    vrai si la demande n'est ni close ni archivée
 */
window.Outils = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Grist renvoie les tables en colonnes ; on les remet en lignes { id, Col1, Col2… }. */
  function enLignes(table) {
    return (table.id || []).map((id, i) => Object.fromEntries(Object.keys(table).map((k) => [k, table[k][i]])));
  }

  /** Lit une table ; null si elle n'existe pas ou si les règles d'accès l'interdisent. */
  async function lire(tableId) {
    try { return enLignes(await grist.docApi.fetchTable(tableId)); } catch (e) { return null; }
  }

  async function parametres() {
    return Object.fromEntries(((await lire('Parametres')) || []).map((r) => [r.Cle, r.Valeur]));
  }

  /** Logo DGOM (Parametres.Logo_DGOM) et titre ; laisse les valeurs par défaut si les paramètres sont illisibles. */
  function entete(p, titre) {
    const logo = document.getElementById('logo-dgom');
    if (logo && p.Logo_DGOM) logo.innerHTML = '<img alt="DGOM" src="' + esc(p.Logo_DGOM) + '">';
    const h1 = document.getElementById('titre-appli');
    if (h1) h1.textContent = titre || p.Nom_application || h1.textContent;
  }

  /** Markdown → HTML nettoyé (aucun script ne peut passer). Liens ouverts dans un nouvel onglet. */
  function markdown(texte) {
    const html = window.marked ? marked.parse(String(texte || ''), { breaks: true }) : esc(texte).replace(/\n/g, '<br>');
    const propre = window.DOMPurify ? DOMPurify.sanitize(html) : html;
    return propre.replace(/<a /g, '<a target="_blank" rel="noopener" ');
  }

  const dateHeure = (t) => (t ? new Date(t * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '');
  const texte = (s) => esc(s).replace(/\n/g, '<br>');

  /** Une demande est ouverte tant qu'elle n'est ni résolue, ni fermée, ni archivée. */
  const ticketOuvert = (t) => !t.Archive && !['Résolu', 'Fermé'].includes(t.Statut);

  /**
   * Fil d'échanges d'une demande : la description d'origine, puis chaque commentaire.
   *   ticket       ligne de Support
   *   commentaires lignes de Support_commentaires de cette demande
   *   droite       'support' (vue administrateur) ou 'demandeur' (vue utilisateur) : qui parle à droite
   * Un commentaire de Type « Événement » (clôture, réouverture…) s'affiche au centre.
   */
  function conversation(ticket, commentaires, droite) {
    const demandeur = String(ticket.Demandeur || ticket.CreePar || '').toLowerCase();
    const bulle = (auteur, date, contenu) => {
      const estDemandeur = String(auteur || '').toLowerCase() === demandeur;
      const cote = (estDemandeur ? 'demandeur' : 'support') === droite ? 'droite' : 'gauche';
      return `<div class="bulle ${cote} ${estDemandeur ? '' : 'equipe'}"><small>${esc(estDemandeur ? (droite === 'demandeur' ? 'Vous' : auteur) : (auteur || 'Support') + ' · support')} · ${dateHeure(date)}</small><div>${texte(contenu)}</div></div>`;
    };
    const fil = [bulle(ticket.Demandeur || ticket.CreePar, ticket.CreeLe, ticket.Description || ticket.Titre)];
    commentaires.slice().sort((a, b) => (a.CreeLe || 0) - (b.CreeLe || 0)).forEach((c) => {
      fil.push(c.Type === 'Événement'
        ? `<div class="evenement">${esc(c.Message)} · ${esc(c.CreePar || '')} · ${dateHeure(c.CreeLe)}</div>`
        : bulle(c.CreePar, c.CreeLe, c.Message));
    });
    return `<div class="conversation">${fil.join('')}</div>`;
  }

  return { esc, lire, parametres, entete, markdown, conversation, ticketOuvert, dateHeure };
})();
