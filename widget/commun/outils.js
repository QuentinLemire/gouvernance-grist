/*
 * =====================================================================
 *  Outils communs des widgets « Gouvernance Grist »
 * =====================================================================
 *
 *  À quoi ça sert
 *  --------------
 *  Regroupe les petites fonctions utilisées par TOUS les widgets
 *  (accueil, documentation, support, administration) : lire une table,
 *  lire les paramètres, remplir l'en-tête aux couleurs de la DGOM,
 *  afficher du Markdown sans risque, dessiner le fil d'une demande de
 *  support. Les écrire une seule fois ici évite que chaque page ait
 *  sa propre version, légèrement différente.
 *
 *  Comment l'utiliser
 *  ------------------
 *  Dans la page HTML du widget, charger ce fichier APRÈS grist-plugin-api.js
 *  (et, si l'on affiche du Markdown, après marked et DOMPurify) :
 *      <script src="https://docs.getgrist.com/grist-plugin-api.js"></script>
 *      <script src="commun/outils.js"></script>
 *  Toutes les fonctions sont ensuite rangées dans l'objet global « Outils ».
 *
 *  Exemple d'appel
 *  ---------------
 *      const p = await Outils.parametres();          // { Nom_application: '…', Logo_DGOM: '…' }
 *      Outils.entete(p);                             // logo + titre dans l'en-tête
 *      const demandes = await Outils.lire('Gouv_Support'); // null si la personne n'y a pas droit
 *
 *  Ce que contient l'objet Outils
 *  ------------------------------
 *    - Outils.lire(table)        lit une table Grist en lignes (null si interdite)
 *    - Outils.parametres()       { Cle: Valeur } depuis la table Parametres
 *    - Outils.entete(params)     remplit l'en-tête (logo DGOM, nom de l'application)
 *    - Outils.markdown(texte)    HTML sûr à partir de Markdown (marked + DOMPurify)
 *    - Outils.esc(texte)         échappe le HTML
 *    - Outils.conversation(...)  fil d'échanges d'une demande de support (bulles)
 *    - Outils.ticketOuvert(t)    vrai si la demande n'est pas close
 *    - Outils.dateHeure(t)       date et heure « jj/mm/aaaa hh:mm » à partir d'une date Grist
 *
 *  Aucune de ces fonctions n'écrit dans le document : elles ne font que lire
 *  et mettre en forme. Les écritures restent dans chaque widget.
 */
