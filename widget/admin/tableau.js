/*
 * 🏠 Tableau de bord — module de la console d'administration (moteur : admin/gestion.js).
 * Reprise de l'onglet correspondant de l'ancien panneau administration.html.
 */
// --- 5. Onglet « Tableau de bord » ---------------------------------------------------------------

/**
 * Contrôles de santé du tableau de bord : administrateurs, courriels, rôles, règles d'accès,
 * sujets du socle installés ; renvoie vers la Santé du document pour le contrôle complet de la norme.
 * @returns {{ok: boolean, texte: string, onglet?: string, voir?: boolean}[]}  un point par contrôle ;
 *          « onglet » indique où aller pour corriger (bouton « Corriger → ») ; « voir » : simple renvoi (« Ouvrir → »)
 */
function controles() {
  const U = etat.d.Gouv_Utilisateurs || [];
  const out = [];
  if (!aTable('Gouv_Utilisateurs')) return [{ ok: false, texte: "Pas de table <b>Utilisateurs</b> : installez le sujet dans l'onglet Structure.", onglet: 'structure' }];
  const actifs = U.filter((u) => u.Actif !== false);
  const admins = actifs.filter((u) => u.Role === 'Administrateur');
  out.push(admins.length ? { ok: true, texte: admins.length + ' administrateur(s) actif(s).' }
    : { ok: false, texte: 'Aucun administrateur actif.', onglet: 'utilisateurs' });
  const invalides = U.filter((u) => u.Courriel && !estCourriel(u.Courriel));
  if (invalides.length) out.push({ ok: false, texte: invalides.length + ' courriel(s) mal formé(s).', onglet: 'utilisateurs' });
  const vus = {}; let doublons = 0;
  U.forEach((u) => { const k = cle(u.Courriel); if (k) { if (vus[k]) doublons++; vus[k] = 1; } });
  if (doublons) out.push({ ok: false, texte: doublons + ' courriel(s) en double.', onglet: 'utilisateurs' });
  const sansRole = actifs.filter((u) => !u.Role);
  if (sansRole.length) out.push({ ok: false, texte: sansRole.length + ' personne(s) active(s) sans rôle.', onglet: 'utilisateurs' });

  // Règles d'accès : Grist ne les montre qu'aux propriétaires du document.
  if (!etat.acl.regles) out.push({ ok: false, texte: "Règles d'accès illisibles : seuls les <b>propriétaires</b> du document peuvent les gérer." });
  else {
    // Une table est « protégée par rôle » si une règle la concerne et lit le profil de la personne :
    // règles posées par l'onglet Droits, mais aussi règles métier propres à l'application (rôles métier, P5).
    const parProfil = etat.acl.regles.filter((r) => /user\.Profil\b/.test(r.aclFormula || '')).map((r) => ressource(r.resource)?.tableId);
    const protegees = new Set([...reglesDuPanneau().map((r) => ressource(r.resource)?.tableId), ...parProfil].filter((t) => t && t !== '*'));
    // Une règle par défaut qui lit le profil (ex. « Administrateur : tout ; les autres : lecture ») couvre toutes les tables.
    const defautParRole = parProfil.includes('*') && etat.acl.regles.some((r) => ressource(r.resource)?.tableId === '*' && /user\.Profil\.Role\b/.test(r.aclFormula || ''));
    const nonProtegees = defautParRole ? [] : etat.meta.tables.filter((t) => !protegees.has(t.tableId));
    out.push(protegees.size ? { ok: nonProtegees.length === 0, texte: protegees.size + ' table(s) protégée(s) par rôle' + (nonProtegees.length ? ', ' + nonProtegees.length + ' sans règle' : '') + '.', onglet: 'droits' }
      : { ok: false, texte: "Aucun droit par rôle : toute personne qui a accès au document voit tout.", onglet: 'droits' });
    // La « garde » est la règle qui bloque les personnes absentes de Utilisateurs (voir poserGarde).
    const garde = etat.acl.regles.some((r) => /not user\.Profil/.test(r.aclFormula || ''));
    out.push(garde ? { ok: true, texte: 'Les personnes non inscrites ne voient que la page d\'accueil.' }
      : { ok: false, texte: "Les personnes non inscrites dans Utilisateurs ne sont pas bloquées.", onglet: 'droits' });
  }
  // Sujets du socle : contrôlés seulement une fois le dépôt lu (etat.sujets), sinon ce point est sauté.
  for (const s of SUJETS.filter((x) => x.obligatoire)) {
    if (etat.sujets && etat.sujets[s.fichier] && etat.sujets[s.fichier].etat !== 'present') {
      out.push({ ok: false, texte: 'Sujet transverse incomplet : <b>' + esc(s.nom) + '</b>.', onglet: 'structure' });
    }
  }
  // Conformité complète à la norme (traçabilité, nommage, widgets…) : contrôlée par la Santé du document
  out.push({ ok: true, texte: 'Conformité à la norme et qualité du document : <b>🩺 Santé du document</b>.', onglet: 'sante', voir: true });
  return out;
}

