/*
 * 🏗️ Module Atelier — console d'administration (affichage : admin/atelier.html).
 * Créer et modifier les tables et colonnes selon la norme, avec aperçu avant d'appliquer ;
 * chaque enregistrement est noté au journal (Console.ecrire).
 * Idée de départ : Florent Ballu ; version 2 : Quentin Lemire.
 */
// ---------- Types de colonnes, en français, et références vers les tables du document ----------
        let tablesDuDocument = [];
        const TYPES_DE_BASE = [['Text', 'Texte'], ['Numeric', 'Décimal'], ['Int', 'Entier'], ['Bool', 'Booléen'], ['Date', 'Date'],
            ['DateTime:Europe/Paris', 'Date et heure'], ['Choice', 'Choix'], ['ChoiceList', 'Choix multiple'], ['Attachments', 'Pièces jointes']];

        /** Options de la liste des types : types de base, puis une référence (simple et multiple) par table. */
        function optionsDeType(type) {
            const liste = [...TYPES_DE_BASE, ...tablesDuDocument.flatMap(t => [['Ref:' + t, 'Réf. → ' + t], ['RefList:' + t, 'Réf. multiple → ' + t]])];
            if (type && !liste.some(([v]) => v === type)) liste.push([type, Structure.typeFrancais(type)]);
            return liste.map(([v, l]) => `<option value="${escapeHtml(v)}" ${v === type ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('');
        }

        // ---------- Aperçu des changements ----------
        const declenchement = c => !c.formula ? '' : c.isFormula ? ' · formule' : c.recalcWhen === 2 ? ' · recalculée à chaque modification' : ' · calculée à la création';

        /** Texte de l'aperçu : la table, puis chaque colonne ajoutée ou modifiée, en clair. */
        function apercu(tableId, nouvelle, ajouts, modifs) {
            const lignes = [nouvelle ? `Créer la table ${tableId} :` : `Modifier la table ${tableId} :`];
            for (const c of ajouts) lignes.push(`  ＋ ${c.id} « ${c.label} » — ${Structure.typeFrancais(c.type)}${declenchement(c)}`);
            for (const c of modifs) {
                const o = c.original || {}, quoi = [];
                if (o.label !== c.label) quoi.push(`libellé « ${o.label} » → « ${c.label} »`);
                if (o.type !== c.type) quoi.push(`type ${Structure.typeFrancais(o.type)} → ${Structure.typeFrancais(c.type)}`);
                if ((o.formula || '').trim() !== c.formula) quoi.push('formule modifiée');
                if (o.isFormula !== c.isFormula || o.recalcWhen !== c.recalcWhen) quoi.push('calcul :' + (declenchement(c) || ' aucun').replace(' · ', ' '));
                lignes.push(`  ✎ ${c.originalId} : ${quoi.join(', ')}`);
            }
            lignes.push('', 'Tout s\'applique en une seule opération, annulable avec le bouton ↶ de Grist.');
            return lignes.join('\n');
        }

        let tablesCache = {};

        // Colonnes à ne jamais inclure dans l'historique
        const HISTORY_EXCLUDED = new Set([
            'id', 'manualSort', 'HISTORY_RAW', 'HISTORY', 'CreeLe', 'CreePar', 'ModifieLe', 'ModifiePar'
        ]);


        // Chargement unique au démarrage. (Avant : à chaque modification de la table liée au widget,
        // ce qui vidait le formulaire en cours de saisie.)
        async function init() {
            await loadTables();
        }

        /** Remplit la liste des tables ; « garder » : table à resélectionner (après un enregistrement). */
        async function loadTables(garder) {
            try {
                const tablesData = await grist.docApi.fetchTable('_grist_Tables');
                const select = document.getElementById('tableSelect');
                select.innerHTML = '<option value="__NEW__">➕ Créer une nouvelle table...</option>';
                tablesCache = {};
                tablesDuDocument = tablesData.tableId.filter(id => !id.startsWith('_grist_') && !id.startsWith('GristHidden')).sort();
                // tables de regroupement (créées par Grist, non modifiables ici) et tables internes : hors de la liste
                tablesData.tableId.forEach((tableId, i) => {
                    if (!tableId.startsWith('_grist_') && !tableId.startsWith('GristHidden') && !(tablesData.summarySourceTable[i] > 0)) {
                        const option = document.createElement('option');
                        option.value = tableId;
                        option.textContent = tableId;
                        select.appendChild(option);
                    }
                });
                if (garder && tablesData.tableId.includes(garder)) select.value = garder;
                handleTableChange();
            } catch (err) {
                console.error(err);
                avis("Erreur lors du chargement des tables : " + err.message, 'erreur');
            }
        }

        async function handleTableChange() {
            const select = document.getElementById('tableSelect');
            const newTableInput = document.getElementById('newTableName');
            const container = document.getElementById('columnsContainer');
            container.innerHTML = '';

            if (select.value === '__NEW__') {
                newTableInput.classList.remove('hidden');
                newTableInput.value = '';
                addColumnRow();
            } else {
                newTableInput.classList.add('hidden');
                const tableId = select.value;
                try {
                    const colsData = await grist.docApi.fetchTable('_grist_Tables_column');
                    const tablesList = await grist.docApi.fetchTable('_grist_Tables');
                    const internalTableNumId = tablesList.id[tablesList.tableId.indexOf(tableId)];
                    tablesCache[tableId] = [];

                    for (let i = 0; i < colsData.id.length; i++) {
                        if (colsData.parentId[i] === internalTableNumId
                            && colsData.colId[i] !== "manualSort"
                            && !colsData.colId[i].startsWith('gristHelper_')) {
                              
                            const colId = colsData.colId[i];
                            const label = colsData.label ? (colsData.label[i] || colId) : colId;
                            const type = colsData.type[i] || 'Text';
                            const formula = colsData.formula ? (colsData.formula[i] || '') : '';
                            const internalId = colsData.id[i];
                            const isFormula = colsData.isFormula ? colsData.isFormula[i] : false;
                            const recalcWhen = colsData.recalcWhen ? colsData.recalcWhen[i] : 0;

                            const triggerUpdate = formula && !isFormula && (recalcWhen === 2);
                            const triggerCreate = formula && !isFormula && (recalcWhen === 0) ;

                            tablesCache[tableId].push({
                                internalId, id: colId, label, type, formula, isFormula, recalcWhen,
                            });

                            addColumnRow(label, type, formula, triggerCreate, triggerUpdate, colId, internalId);
                        }
                    }

                    if (tablesCache[tableId].length === 0) addColumnRow();

                    // Lire la liste des colonnes suivies dans la formule de HISTORY_RAW
                    const trackedFromFormula = extractTrackedColsFromHistoryFormula(colsData, internalTableNumId);
                    if (trackedFromFormula.size > 0) {
                        document.querySelectorAll('#columnsContainer tr').forEach(row => {
                            const originalId = row.dataset.originalId || '';
                            const trackCb = row.querySelector('.col-track-history');
                            if (trackCb && !trackCb.disabled && trackedFromFormula.has(originalId)) {
                                trackCb.checked = true;
                            }
                        });
                    }
                    updateHistoryColumnVisibility();
                } catch (err) {
                    avis("Erreur lors de la lecture des colonnes : " + err.message, 'erreur');
                }
            }
        }

        function extractTrackedColsFromHistoryFormula(colsData, internalTableNumId) {
            const tracked = new Set();
            for (let i = 0; i < colsData.id.length; i++) {
                if (colsData.parentId[i] !== internalTableNumId) continue;
                if (colsData.colId[i] !== 'HISTORY_RAW') continue;
                const formula = colsData.formula ? (colsData.formula[i] || '') : '';
                const match = formula.match(/trackedC\s*=\s*\[([^\]]*)\]/);
                if (!match) break;
                const inner = match[1];
                const colMatches = inner.matchAll(/["']([^"']+)["']/g);
                for (const m of colMatches) tracked.add(m[1]);
                break;
            }
            return tracked;
        }

        function updateHistoryColumnVisibility() {
            const ids = Array.from(document.querySelectorAll('#columnsContainer tr')).map(r => r.dataset.originalId || '');
            const hasHistory = ids.includes('HISTORY') && ids.includes('HISTORY_RAW');
            document.getElementById('th-history').classList.toggle('hidden', !hasHistory);
            document.querySelectorAll('.td-history').forEach(td => td.classList.toggle('hidden', !hasHistory));
        }

        function isExcludedFromHistory(colId, formula, isFormula) {
            if (HISTORY_EXCLUDED.has(colId)) return true;
            if (colId.startsWith('gristHelper_') || colId.startsWith('#')) return true;
            if (formula && isFormula) return true;
            return false;
        }

        // idPropose : identifiant imposé pour une nouvelle colonne (ex. CreeLe pour « Créé le »)
        function addColumnRow(label = '', type = 'Text', formula = '', triggerCreate = false, triggerUpdate = false, originalId = '', internalId = '', trackHistory = false, widgetOptions = '', idPropose = '') {
            const container = document.getElementById('columnsContainer');
            const tr = document.createElement('tr');
            tr.className = 'ligne-colonne';
            tr.dataset.originalId = originalId;
            tr.dataset.internalId = internalId;
            tr.dataset.originalType = type;
            tr.dataset.widgetOptions = widgetOptions || '';
            tr.dataset.idPropose = idPropose || '';
            // cases de déclenchement d'origine : sans changement, la colonne garde son réglage exact
            tr.dataset.triggerCreate = triggerCreate ? '1' : '';
            tr.dataset.triggerUpdate = triggerUpdate ? '1' : '';

            const typeOptions = optionsDeType(type);

            const isHistoryCol = (label === 'HISTORY_RAW' || label === 'HISTORY');
            const readonlyAttr = isHistoryCol ? 'readonly tabindex="-1"' : '';
            const readonlyClass = isHistoryCol ? ' lecture-seule' : '';
            const historyChecked = (!isHistoryCol && trackHistory) ? 'checked' : '';
            if (isHistoryCol) tr.className += ' ligne-technique';

            tr.innerHTML = `
                <td>
                    <input type="text" placeholder="Ex : Nom de famille" ${readonlyAttr}
                        class="col-label champ${readonlyClass}">
                </td>
                <td>
                    <select class="col-type champ${readonlyClass}" ${isHistoryCol ? 'disabled' : ''}>
                        ${typeOptions}
                    </select>
                </td>
                <td>
                    <textarea placeholder="Ex : $Prenom + ' ' + $Nom" ${readonlyAttr}
                        class="col-formula champ code${readonlyClass}"></textarea>
                </td>
                <td class="centre">
                    <input type="checkbox" class="col-trigger-create"
                        ${triggerCreate ? 'checked' : ''} ${isHistoryCol ? 'disabled' : ''}>
                </td>
                <td class="centre">
                    <input type="checkbox" class="col-trigger-update"
                        ${triggerUpdate ? 'checked' : ''} ${isHistoryCol ? 'disabled' : ''}>
                </td>
                <td class="centre td-history ${isHistoryCol ? 'hidden' : (document.getElementById('th-history').classList.contains('hidden') ? 'hidden' : '')}">
                    <input type="checkbox" class="col-track-history"
                        ${historyChecked}
                        title="Inclure dans le suivi historique"
                        onchange="regenerateHistoryFormula()">
                </td>
                <td class="centre">
                    <button type="button" onclick="this.closest('tr').remove(); regenerateHistoryFormula();" class="retirer" title="Retirer cette ligne du formulaire (une colonne existante n'est pas supprimée du document)">✕</button>
                </td>
            `;
            // libellé et formule viennent du document : posés comme valeurs, jamais comme HTML
            tr.querySelector('.col-label').value = label;
            tr.querySelector('.col-formula').value = formula;
            container.appendChild(tr);
        }

        // Formule de validation du format d'un courriel : accepte une valeur vide (pour ne pas
        // bloquer les lignes sans courriel renseigné) et vérifie sinon la forme générale via une regex.
        const EMAIL_VALID_FORMULA = [
            'import re',
            '',
            'email = $Courriel or ""',
            'pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$"',
            'return bool(re.match(pattern, email.strip())) or not bool(email)',
        ].join('\n');

        function addEmailValidationColumn() {
            if (idsDuFormulaire().includes('courriel_valide')) return avis('La colonne « Courriel valide » est déjà là.', 'info');
            addColumnRow('Courriel valide', 'Bool', EMAIL_VALID_FORMULA, false, false, '', '', false, '', 'Courriel_valide');
        }

        // Identifiants présents dans le formulaire (colonnes existantes et lignes déjà ajoutées)
        function idsDuFormulaire() {
            return Array.from(document.querySelectorAll('#columnsContainer tr')).map(row =>
                (row.dataset.originalId || row.dataset.idPropose || identifiant(row.querySelector('.col-label').value)).toLowerCase());
        }

        function addTraceabilityColumns() {
            const deja = idsDuFormulaire();
            const traces = [
                ['Créé le', 'DateTime:Europe/Paris', 'NOW()', true, false, 'CreeLe'],
                ['Créé par', 'Text', 'user.Email', true, false, 'CreePar'],
                ['Modifié le', 'DateTime:Europe/Paris', 'NOW()', false, true, 'ModifieLe'],
                ['Modifié par', 'Text', 'user.Email', false, true, 'ModifiePar'],
            ].filter(t => !deja.includes(t[5].toLowerCase()));
            if (!traces.length) return avis('La traçabilité est déjà là (CreeLe, CreePar, ModifieLe, ModifiePar).', 'info');
            traces.forEach(([label, type, formule, creation, modif, id]) =>
                addColumnRow(label, type, formule, creation, modif, '', '', false, '', id));
        }

        // =====================================================================
        // SONDAGE DE DATES (pop-up agenda + créneaux)
        // =====================================================================
        let pollCalYear, pollCalMonth;      // mois affiché dans l'agenda
        let pollSelectedDay = null;         // 'YYYY-MM-DD' du jour cliqué dans l'agenda
        let pollSlots = [];                 // créneaux confirmés : {date, timeStart, timeEnd}
        let pollChoices = [];               // valeurs de réponse possibles : {value, fillColor, textColor}

        // Palette par défaut appliquée aux valeurs (couleurs modifiables ensuite dans la pop-up)
        const POLL_COLOR_PALETTE = [
            { fillColor: '#E2F0D9', textColor: '#385723' }, // vert
            { fillColor: '#FFF2CC', textColor: '#7F6000' }, // jaune
            { fillColor: '#FBE2E1', textColor: '#A61E1E' }, // rouge
            { fillColor: '#DDEBF7', textColor: '#1F4E78' }, // bleu
            { fillColor: '#EAE6F8', textColor: '#4C3B8C' }, // violet
        ];

        function openDatePollModal() {
            const today = new Date();
            pollCalYear = today.getFullYear();
            pollCalMonth = today.getMonth();
            pollSelectedDay = null;
            pollSlots = [];
            pollChoices = [
                { value: 'Disponible', ...POLL_COLOR_PALETTE[0] },
                { value: 'Compliqué', ...POLL_COLOR_PALETTE[1] },
                { value: 'Impossible', ...POLL_COLOR_PALETTE[2] },
            ];
            document.getElementById('pollTimeStart').value = '';
            document.getElementById('pollTimeEnd').value = '';
            renderPollCalendar();
            renderPollSlotsList();
            renderPollChoices();
            document.getElementById('datePollModal').classList.remove('hidden');
        }

        function renderPollChoices() {
            const wrap = document.getElementById('pollChoicesList');
            wrap.innerHTML = pollChoices.map((c, i) => `
                <div class="valeur-sondage">
                    <input type="text" value="${(c.value || '').replace(/"/g, '&quot;')}" placeholder="Ex: Disponible"
                        oninput="pollChoices[${i}].value = this.value; updatePollChoicePreview(${i})"
                        class="champ">
                    <input type="color" value="${c.fillColor}" title="Couleur de fond"
                        oninput="pollChoices[${i}].fillColor = this.value; updatePollChoicePreview(${i})"
                        class="couleur">
                    <input type="color" value="${c.textColor}" title="Couleur du texte"
                        oninput="pollChoices[${i}].textColor = this.value; updatePollChoicePreview(${i})"
                        class="couleur">
                    <span id="pollChoicePreview${i}" class="apercu-valeur"
                        style="background-color:${c.fillColor}; color:${c.textColor}">${escapeHtml(c.value || '…')}</span>
                    <button type="button" onclick="removePollChoice(${i})" class="retirer">✕</button>
                </div>
            `).join('');
        }

        function updatePollChoicePreview(i) {
            const c = pollChoices[i];
            const el = document.getElementById(`pollChoicePreview${i}`);
            if (!el) return;
            el.style.backgroundColor = c.fillColor;
            el.style.color = c.textColor;
            el.textContent = c.value || '…';
        }

        function addPollChoice() {
            const palette = POLL_COLOR_PALETTE[pollChoices.length % POLL_COLOR_PALETTE.length];
            pollChoices.push({ value: '', ...palette });
            renderPollChoices();
            const inputs = document.querySelectorAll('#pollChoicesList input[type="text"]');
            if (inputs.length) inputs[inputs.length - 1].focus();
        }

        function removePollChoice(index) {
            if (pollChoices.length <= 1) {
                avis("Il faut conserver au moins une valeur possible.", 'erreur');
                return;
            }
            pollChoices.splice(index, 1);
            renderPollChoices();
        }

        function closeDatePollModal() {
            document.getElementById('datePollModal').classList.add('hidden');
        }

        function pollCalPrevMonth() {
            pollCalMonth--;
            if (pollCalMonth < 0) { pollCalMonth = 11; pollCalYear--; }
            renderPollCalendar();
        }

        function pollCalNextMonth() {
            pollCalMonth++;
            if (pollCalMonth > 11) { pollCalMonth = 0; pollCalYear++; }
            renderPollCalendar();
        }

        function pollDateKey(y, m, d) {
            return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }

        function renderPollCalendar() {
            const label = document.getElementById('pollCalendarLabel');
            label.textContent = new Date(pollCalYear, pollCalMonth, 1)
                .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

            const grid = document.getElementById('pollCalendarGrid');
            grid.innerHTML = '';

            const daysInMonth = new Date(pollCalYear, pollCalMonth + 1, 0).getDate();
            const firstWeekday = (new Date(pollCalYear, pollCalMonth, 1).getDay() + 6) % 7; // 0 = Lundi

            const todayKey = pollDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

            for (let i = 0; i < firstWeekday; i++) {
                grid.appendChild(document.createElement('div'));
            }

            for (let d = 1; d <= daysInMonth; d++) {
                const key = pollDateKey(pollCalYear, pollCalMonth, d);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = d;
                btn.onclick = () => selectPollDay(key);

                btn.className = 'jour' + (key === pollSelectedDay ? ' choisi' : key === todayKey ? ' aujourdhui' : '');
                grid.appendChild(btn);
            }
        }

        function selectPollDay(key) {
            pollSelectedDay = key;
            document.getElementById('pollAddSlotBtn').disabled = false;
            renderPollCalendar();
        }

        function formatPollSlotLabel(dateKey, timeStart, timeEnd) {
            const d = new Date(dateKey + 'T00:00:00');
            const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
            const dayMonth = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            let label = `${weekday} ${dayMonth}`;
            if (timeStart) {
                label += ` ${timeStart.replace(':', 'h')}`;
                if (timeEnd) label += `-${timeEnd.replace(':', 'h')}`;
            }
            return label;
        }

        function addPollSlot() {
            if (!pollSelectedDay) return;
            const timeStart = document.getElementById('pollTimeStart').value;
            const timeEnd = document.getElementById('pollTimeEnd').value;

            const duplicate = pollSlots.some(s =>
                s.date === pollSelectedDay && s.timeStart === timeStart && s.timeEnd === timeEnd);
            if (duplicate) {
                avis("Ce créneau a déjà été ajouté.", 'erreur');
                return;
            }

            pollSlots.push({ date: pollSelectedDay, timeStart, timeEnd });
            pollSlots.sort((a, b) => (a.date + a.timeStart).localeCompare(b.date + b.timeStart));

            document.getElementById('pollTimeStart').value = '';
            document.getElementById('pollTimeEnd').value = '';
            renderPollSlotsList();
        }

        function removePollSlot(index) {
            pollSlots.splice(index, 1);
            renderPollSlotsList();
        }

        function renderPollSlotsList() {
            const list = document.getElementById('pollSlotsList');
            const validateBtn = document.getElementById('pollValidateBtn');
            
            if (pollSlots.length === 0) {
                list.innerHTML = '<li class="discret">Aucun créneau ajouté pour l\'instant.</li>';
            } else {
                list.innerHTML = pollSlots.map((s, i) => `
                    <li class="creneau">
                        <span>${formatPollSlotLabel(s.date, s.timeStart, s.timeEnd)}</span>
                        <button type="button" onclick="removePollSlot(${i})" class="retirer">✕</button>
                    </li>
                `).join('');
            }

            validateBtn.disabled = pollSlots.length === 0;
            validateBtn.textContent = `Valider (${pollSlots.length} créneau${pollSlots.length > 1 ? 'x' : ''})`;
        }

        function validateDatePoll() {
            if (pollSlots.length === 0) return;

            const cleanChoices = pollChoices
                .map(c => ({ value: (c.value || '').trim(), fillColor: c.fillColor, textColor: c.textColor }))
                .filter(c => c.value);
            if (cleanChoices.length === 0) {
                avis("Indiquez au moins une valeur possible (ex : Disponible).", 'erreur');
                return;
            }
            const choiceOptions = {};
            cleanChoices.forEach(c => {
                choiceOptions[c.value] = { fillColor: c.fillColor, textColor: c.textColor };
            });
            const widgetOptions = JSON.stringify({
                choices: cleanChoices.map(c => c.value),
                choiceOptions,
            });
            // Supprime les lignes de colonnes vides (ex: ligne par défaut d'une nouvelle table)
            document.querySelectorAll('#columnsContainer tr').forEach(row => {
                const label = row.querySelector('.col-label').value.trim();
                if (!label) row.remove();
            });
            // Courriel et Commentaires : seulement s'ils ne sont pas déjà dans la table
            if (!idsDuFormulaire().includes('courriel')) addColumnRow('Courriel', 'Text', '', false, false);
            pollSlots.forEach(s => {
                const label = formatPollSlotLabel(s.date, s.timeStart, s.timeEnd);
                addColumnRow(label, 'Choice', '', false, false, '', '', false, widgetOptions);
            });
            if (!idsDuFormulaire().includes('commentaires')) addColumnRow('Commentaires', 'Text', '', false, false);

            updateHistoryColumnVisibility();
            closeDatePollModal();
        }
        // Convertit un type "grist.XXX(args)" de la vue du code en type de colonne Grist.
function mapPyGristType(rawType, args) {
    const firstStr = (args || '').match(/['"]([^'"]+)['"]/);
    switch (rawType) {
        case 'Reference':     return firstStr ? 'Ref:' + firstStr[1] : 'Ref';
        case 'ReferenceList': return firstStr ? 'RefList:' + firstStr[1] : 'RefList';
        case 'Text': case 'Numeric': case 'Int': case 'Bool': case 'Date':
        case 'DateTime': case 'Choice': case 'ChoiceList': case 'Attachments': case 'Any':
            return rawType;
        default:              return 'Text';
    }
}

// Analyse ligne par ligne la classe Python collée depuis la "Vue du code".
// Gère : colonnes de données, formules multilignes (avec ou sans @grist.formulaType,
// donc aussi les colonnes de type "Any" qui n'ont pas de décorateur) et
// formules d'initialisation (_default_XXX) multilignes.
function parsePythonTableCode(code) {
    const lines = code.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
    const indentOf = l => l.match(/^ */)[0].length;
    const isBlank = l => !l.trim();

    const classIdx = lines.findIndex(l => /^\s*class\s+[A-Za-z0-9_]+\s*(\(|:)/.test(l));
    if (classIdx === -1) return null;
    const tableName = lines[classIdx].match(/class\s+([A-Za-z0-9_]+)/)[1];

    // Indentation des membres de la classe = celle de la première ligne non vide qui suit
    let memberIndent = null;
    for (let i = classIdx + 1; i < lines.length; i++) {
        if (!isBlank(lines[i])) { memberIndent = indentOf(lines[i]); break; }
    }
    if (memberIndent === null) return { tableName, columns: new Map() };

    const columns = new Map(); // conserve l'ordre de découverte
    const getCol = (id) => {
        if (!columns.has(id)) columns.set(id, { label: id, type: 'Text', formula: '', triggerCreate: false, triggerUpdate: false, typeKnown: false });
        return columns.get(id);
    };

    let pendingType = null; // type lu dans un @grist.formulaType(...)
    let i = classIdx + 1;
    while (i < lines.length) {
        const line = lines[i];
        if (isBlank(line) || indentOf(line) !== memberIndent) { i++; continue; }
        const t = line.trim();

        // Décorateur de type de formule
        let m = t.match(/^@grist\.formulaType\(\s*grist\.([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\)/);
        if (m) { pendingType = mapPyGristType(m[1], m[2]); i++; continue; }
        if (t.startsWith('@')) { i++; continue; }

        // Déclaration d'une colonne de données : Nom = grist.Type(args)
        m = t.match(/^([A-Za-z0-9_]+)\s*=\s*grist\.([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
        if (m) {
            const c = getCol(m[1]);
            c.type = mapPyGristType(m[2], m[3]);
            c.typeKnown = true;
            i++; continue;
        }

        // Fonction : formule standard ou formule d'initialisation (_default_)
        m = t.match(/^def\s+([A-Za-z0-9_]+)\s*\(/);
        if (m) {
            const fnName = m[1];
            // Corps = lignes suivantes plus indentées (lignes vides incluses)
            const body = [];
            let j = i + 1;
            while (j < lines.length && (isBlank(lines[j]) || indentOf(lines[j]) > memberIndent)) {
                body.push(lines[j]); j++;
            }
            while (body.length && isBlank(body[body.length - 1])) body.pop();
            const minIndent = Math.min(...body.filter(l => !isBlank(l)).map(indentOf));
            const formula = body.map(l => l.slice(Math.min(minIndent, indentOf(l)))).join('\n').trim();

            if (fnName.startsWith('_default_')) {
                const c = getCol(fnName.slice('_default_'.length));
                c.formula = formula;
                if (/modifi/i.test(c.label)) c.triggerUpdate = true; else c.triggerCreate = true;
            } else {
                const c = getCol(fnName);
                c.formula = formula;
                if (pendingType) { c.type = pendingType; c.typeKnown = true; }
                else if (!c.typeKnown) c.type = 'Any'; // pas de décorateur = colonne formule de type Any
            }
            pendingType = null;
            i = j; continue;
        }
        i++;
    }
    return { tableName, columns };
}

function parseAndLoadPythonCode() {
    const code = document.getElementById('pythonCodeInput').value;
    if (!code.trim()) {
        avis("Collez du code Python valide.", 'erreur');
        return;
    }

    if (!code.includes('\n')) {
        avis("Le code collé tient sur une seule ligne : les retours à la ligne et l'indentation ont été perdus. " +
              "Copiez-le directement depuis la </> Vue du code de Grist (Ctrl+C) pour conserver la mise en forme.", 'erreur');
        return;
    }

    const parsed = parsePythonTableCode(code);
    if (!parsed) {
        avis("Impossible de trouver le nom de la table (déclaration 'class NomTable:').", 'erreur');
        return;
    }

    // Forcer le sélecteur sur la création d'une nouvelle table et injecter le nom
    document.getElementById('tableSelect').value = "__NEW__";
    const nameInput = document.getElementById('newTableName');
    nameInput.classList.remove('hidden');
    nameInput.value = parsed.tableName;

    const container = document.getElementById('columnsContainer');
    container.innerHTML = '';

    const keys = [...parsed.columns.keys()];
    if (keys.length === 0) {
        avis("Aucune colonne n'a pu être extraite : vérifiez la syntaxe.", 'erreur');
        addColumnRow();
        return;
    }

    keys.forEach(colId => {
        const c = parsed.columns.get(colId);
        addColumnRow(c.label, c.type, c.formula, c.triggerCreate, c.triggerUpdate, colId, '');
    });

    updateHistoryColumnVisibility();
    avis(`Table « ${parsed.tableName} » lue : ${keys.length} colonnes trouvées. Vérifiez-les, puis « Appliquer les modifications ».`, 'ok');
}


        // =====================================================================
        // HISTORY FEATURE
        // =====================================================================

        function getTrackedColumns() {
            const rows = document.querySelectorAll('#columnsContainer tr');
            const cols = [];
            rows.forEach(row => {
                const trackCb = row.querySelector('.col-track-history');
                if (!trackCb || !trackCb.checked) return;
                const originalId = row.dataset.originalId || '';
                const label = row.querySelector('.col-label').value.trim();
                let colId = originalId;
                if (!colId && label) {
                    colId = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, '_');
                }
                if (colId) cols.push(colId);
            });
            return cols;
        }

        const HISTORY_DISPLAY_FORMULA = [
            "if not $HISTORY_RAW:",
            "    return ''",
            "text = $HISTORY_RAW",
            "result = []",
            "lines = text.split('\\n')",
            "for line in lines:",
            "    if line.strip().startswith('[SNAP:'):",
            "        continue",
            "    result.append(line)",
            "output = []",
            "prev_line_empty = False",
            "for line in result:",
            "    if line.strip() == '':",
            "        if not prev_line_empty:",
            "            output.append(line)",
            "            prev_line_empty = True",
            "    else:",
            "        output.append(line)",
            "        prev_line_empty = False",
            "return '\\n'.join(output)",
        ].join('\n');

        const HISTORY_RAW_PART1 = [
            "# =============================================================================",
            "# CHANGE HISTORY TRACKING SYSTEM",
            "# =============================================================================",
            "SHOW_COLUMNS_BY_TABLE = {",
            "    # 'MyTable': 'MY_DISPLAY_COLUMN',",
            "}",
            "",
            "",
            "def format_date(date_obj):",
            "    if not date_obj:",
            "        return ''",
            "    try:",
            "        months = {",
            "            1:'janv.', 2:'févr.', 3:'mars', 4:'avr.', 5:'mai', 6:'juin',",
            "            7:'juil.', 8:'août', 9:'sept.', 10:'oct.', 11:'nov.', 12:'déc.'",
            "        }",
            "        day = str(date_obj.day).zfill(2)",
            "        month_str = months.get(date_obj.month, str(date_obj.month))",
            "        year = str(date_obj.year)",
            "        return f\"{day} {month_str} {year}\"",
            "    except:",
            "        return str(date_obj)",
            "",
            "",
            "def extract_reference_display(ref_obj):",
            "    if not ref_obj or not hasattr(ref_obj, '_table'):",
            "        return None",
            "    try:",
            "        table_name = ref_obj._table.table_id if hasattr(ref_obj._table, 'table_id') else None",
            "        if table_name and table_name in SHOW_COLUMNS_BY_TABLE:",
            "            col_name = SHOW_COLUMNS_BY_TABLE[table_name]",
            "            if hasattr(ref_obj, col_name):",
            "                val = getattr(ref_obj, col_name, None)",
            "                if val is not None and not hasattr(val, '_table'):",
            "                    s = str(val).strip()",
            "                    if s and s != 'None':",
            "                        return s",
            "        if hasattr(ref_obj, 'gristHelper_Display'):",
            "            display = getattr(ref_obj, 'gristHelper_Display', None)",
            "            if display is not None and not hasattr(display, '_table'):",
            "                s = str(display).strip()",
            "                if s and s != 'None':",
            "                    return s",
            "        attrs = sorted([a for a in dir(ref_obj) if not a.startswith('_') and not a.startswith('#')])",
            "        business_cols = [a for a in attrs if a not in ['id', 'manualSort', 'isCompleted', 'isDuplicated'] and not a.startswith('gristHelper')]",
            "        for attr in business_cols:",
            "            try:",
            "                val = getattr(ref_obj, attr, None)",
            "                if val is None or hasattr(val, '_table') or isinstance(val, (list, tuple)):",
            "                    continue",
            "                if isinstance(val, str):",
            "                    s = val.strip()",
            "                    if s and s != 'None':",
            "                        return s",
            "            except:",
            "                continue",
            "        return str(ref_obj).strip()",
            "    except:",
            "        try:",
            "            return str(ref_obj).strip()",
            "        except:",
            "            return ''",
            "",
            "",
            "def format_value(col_name, val):",
            "    if val is None:",
            "        return ''",
            "    try:",
            "        if hasattr(val, 'day') and hasattr(val, 'month'):",
            "            return format_date(val)",
            "    except:",
            "        pass",
            "    if isinstance(val, bool):",
            "        return 'Yes' if val else 'No'",
            "    if isinstance(val, (list, tuple)):",
            "        if not val:",
            "            return ''",
            "        elements = []",
            "        for item in val:",
            "            display = extract_reference_display(item)",
            "            if display:",
            "                elements.append(display)",
            "            else:",
            "                s = str(item).strip()",
            "                if s and s != 'None' and not s.startswith('Record('):",
            "                    elements.append(s)",
            "        return ', '.join(elements) if elements else ''",
            "    if hasattr(val, '_table'):",
            "        display = extract_reference_display(val)",
            "        if display:",
            "            return display",
            "        return ''",
            "    try:",
            "        s = str(val).strip()",
            "        if not s or s == 'None':",
            "            return ''",
            "        if s.startswith('Record(') or s.startswith('[Record('):",
            "            return ''",
            "        if s == '[]':",
            "            return ''",
            "        return s",
            "    except:",
            "        return ''",
            "",
            "",
            "def get_columns():",
        ].join('\n');

        const HISTORY_RAW_PART2 = [
            "    return sorted(list(trackedC))",
            "",
            "",
            "def to_label(col_name):",
            "    words = col_name.replace('_', ' ').split()",
            "    return ' '.join(w if (w.isupper() and len(w) <= 5) else w.capitalize() for w in words)",
            "",
            "",
            "def timestamp():",
            "    t = NOW()",
            "    months = {",
            "        1:'janv.', 2:'févr.', 3:'mars', 4:'avr.', 5:'mai', 6:'juin',",
            "        7:'juil.', 8:'août', 9:'sept.', 10:'oct.', 11:'nov.', 12:'déc.'",
            "    }",
            "    day = str(t.day).zfill(2)",
            "    month_str = months[t.month]",
            "    year = str(t.year)",
            "    hour = str(t.hour).zfill(2)",
            "    minute = str(t.minute).zfill(2)",
            "    return f\"{day} {month_str} {year} {hour}:{minute}\"",
            "",
            "",
            "def get_username():",
            "    try:",
            "        return user.Name",
            "    except:",
            "        return \"Unknown\"",
            "",
            "",
            "def create_snapshot():",
            "    snap = {}",
            "    for col in get_columns():",
            "        try:",
            "            val = getattr(rec, col, None)",
            "            snap[col] = format_value(col, val)",
            "        except:",
            "            snap[col] = ''",
            "    return snap",
            "",
            "",
            "def encode_snapshot(snap):",
            "    import base64, json",
            "    data = json.dumps(snap, ensure_ascii=False)",
            "    encoded = base64.b64encode(data.encode('utf-8')).decode('ascii')",
            "    return f\"[SNAP:{encoded}]\"",
            "",
            "",
            "def decode_snapshot(text):",
            "    if not text or '[SNAP:' not in text:",
            "        return {}",
            "    try:",
            "        import base64, json",
            "        start = text.find('[SNAP:')",
            "        if start == -1:",
            "            return {}",
            "        end = text.find(']', start)",
            "        if end == -1:",
            "            return {}",
            "        encoded = text[start+6:end]",
            "        data = base64.b64decode(encoded.encode('ascii')).decode('utf-8')",
            "        return json.loads(data)",
            "    except:",
            "        return {}",
            "",
            "",
            "if not value:",
            "    snap = create_snapshot()",
            "    ts = timestamp()",
            "    usr = get_username()",
            "    lines = [f\"\u{1F4C5} Créé le {ts} (par {usr})\"]",
            "    for col in sorted(snap.keys()):",
            "        val = snap[col]",
            "        if val:",
            "            lines.append(f\"- {to_label(col)} : {val}\")",
            "    lines.append(\"\")",
            "    lines.append(encode_snapshot(snap))",
            "    return '\\n'.join(lines)",
            "",
            "else:",
            "    current_snap = create_snapshot()",
            "    prev_snap = decode_snapshot(value)",
            "    current_cols = set(current_snap.keys())",
            "    prev_cols = set(prev_snap.keys())",
            "    added_cols = current_cols - prev_cols",
            "    removed_cols = prev_cols - current_cols",
            "    changes = []",
            "    for col in sorted(removed_cols):",
            "        label = to_label(col)",
            "        old_val = prev_snap.get(col, '')",
            "        if old_val:",
            "            changes.append(f\"  - \u{1F5D1}\u{FE0F} {label} : column removed (old value: {old_val})\")",
            "        else:",
            "            changes.append(f\"  - \u{1F5D1}\u{FE0F} {label} : column removed\")",
            "    for col in sorted(added_cols):",
            "        new_val = current_snap[col]",
            "        if new_val:",
            "            label = to_label(col)",
            "            changes.append(f\"  - \u{2795} {label} : new column added ({new_val})\")",
            "    for col in sorted(current_cols & prev_cols):",
            "        new_val = current_snap[col]",
            "        old_val = prev_snap.get(col, '')",
            "        if new_val != old_val:",
            "            label = to_label(col)",
            "            if old_val and new_val:",
            "                changes.append(f\"  - {label} : {old_val} \u{2192} {new_val}\")",
            "            elif new_val:",
            "                changes.append(f\"  - {label} : {new_val}\")",
            "            elif old_val:",
            "                changes.append(f\"  - {label} : (removed)\")",
            "    if not changes:",
            "        return value",
            "    ts = timestamp()",
            "    usr = get_username()",
            "    new_entry = [",
            "        f\"\u{1F449} Modifié le {ts} ({usr})\",",
            "        '\\n'.join(changes),",
            "        \"\",",
            "        encode_snapshot(current_snap),",
            "        \"\"",
            "    ]",
            "    return '\\n'.join(new_entry) + '\\n' + value",
        ].join('\n');

        function buildHistoryRawFormula(trackedCols) {
            const colsList = trackedCols.map(c => `"${c}"`).join(', ');
            const dynamicLine = `    trackedC = [${colsList}]`;
            return HISTORY_RAW_PART1 + '\n' + dynamicLine + '\n' + HISTORY_RAW_PART2;
        }

        // Payload complet pour ModifyColumn (colonnes existantes ou formules standard)
        function buildModifyPayload(c) {
            const payload = {
                label: c.label,
                // norme : changer le libellé ne renomme jamais l'identifiant (les widgets et règles l'utilisent)
                untieColIdFromLabel: true,
                type: c.type,
                formula: c.formula,
                isFormula: c.isFormula,
                recalcWhen: c.recalcWhen,
            };
            if (c.widgetOptions) payload.widgetOptions = c.widgetOptions;
            return payload;
        }

        // Payload réduit pour ModifyColumn après AddColumn sur colonne recalcWhen=2
        function buildTriggerPayload(c) {
            return {
                formula: c.formula,
                isFormula: false,
                recalcWhen: 2,
            };
        }

        function regenerateHistoryFormula() {
            const rows = document.querySelectorAll('#columnsContainer tr');
            rows.forEach(row => {
                if (row.dataset.originalId === 'HISTORY_RAW' || row.querySelector('.col-label')?.value.trim() === 'HISTORY_RAW') {
                    const trackedCols = getTrackedColumns();
                    row.querySelector('.col-formula').value = buildHistoryRawFormula(trackedCols);
                }
            });
        }

        function addHistoryColumns() {
            // Pré-cocher toutes les colonnes non-formule déjà présentes
            const rows = document.querySelectorAll('#columnsContainer tr');
            rows.forEach(row => {
                const originalId = row.dataset.originalId || '';
                const label = row.querySelector('.col-label').value.trim();
                let colId = originalId;
                if (!colId && label) {
                    colId = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, '_');
                }
                const formula = row.querySelector('.col-formula').value.trim();
                const triggerCreate = row.querySelector('.col-trigger-create').checked;
                const triggerUpdate = row.querySelector('.col-trigger-update').checked;
                const isFormula = formula && !triggerCreate && !triggerUpdate;
                const trackCb = row.querySelector('.col-track-history');
                if (trackCb && !trackCb.disabled) {
                    if (!isExcludedFromHistory(colId, formula, isFormula)) {
                        trackCb.checked = true;
                    }
                }
            });

            const trackedCols = getTrackedColumns();
            const historyRawFormula = buildHistoryRawFormula(trackedCols);

            // Ajouter HISTORY_RAW (trigger à chaque modification)
            addColumnRow('HISTORY_RAW', 'Text', historyRawFormula, false, true, '', '');
            const allRows = document.querySelectorAll('#columnsContainer tr');
            const lastRow = allRows[allRows.length - 1];
            lastRow.dataset.originalId = 'HISTORY_RAW';
            const lastTrackCb = lastRow.querySelector('.col-track-history');
            if (lastTrackCb) { lastTrackCb.checked = false; lastTrackCb.disabled = true; }

            // Ajouter HISTORY (formule standard)
            addColumnRow('HISTORY', 'Text', HISTORY_DISPLAY_FORMULA, false, false, '', '');
            const allRows2 = document.querySelectorAll('#columnsContainer tr');
            const lastRow2 = allRows2[allRows2.length - 1];
            lastRow2.dataset.originalId = 'HISTORY';
            const lastTrackCb2 = lastRow2.querySelector('.col-track-history');
            if (lastTrackCb2) { lastTrackCb2.checked = false; lastTrackCb2.disabled = true; }

            updateHistoryColumnVisibility();
        }

        // =====================================================================
        // ENREGISTREMENT
        // =====================================================================

        /** Les lignes du formulaire, traduites en colonnes Grist (identifiant, type, formule, déclencheur). */
        function lireFormulaire(tableChoisie) {
            const colonnes = [];
            for (const row of document.querySelectorAll('#columnsContainer tr')) {
                const label = row.querySelector('.col-label').value.trim();
                const selectedType = row.querySelector('.col-type').value;
                const originalType = row.dataset.originalType || '';
                // garder le type complet s'il est plus précis que celui de la liste (ex. Ref:Clients)
                const type = (originalType && originalType.startsWith(selectedType) && originalType !== selectedType)
                    ? originalType : selectedType;
                const formula = row.querySelector('.col-formula').value.trim();
                const checkCreate = row.querySelector('.col-trigger-create').checked;
                const checkUpdate = row.querySelector('.col-trigger-update').checked;
                const originalId = row.dataset.originalId || '';
                const internalId = row.dataset.internalId || '';
                const id = originalId || row.dataset.idPropose || identifiant(label);
                if (!id) continue;

                let isFormula = false, recalcWhen = 0;
                if (formula) {
                    if (checkUpdate) recalcWhen = 2;          // recalculée à chaque modification de la ligne
                    else if (!checkCreate) isFormula = true;  // colonne formule
                }
                // Colonne existante dont ni la formule ni les cases n'ont bougé : on garde son réglage exact
                // (colonne formule encore vide, déclencheur « jamais »…) au lieu de la convertir par erreur.
                const original = internalId ? (tablesCache[tableChoisie] || []).find(c => c.id === originalId) : null;
                if (original && formula === (original.formula || '').trim()
                    && checkCreate === (row.dataset.triggerCreate === '1') && checkUpdate === (row.dataset.triggerUpdate === '1')) {
                    isFormula = original.isFormula;
                    recalcWhen = original.recalcWhen;
                }
                colonnes.push({ id, label: label || id, type, formula, isFormula, recalcWhen, originalId, internalId,
                    widgetOptions: row.dataset.widgetOptions || '', original });
            }
            return colonnes;
        }

        /** Contrôles avant toute écriture : renvoie la liste des problèmes (vide si tout va bien). */
        function controler(colonnes, tableId, nouvelle, tablesExistantes) {
            const erreurs = [];
            if (nouvelle) {
                if (!tableId) erreurs.push('donnez un nom à la nouvelle table');
                else if (tablesExistantes.some(t => t.toLowerCase() === tableId.toLowerCase())) {
                    erreurs.push(`la table ${tableId} existe déjà : choisissez-la dans la liste pour la modifier`);
                }
            }
            const existantes = new Set(nouvelle ? [] : (tablesCache[tableId] || []).map(c => c.id.toLowerCase()));
            const vus = new Set();
            for (const c of colonnes) {
                const cle = c.id.toLowerCase();
                if (vus.has(cle)) erreurs.push(`la colonne ${c.id} apparaît deux fois`);
                vus.add(cle);
                if (c.internalId) continue;
                if (existantes.has(cle)) erreurs.push(`la colonne ${c.id} existe déjà dans ${tableId}`);
                if (/^(e_?mail|mail)/i.test(c.id)) erreurs.push(`« ${c.label} » : la norme demande « Courriel », pas Email ni Mail`);
            }
            return erreurs;
        }

        /** Une colonne a-t-elle changé par rapport au document ? */
        function aChange(c) {
            const o = c.original;
            return !o || o.label !== c.label || o.type !== c.type || (o.formula || '').trim() !== c.formula
                || o.isFormula !== c.isFormula || o.recalcWhen !== c.recalcWhen;
        }

        /** Actions Grist pour ajouter une colonne : création, puis formule ou déclencheur. */
        function actionsAjout(tableId, c) {
            // isFormula: false, sinon Grist crée une « colonne formule vide » au lieu d'une colonne de données
            const info = { label: c.label, type: c.type, isFormula: false, untieColIdFromLabel: true };
            if (c.widgetOptions) info.widgetOptions = c.widgetOptions;
            const actions = [['AddColumn', tableId, c.id, info]];
            if (c.formula) {
                actions.push(['ModifyColumn', tableId, c.id, c.recalcWhen === 2 ? buildTriggerPayload(c) : buildModifyPayload(c)]);
            }
            // Grist ignore ce réglage à la création : on le pose juste après, pour toutes les colonnes
            actions.push(['ModifyColumn', tableId, c.id, { untieColIdFromLabel: true }]);
            return actions;
        }

        /**
         * Applique le formulaire en UNE seule opération Grist : tout passe ou rien ne change, et le
         * bouton ↶ de Grist annule l'ensemble d'un coup. Les contrôles sont faits avant d'écrire.
         */
        async function saveStructure() {
            const select = document.getElementById('tableSelect');
            const saveBtn = document.getElementById('saveBtn');
            const nouvelle = select.value === '__NEW__';
            const tableId = nouvelle ? identifiant(document.getElementById('newTableName').value) : select.value;

            const colonnes = lireFormulaire(select.value);
            if (!colonnes.length) return avis('Indiquez au moins une colonne.', 'erreur');

            saveBtn.disabled = true;
            saveBtn.textContent = 'Application…';
            try {
                const tablesExistantes = (await grist.docApi.fetchTable('_grist_Tables')).tableId;
                const erreurs = controler(colonnes, tableId, nouvelle, tablesExistantes);
                if (erreurs.length) return avis("Rien n'a été modifié : " + erreurs.join(' ; ') + '.', 'erreur');

                // ordre : colonnes ordinaires, puis celles recalculées à chaque modification, puis la
                // traçabilité (en fin de table, comme le veut la norme), puis HISTORY_RAW, et HISTORY en
                // dernier (elle lit HISTORY_RAW)
                const TRACES = ['CreeLe', 'CreePar', 'ModifieLe', 'ModifiePar'];
                const rang = c => c.id === 'HISTORY' ? 4 : c.id === 'HISTORY_RAW' ? 3 : TRACES.includes(c.id) ? 2
                    : c.recalcWhen === 2 ? 1 : 0;
                const ajouts = colonnes.filter(c => !c.internalId).sort((a, b) => rang(a) - rang(b));
                const modifs = colonnes.filter(c => c.internalId && aChange(c)).sort((a, b) => rang(a) - rang(b));

                const actions = [];
                if (nouvelle) actions.push(['AddTable', tableId, []]);
                for (const c of ajouts) actions.push(...actionsAjout(tableId, c));
                for (const c of modifs) actions.push(['ModifyColumn', tableId, c.originalId, buildModifyPayload(c)]);
                if (!nouvelle && !actions.length) return avis('Aucune modification à appliquer.', 'info');

                // Aperçu : la liste en clair de ce qui va changer, à confirmer avant d'écrire
                if (!(await demander(apercu(tableId, nouvelle, ajouts, modifs), { ok: 'Appliquer' }))) return avis('Rien n\'a été modifié.', 'info');

                document.getElementById('info').textContent = '';
                // écriture par le noyau : elle est notée au journal d'administration
                await Console.ecrire(actions, nouvelle ? 'Table créée' : 'Table modifiée',
                    tableId + ' : ' + ajouts.length + ' colonne(s) ajoutée(s), ' + modifs.length + ' modifiée(s)');

                await loadTables(tableId);
                avis(nouvelle
                    ? `Table ${tableId} créée avec ${ajouts.length} colonne(s) ; Grist lui a ajouté une page dans le menu.`
                    : `${tableId} : ${ajouts.length} colonne(s) ajoutée(s), ${modifs.length} modifiée(s). Pensez à afficher les nouvelles colonnes dans vos vues.`,
                    'ok');
            } catch (err) {
                avis("Rien n'a été modifié (Grist a refusé l'opération) : " + err.message, 'erreur');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Appliquer les modifications';
            }
        }


        // premier chargement de la liste des tables
        init();
