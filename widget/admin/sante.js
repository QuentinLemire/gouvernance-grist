/*
 * 🩺 Santé du document — module de la console d'administration.
 *
 * Contrôle tout le document en une fois, en lecture seule :
 *   - la norme DGOM, principe par principe (P1 à P7) ;
 *   - les formules en erreur ;
 *   - les colonnes qui ne servent nulle part ;
 *   - les widgets : tables introuvables, appels vers internet, jetons d'accès.
 * Chaque écart a son bouton « Corriger → » vers l'outil qui le règle.
 * Les règles elles-mêmes sont dans commun/norme.js (partagées avec scripts/auditer-norme.js).
 */

const etatSante = { lignes: null, analyses: [], date: null, masquerConformes: true, enCours: false };

/** Lit une table du document en lignes { id, … } ; null si elle est illisible. */
async function lireSante(table) {
  try { return Outils.enLignes(await grist.docApi.fetchTable(table)); } catch (e) { return null; }
}

/** Lance tous les contrôles, puis redessine. */
async function controlerSante() {
  if (etatSante.enCours) return;
  etatSante.enCours = true;
  dessinerSante('Lecture du document…');
  try {
    const [tables, colonnes, sections, vues, champs, regles] = await Promise.all(
      ['_grist_Tables', '_grist_Tables_column', '_grist_Views_section', '_grist_Views', '_grist_Views_section_field', '_grist_ACLRules'].map(lireSante));
    let norme = [], depotInjoignable = false;
    try { norme = await Norme.lireNorme(); } catch (e) { depotInjoignable = true; }
    const d = Norme.preparer({ tables, colonnes, sections, vues, champs,
      // un non-propriétaire reçoit une liste vide : les règles sont alors illisibles, pas absentes
      regles: regles && regles.length ? regles : null, norme });

    dessinerSante('Analyse des widgets…');
    const doc = await Structure.lire();
    const analyses = await Promise.all(doc.sections.filter((s) => s.genre === 'custom').map(async (s) =>
      Object.assign(await Structure.analyserWidget(s, doc), { page: Structure.cheminPage(doc, s.vue) })));
    const luesParWidgets = new Set(analyses.flatMap((a) => a.tables.flatMap((t) => t.colonnes.map((c) => t.id + '.' + c))));

    dessinerSante('Recherche des formules en erreur…');
    const lignes = [
      ...Norme.controler(d),
      ...(await Norme.formules(d, lireSante)),
      ...Norme.colonnesInutilisees(d, luesParWidgets),
      ...Norme.analyseWidgets(analyses),
    ];
    if (depotInjoignable) lignes.unshift({ principe: 'P1', objet: 'P1 Socle', etat: '❔', detail: 'Dépôt de la norme injoignable : tables du socle non contrôlées', elements: [], outil: 'maintenance' });
    Object.assign(etatSante, { lignes, analyses, date: new Date() });
  } finally {
    etatSante.enCours = false;
  }
  dessinerSante();
}

/** Une ligne de contrôle : état, intitulé, détail, éléments en cause et bouton « Corriger → ». */
function pointSante(l) {
  const esc = Outils.esc;
  const ok = l.etat === Norme.OK;
  const titreOutil = (Console.modules.find((m) => m.cle === l.outil) || {}).titre || '';
  const bouton = !ok && l.outil && titreOutil
    ? `<button class="bouton petit" data-sante-outil="${esc(l.outil)}" title="Ouvrir ${esc(titreOutil)}">Corriger →</button>` : '';
  const elements = (l.elements || []).length && !ok
    ? `<div class="elements puces">${l.elements.map((e) => `<span class="puce">${esc(e)}</span>`).join('')}</div>` : '';
  return `<details class="point ${elements ? '' : 'sans-detail'}">
    <summary><span class="etat-sante">${l.etat}</span>
      <span><div class="objet">${esc(l.objet.replace(/^P\d\s/, ''))} <span class="discret">${/^P\d/.test(l.principe) ? esc(l.principe) : ''}</span></div>
      <div class="detail">${esc(l.detail)}</div></span>${bouton}</summary>${elements}</details>`;
}

/** Sorties vers internet de tous les widgets, regroupées par site. */
function tableauSorties() {
  const esc = Outils.esc;
  const parDomaine = new Map();
  for (const a of etatSante.analyses) for (const s of a.sorties) {
    if (!parDomaine.has(s.domaine)) parDomaine.set(s.domaine, new Set());
    parDomaine.get(s.domaine).add(a.page);
  }
  if (!parDomaine.size) return '<p class="vide">Aucun widget n\'appelle internet.</p>';
  const lignes = [...parDomaine].sort((a, b) => Norme.deConfiance(a[0]) - Norme.deConfiance(b[0]) || a[0].localeCompare(b[0]));
  return `<table class="sorties"><thead><tr><th>Site appelé</th><th>Par les pages</th><th></th></tr></thead><tbody>
    ${lignes.map(([dom, pages]) => `<tr><td><b>${esc(dom)}</b></td><td>${[...pages].map(esc).join('<br>')}</td>
      <td>${Norme.deConfiance(dom) ? '<span class="badge vert">norme ou Grist</span>' : '<span class="badge orange">extérieur</span>'}</td></tr>`).join('')}
  </tbody></table>`;
}