/**
 * Contenu de l'onglet « Tableau de bord » : tuiles de chiffres clés, santé du document
 * et les 8 dernières actions du journal.
 * @returns {string} HTML de l'onglet
 */
function ongletAccueil() {
  const U = etat.d.Gouv_Utilisateurs || [];
  const actifs = U.filter((u) => u.Actif !== false).length;
  const ouverts = (etat.d.Gouv_Support || []).filter(ticketOuvert).length;
  const c = controles();
  const ko = c.filter((x) => !x.ok).length;
  const journal = (etat.d.Gouv_Journal || []).slice().sort((a, b) => (b.Date || 0) - (a.Date || 0)).slice(0, 8);
  return `
    <div class="tuiles">
      <div class="tuile"><div class="valeur">${actifs}</div><div class="libelle">utilisateurs actifs sur ${U.length}</div></div>
      <div class="tuile"><div class="valeur">${roles().length}</div><div class="libelle">rôles</div></div>
      ${aTable('Gouv_Support') ? `<div class="tuile ${ouverts ? 'orange' : 'vert'}"><div class="valeur">${ouverts}</div><div class="libelle">demandes de support ouvertes</div></div>` : ''}
      <div class="tuile"><div class="valeur">${etat.meta.tables.length}</div><div class="libelle">tables dans le document</div></div>
      <div class="tuile ${ko ? 'rouge' : 'vert'}"><div class="valeur">${ko ? ko : '✓'}</div><div class="libelle">${ko ? 'point(s) à corriger' : 'document en bonne santé'}</div></div>
    </div>
    <div class="grille-2">
      <section class="carte sante"><h2>🔎 Points de vigilance</h2>
        <ul>${c.map((x) => `<li><span>${x.voir ? '🩺' : x.ok ? '✅' : '⚠️'}</span><span>${x.texte}</span>${(!x.ok || x.voir) && x.onglet ? `<button class="bouton petit" data-onglet-aller="${x.onglet}">${x.voir ? 'Ouvrir →' : 'Corriger →'}</button>` : ''}</li>`).join('')}</ul>
      </section>
      <section class="carte"><h2>📒 Dernières actions</h2>
        ${journal.length ? `<table class="tableau"><tr><th>Date</th><th>Qui</th><th>Action</th></tr>${journal.map((j) => `<tr><td>${dateFr(j.Date)}</td><td>${esc(j.Auteur)}</td><td><b>${esc(j.Action)}</b><br><small>${esc(j.Detail)}</small></td></tr>`).join('')}</table>` : '<p class="vide">Aucune action tracée pour l\'instant.</p>'}
      </section>
    </div>`;
}

// Vue du module dans la console
VUES.accueil = ongletAccueil;
declarerVue('tableau', 'accueil');