// Tout est enfermé dans une fonction exécutée immédiatement : les fonctions
// internes ne « débordent » pas dans la page, seul l'objet Outils est exposé.
window.Outils = (() => {
  // ===== 1. Sécurité de l'affichage =====

  /**
   * Échappe un texte avant de l'insérer dans du HTML.
   * Indispensable pour tout ce qui vient du document (titres, messages,
   * courriels…) : sans cela, un texte contenant « <script> » serait exécuté
   * par le navigateur au lieu d'être affiché.
   * @param {*} s  texte à protéger (null ou undefined donnent une chaîne vide)
   * @returns {string} le texte où & < > " ' sont remplacés par leur équivalent HTML
   */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ===== 2. Lecture des données Grist =====

  /**
   * Remet une table Grist « en lignes ».
   * Grist renvoie une table colonne par colonne : { id: [1, 2], Nom: ['A', 'B'] }.
   * Pour travailler ligne par ligne, on la transforme en
   * [ { id: 1, Nom: 'A' }, { id: 2, Nom: 'B' } ].
   * @param {Object} table  table au format « colonnes » renvoyée par Grist
   * @returns {Object[]} une liste d'objets, un par ligne
   */
  function enLignes(table) {
    return (table.id || []).map((id, i) => Object.fromEntries(Object.keys(table).map((k) => [k, table[k][i]])));
  }

  /**
   * Lit toute une table du document.
   * Renvoie null (au lieu de faire planter la page) si la table n'existe pas
   * encore dans cette application ou si les règles d'accès interdisent à la
   * personne connectée de la voir : le widget peut alors afficher un message
   * ou masquer la partie concernée.
   * @param {string} tableId  identifiant de la table, ex. 'Gouv_Support'
   * @returns {Promise<Object[]|null>} les lignes, ou null si illisible
   * Action Grist : lecture seule (docApi.fetchTable), rien n'est modifié.
   */
  async function lire(tableId) {
    try { return enLignes(await grist.docApi.fetchTable(tableId)); } catch (e) { return null; }
  }

  /**
   * Lit la table Parametres (une ligne par réglage : colonnes Cle et Valeur)
   * et la transforme en un simple dictionnaire.
   * Exemple : { Nom_application: 'Mon appli', Logo_DGOM: 'https://…' }.
   * Si la table est absente ou illisible, renvoie {} : les widgets gardent
   * alors leurs textes par défaut.
   * @returns {Promise<Object>} les paramètres sous la forme { Cle: Valeur }
   */
  async function parametres() {
    return Object.fromEntries(((await lire('Gouv_Parametres')) || []).map((r) => [r.Cle, r.Valeur]));
  }

  // ===== 3. En-tête de page =====

  /**
   * Remplit l'en-tête commun : logo DGOM et titre de l'application.
   * Le logo est l'adresse d'une image publique saisie dans Parametres, clé
   * Logo_DGOM ; le titre est, par ordre de priorité, celui passé en paramètre,
   * puis Parametres.Nom_application, sinon le texte déjà présent dans la page.
   * Si les paramètres sont illisibles, la page garde ses valeurs par défaut.
   * La page doit contenir les éléments id="logo-dgom" et id="titre-appli".
   * @param {Object} p       paramètres lus par Outils.parametres()
   * @param {string} [titre] titre à imposer (facultatif)
   */
  function entete(p, titre) {
    const logo = document.getElementById('logo-dgom');
    if (logo && p.Logo_DGOM) logo.innerHTML = '<img alt="DGOM" src="' + esc(p.Logo_DGOM) + '">';
    const h1 = document.getElementById('titre-appli');
    if (h1) h1.textContent = titre || p.Nom_application || h1.textContent;
  }

  // ===== 4. Mise en forme des textes =====

  /**
   * Transforme un texte Markdown (pages de Documentation, message d'accueil…)
   * en HTML prêt à afficher.
   * Le HTML produit est nettoyé par DOMPurify : aucun script ni code piégé
   * saisi dans le document ne peut s'exécuter. Les liens s'ouvrent dans un
   * nouvel onglet pour ne pas quitter Grist.
   * Si les bibliothèques marked ou DOMPurify ne sont pas chargées, le texte
   * est simplement échappé et les retours à la ligne conservés.
   * @param {string} texte  contenu Markdown
   * @returns {string} HTML sûr
   */
  function markdown(texte) {
    const html = window.marked ? marked.parse(String(texte || ''), { breaks: true }) : esc(texte).replace(/\n/g, '<br>');
    const propre = window.DOMPurify ? DOMPurify.sanitize(html) : html;
    return propre.replace(/<a /g, '<a target="_blank" rel="noopener" ');
  }

  /**
   * Date Grist → texte lisible en français (« 23/11/2026 14:05 »).
   * Grist stocke les dates en secondes depuis 1970, JavaScript en millisecondes,
   * d'où la multiplication par 1000. Renvoie '' si la date est vide.
   * @param {number} t  date Grist (secondes)
   * @returns {string}
   */
  const dateHeure = (t) => (t ? new Date(t * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '');
  /**
   * Texte brut → HTML : échappe le texte puis garde les retours à la ligne.
   * @param {string} s
   * @returns {string}
   */
  const texte = (s) => esc(s).replace(/\n/g, '<br>');

  // ===== 5. Support : demandes et conversation =====

  /**
   * Indique si une demande de support est encore ouverte, c'est-à-dire si son
   * Statut n'est ni « Résolu » ni « Fermé » (valeurs définies dans
   * structure/support.json). Sert aux compteurs et aux filtres des widgets.
   * @param {Object} t  ligne de la table Support
   * @returns {boolean} vrai si la demande reste à traiter
   */
  const ticketOuvert = (t) => !['Résolu', 'Fermé'].includes(t.Statut);

  /**
   * Construit le fil d'échanges d'une demande, présenté comme une messagerie :
   * d'abord la description d'origine, puis chaque commentaire par date croissante.
   *
   * Qui parle de quel côté ? On compare l'auteur de chaque message au demandeur
   * (courriel, sans tenir compte des majuscules). La personne qui regarde voit
   * ses propres messages à droite, comme dans une messagerie habituelle :
   *   - dans le widget Support (vue utilisateur), droite = 'demandeur' ;
   *   - dans le widget Administration (vue support), droite = 'support'.
   * Les messages de l'équipe support sont en plus colorés (classe « equipe »).
   * Un commentaire de Type « Événement » (clôture, réouverture…) n'est pas une
   * bulle : il s'affiche au centre, comme une mention discrète.
   *
   * @param {Object}   ticket       ligne de la table Support
   * @param {Object[]} commentaires lignes de Support_commentaires de cette demande
   * @param {string}   droite       'support' ou 'demandeur' : qui s'affiche à droite
   * @returns {string} HTML du fil (styles .conversation, .bulle, .evenement de dsfr-grist.css)
   * Action Grist : aucune, la fonction ne fait que mettre en forme.
   */
  function conversation(ticket, commentaires, droite) {
    const demandeur = String(ticket.Demandeur || ticket.CreePar || '').toLowerCase();
    // Fabrique une bulle de message ; le libellé indique « Vous » pour ses propres
    // messages côté demandeur, et « … · support » pour les réponses de l'équipe.
    const bulle = (auteur, date, contenu) => {
      const estDemandeur = String(auteur || '').toLowerCase() === demandeur;
      const cote = (estDemandeur ? 'demandeur' : 'support') === droite ? 'droite' : 'gauche';
      return `<div class="bulle ${cote} ${estDemandeur ? '' : 'equipe'}"><small>${esc(estDemandeur ? (droite === 'demandeur' ? 'Vous' : auteur) : (auteur || 'Gouv_Support') + ' · support')} · ${dateHeure(date)}</small><div>${texte(contenu)}</div></div>`;
    };
    // Le premier message du fil est la demande elle-même (sa description, à défaut son titre).
    const fil = [bulle(ticket.Demandeur || ticket.CreePar, ticket.CreeLe, ticket.Description || ticket.Titre)];
    // slice() copie la liste avant le tri : on ne modifie pas les données reçues.
    commentaires.slice().sort((a, b) => (a.CreeLe || 0) - (b.CreeLe || 0)).forEach((c) => {
      fil.push(c.Type === 'Événement'
        ? `<div class="evenement">${esc(c.Message)} · ${esc(c.CreePar || '')} · ${dateHeure(c.CreeLe)}</div>`
        : bulle(c.CreePar, c.CreeLe, c.Message));
    });
    return `<div class="conversation">${fil.join('')}</div>`;
  }

  // ===== 6. Ce que le fichier rend disponible =====
  // Seules ces fonctions sont accessibles depuis les widgets (Outils.xxx).

  return { esc, lire, parametres, entete, markdown, conversation, ticketOuvert, dateHeure };
})();