/** Dessine la page ; « attente » : message pendant les contrôles. */
function dessinerSante(attente) {
  const z = document.getElementById('sante-contenu');
  if (!z) return;
  const esc = Outils.esc;
  const L = etatSante.lignes;
  const entete = `<section class="carte"><div class="entete-sante">
      <div><h2>🩺 Santé du document</h2>
        <p class="discret">Conformité à la norme DGOM et qualité du document, en lecture seule.
        ${etatSante.date ? 'Contrôle du ' + etatSante.date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) + '.' : ''}</p></div>
      <div class="actions-sante">
        <label><input type="checkbox" id="sante-masquer" ${etatSante.masquerConformes ? 'checked' : ''}> Masquer ce qui est conforme</label>
        <button class="bouton" data-sante-action="copier" ${L ? '' : 'disabled'} title="Tableau Markdown, à coller dans norme/applications/">📋 Copier le rapport</button>
        <button class="bouton primaire" data-sante-action="relancer" ${etatSante.enCours ? 'disabled' : ''}>↻ Relancer</button>
      </div></div></section>`;
  if (!L || attente) { z.innerHTML = entete + `<p class="discret">${esc(attente || 'Contrôle du document…')}</p>`; return; }

  const s = Norme.synthese(L);
  const visibles = (liste) => liste.filter((l) => !etatSante.masquerConformes || l.etat !== Norme.OK);
  const bloc = (titre, intro, liste) => {
    const v = visibles(liste);
    return `<section class="carte"><h2>${titre}</h2><p class="discret">${intro}</p>
      ${v.length ? v.map(pointSante).join('') : '<p class="vide">✅ Tout est conforme.</p>'}</section>`;
  };
  z.innerHTML = entete + `
    <div class="tuiles">
      <div class="tuile ${s.absents ? 'rouge' : 'vert'}"><div class="valeur">${s.absents}</div><div class="libelle">point(s) à corriger</div></div>
      <div class="tuile ${s.partiels ? 'orange' : 'vert'}"><div class="valeur">${s.partiels}</div><div class="libelle">point(s) à améliorer</div></div>
      <div class="tuile vert"><div class="valeur">${s.conformes}</div><div class="libelle">point(s) conforme(s)</div></div>
      <div class="tuile"><div class="valeur">${etatSante.analyses.length}</div><div class="libelle">widget(s) analysé(s)</div></div>
    </div>
    ${bloc('📐 Norme DGOM', 'Les sept principes de la norme (norme/principes.md). Cliquez sur un point pour voir les éléments en cause.', L.filter((l) => /^P\d/.test(l.principe)))}
    ${bloc('🧪 Qualité du document', 'Formules en erreur, colonnes qui ne servent nulle part, widgets. Une colonne « inutilisée » est à vérifier : elle peut être remplie par un import.', L.filter((l) => !/^P\d/.test(l.principe)))}
    <section class="carte"><h2>🌐 Sorties vers internet</h2>
      <p class="discret">Sites appelés par le code des widgets. Le détail (tables et colonnes lues) est dans l'Explorateur, onglet Widgets.</p>
      ${tableauSorties()}</section>`;
}

// Boutons et case à cocher du module
document.getElementById('module-sante').addEventListener('click', async (e) => {
  const outil = e.target.closest('[data-sante-outil]');
  if (outil) { e.preventDefault(); return Console.ouvrir(outil.dataset.santeOutil); }
  const b = e.target.closest('[data-sante-action]');
  if (!b) return;
  if (b.dataset.santeAction === 'relancer') return controlerSante();
  if (b.dataset.santeAction === 'copier') {
    // titre du rapport : le nom de l'application (Paramètres), sinon rien
    let titre = '';
    try { titre = (await Outils.parametres()).Nom_application || ''; } catch (err) { /* pas de Paramètres */ }
    try { await navigator.clipboard.writeText(Norme.enMarkdown(etatSante.lignes, titre)); avis('Rapport copié : collez-le dans norme/applications/.', 'ok'); }
    catch (err) { avis('Copie impossible dans ce navigateur.', 'erreur'); }
  }
});
document.getElementById('module-sante').addEventListener('change', (e) => {
  if (e.target.id === 'sante-masquer') { etatSante.masquerConformes = e.target.checked; dessinerSante(); }
});

controlerSante();
