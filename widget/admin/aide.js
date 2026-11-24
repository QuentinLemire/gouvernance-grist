/*
 * ❓ Aide — module de la console d'administration (moteur : admin/gestion.js).
 * Reprise de l'onglet correspondant de l'ancien panneau administration.html.
 */
// --- 11. Onglet « Aide » : mode d'emploi du panneau (texte fixe, sans donnée) --------------------

/**
 * Contenu de l'onglet « Aide ». Pour faire évoluer le mode d'emploi, modifier directement le texte ci-dessous.
 * @returns {string} HTML de l'onglet
 */
function ongletAide() {
  const tache = (titre, etapes) => `<details class="carte" style="margin-bottom:10px"><summary style="cursor:pointer;font-weight:700">${titre}</summary><ol style="margin:10px 0 0">${etapes.map((e) => `<li>${e}</li>`).join('')}</ol></details>`;
  return `
    <section class="carte">
      <h2>❓ Comment marche ce panneau ?</h2>
      <p>Ce panneau administre l'application <b>sans toucher à Grist</b>. Il ne supprime jamais de données et chaque action est notée dans le journal.</p>
      <table class="tableau">
        <tr><th>Onglet</th><th>À quoi il sert</th></tr>
        <tr><td>🏠 Tableau de bord</td><td>Chiffres clés et <b>santé du document</b> : chaque point orange a un bouton « Corriger ».</td></tr>
        <tr><td>👥 Utilisateurs</td><td>Qui a accès : courriel, nom, rôle, entité, actif. Ajout en masse, export CSV.</td></tr>
        <tr><td>🔐 Droits</td><td>Ce que chaque rôle peut faire sur chaque table. « Proposition standard » puis « Appliquer ».</td></tr>
        <tr><td>🆘 Support</td><td>Répondre aux demandes, les clore ou les rouvrir. Point rouge = la personne attend une réponse.</td></tr>
        <tr><td>🧱 Structure</td><td>Comparer l'application à la norme DGOM, installer les tables qui manquent, créer les pages standard et ranger le menu.</td></tr>
        <tr><td>⚙️ Paramètres</td><td>Nom de l'application, contact du support, logo ; journal complet des actions.</td></tr>
      </table>
    </section>
    <section>
      <h2 style="font-size:18px">Tâches courantes</h2>
      ${tache('Donner accès à une personne', [
        'Dans Grist, bouton <b>Partager</b> : ajouter son courriel (sinon elle ne peut pas ouvrir le document).',
        'Onglet <b>Utilisateurs</b> → « Ajouter des personnes » : coller le courriel, choisir le rôle et l\'entité.',
        'Elle voit aussitôt ce que son rôle permet (onglet Droits).'])}
      ${tache('Retirer l\'accès à une personne', [
        'Onglet <b>Utilisateurs</b> : décocher <b>Actif</b>.',
        'Elle ne voit plus que la page d\'accueil ; son historique est conservé.'])}
      ${tache('Mettre en place les droits', [
        'Vérifier que chaque personne a un rôle (Administrateur, Gestionnaire, Contributeur, Lecteur).',
        'Onglet <b>Droits</b> → « ✨ Proposition standard », ajuster si besoin, puis « Appliquer ces droits ».',
        'Contrôler avec <b>Voir en tant que</b> (menu Grist → Permissions avancées).'])}
      ${tache('Traiter une demande de support', [
        'Onglet <b>Support</b> : les demandes en attente d\'une réponse remontent en tête (point rouge).',
        'Écrire la réponse puis « Envoyer », ou « Envoyer et clore » si c\'est réglé.',
        '« Rouvrir » si le problème revient ; la personne voit chaque étape dans son fil.'])}
      ${tache('Mettre l\'application à la norme DGOM', [
        'Onglet <b>Structure</b> : chaque table standard est « installée », « incomplète » ou « absente ».',
        '« Installer » ajoute seulement ce qui manque ; rien n\'est supprimé.',
        'Pour une table métier : « Ajouter la traçabilité » (colonnes Créé le / par, Modifié le / par).'])}
      ${tache('Changer le contact ou le logo', [
        'Onglet <b>Paramètres</b> : modifier <i>Contact_support</i>, <i>Nom_application</i> ou <i>Logo_DGOM</i> (adresse d\'une image).',
        'La page d\'accueil et les en-têtes se mettent à jour seuls.'])}
    </section>`;
}

// Vue du module dans la console
VUES.aide = ongletAide;
declarerVue('aide', 'aide');
