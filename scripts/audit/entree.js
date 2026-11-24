
// --- Point d'entrée du script : lecture par l'API du document, puis les contrôles de Norme ---------

/** Identifiant du document ouvert, lu dans l'adresse de la page. */
function idDuDocument() {
  const m = location.pathname.match(/\/(?:o\/[^/]+\/)?([A-Za-z0-9]{12,})(?:\/|$)/);
  if (!m) throw new Error("Impossible de trouver l'identifiant du document dans l'adresse.");
  return m[1];
}

/**
 * Lit toutes les lignes d'une table (y compris les tables internes _grist_…), en { id, …colonnes }.
 * On passe par /records plutôt que par /sql, que le pare-feu de grist.numerique.gouv.fr bloque parfois.
 * Rend null si la table n'existe pas ou n'est pas lisible.
 */
async function lireTable(docId, table) {
  const r = await fetch(`/api/docs/${docId}/tables/${table}/records?hidden=true`, { credentials: 'include' });
  if (!r.ok) return null;
  return (await r.json()).records.map((x) => ({ id: x.id, ...x.fields }));
}

/**
 * Audite le document et rend { lignes, synthese, markdown } ; affiche aussi le tableau dans la console.
 */
async function auditerNorme({ docId = null, depot = Norme.DEPOT } = {}) {
  docId = docId || idDuDocument();
  const lire = (t) => lireTable(docId, t);
  const [tables, colonnes, sections, vues, champs, regles] = await Promise.all(
    ['_grist_Tables', '_grist_Tables_column', '_grist_Views_section', '_grist_Views', '_grist_Views_section_field', '_grist_ACLRules'].map(lire));
  const d = Norme.preparer({ tables, colonnes, sections, vues, champs,
    // un non-propriétaire reçoit une liste vide : les règles sont alors illisibles, pas absentes
    regles: regles && regles.length ? regles : null,
    norme: await Norme.lireNorme(depot) });
  const lignes = [...Norme.controler(d), ...(await Norme.personnes(d, lire)), ...(await Norme.formules(d, lire)), ...Norme.colonnesInutilisees(d)];
  const synthese = Norme.synthese(lignes);
  const markdown = Norme.enMarkdown(lignes, document.title.replace(/ - Grist$/, ''));
  console.table(lignes.map((l) => ({ Principe: l.objet, État: l.etat, Détail: l.detail })));
  console.log(markdown);
  return { lignes, synthese, markdown };
}
