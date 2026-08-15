let currentUser = null;
let notasAtuais = []; 
let eventosAtuais = [];
let materiaisAtuais = []; 
let dataCalendario = new Date(); 
let diaFaltaSelecionado = null; 

async function checkAuth() {
    const { data: { session }, error } = await window.supabase.auth.getSession();
    if (error || !session) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = session.user;
    
    carregarAnotacoes();
    renderizarCalendario();
    carregarDashboardFaltas(); 
    carregarDatas(); 
    carregarMateriais(); 
}

// ==========================================
// ABRIR NOTA PARA LEITURA
// ==========================================
window.abrirNotaCompleta = function(idNota) {
    const nota = notasAtuais.find(n => n.id === idNota);
    if (!nota) return;

    document.getElementById('nota-atual-id').value = nota.id;
    document.getElementById('read-materia').innerText = nota.disciplina;
    document.getElementById('read-autor').innerText = nota.nome_autor;
    
    const dataObj = new Date(nota.created_at);
    document.getElementById('read-data').innerText = `${String(dataObj.getDate()).padStart(2, '0')}/${String(dataObj.getMonth() + 1).padStart(2, '0')}`;
    
    const textAreaLeitura = document.getElementById('read-texto-nota');
    textAreaLeitura.value = nota.conteudo;
    textAreaLeitura.readOnly = true; 
    textAreaLeitura.style.border = "1px solid var(--gray-border)";

    const btnEditar = document.getElementById('btn-editar-nota');
    if (btnEditar) {
        btnEditar.innerText = 'EDITAR';
        btnEditar.style.backgroundColor = 'var(--navy-blue)';
    }

    document.getElementById('notes-grid').classList.add('hidden');
    document.getElementById('anotacoes-header').classList.add('hidden');
    
    const readView = document.getElementById('read-note-view');
    readView.classList.remove('hidden');
    readView.style.display = 'flex';
};

function renderizarCards(data) {
    const notesGrid = document.getElementById('notes-grid');
    notesGrid.innerHTML = '';
    notasAtuais = data; 

    if (!data || data.length === 0) {
        notesGrid.innerHTML = '<p style="color: var(--navy-blue); font-weight: bold; grid-column: span 2;">Nenhuma anotação encontrada.</p>';
        return;
    }

    data.forEach(nota => {
        const dataCriacao = new Date(nota.created_at);
        const dia = String(dataCriacao.getDate()).padStart(2, '0');
        const mes = String(dataCriacao.getMonth() + 1).padStart(2, '0');
        const corCard = nota.disciplina.length % 2 === 0 ? 'card-navy' : 'card-salmon';
        const conteudoEscapado = nota.conteudo.replace(/"/g, '&quot;');

        const cardHTML = `
            <div class="card ${corCard}" onclick="abrirNotaCompleta('${nota.id}')">
                <div class="card-tag">Matéria: ${nota.disciplina.toUpperCase()}</div>
                <div class="card-date">Criado em: ${dia}/${mes}</div>
                <p class="card-text">${conteudoEscapado}</p>
                <div class="card-footer">
                    <span>Criado por: ${nota.nome_autor}</span>
                    <p class="btn-opcoes" onclick="event.stopPropagation(); abrirNotaCompleta('${nota.id}')">⋮</p>
                </div>
            </div>
        `;
        notesGrid.insertAdjacentHTML('beforeend', cardHTML);
    });
}

async function carregarAnotacoes() {
    const notesGrid = document.getElementById('notes-grid');
    if (!notesGrid) return;
    notesGrid.innerHTML = '<p style="color: var(--navy-blue); font-weight: bold; grid-column: span 2;">Carregando anotações...</p>';

    const { data, error } = await window.supabase.from('anotacoes').select('*').order('created_at', { ascending: false });
    if (error) {
        notesGrid.innerHTML = '<p style="color: var(--salmon); font-weight: bold; grid-column: span 2;">Erro ao carregar as anotações.</p>';
        return;
    }
    renderizarCards(data);
}

// ==========================================
// LÓGICA DO CALENDÁRIO E FALTAS
// ==========================================
async function buscarDiasComFalta(ano, mes) {
    if (!currentUser) return [];
    const { data } = await window.supabase.from('faltas').select('data_falta, disciplina')
        .eq('user_id', currentUser.id)
        .gte('data_falta', `${ano}-${String(mes + 1).padStart(2, '0')}-01`)
        .lte('data_falta', `${ano}-${String(mes + 1).padStart(2, '0')}-31`);
    return data || [];
}

async function renderizarCalendario() {
    const calendarGrid = document.getElementById('calendar-grid');
    const mesAtualDisplay = document.getElementById('mes-atual-display');
    if (!calendarGrid) return;
    
    calendarGrid.innerHTML = ''; 
    const ano = dataCalendario.getFullYear();
    const mes = dataCalendario.getMonth();
    const nomesMeses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    if(mesAtualDisplay) mesAtualDisplay.innerText = `${nomesMeses[mes]} ${ano}`;

    const primeiroDiaMes = new Date(ano, mes, 1).getDay();
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const faltasDoMes = await buscarDiasComFalta(ano, mes);

    for (let i = 0; i < primeiroDiaMes; i++) calendarGrid.insertAdjacentHTML('beforeend', `<div></div>`);

    for (let dia = 1; dia <= diasNoMes; dia++) {
        const divDia = document.createElement('div');
        divDia.innerText = String(dia).padStart(2, '0');
        divDia.style.position = 'relative'; 
        
        const dataAtualLoop = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const faltaNoDia = faltasDoMes.find(f => f.data_falta === dataAtualLoop);
        
        if (faltaNoDia) {
            divDia.classList.add('day-marked');
            faltaNoDia.disciplina.length % 2 === 0 ? divDia.classList.add('card-navy') : divDia.classList.add('card-salmon');
        }
        
        divDia.addEventListener('click', (e) => abrirPopUpFalta(dia, mes, ano, e.target));
        calendarGrid.appendChild(divDia);
    }
}

async function abrirPopUpFalta(dia, mes, ano, elementoClicado) {
    const popupFalta = document.getElementById('popup-falta');
    if (!popupFalta) return;
    
    popupFalta.innerHTML = '<p style="text-align: center; color: var(--navy-blue);">Carregando...</p>';
    popupFalta.classList.remove('hidden');
    
    const rect = elementoClicado.getBoundingClientRect();
    const calendarRect = document.querySelector('.calendar-container').getBoundingClientRect();
    
    popupFalta.style.top = `${rect.bottom - calendarRect.top + 10}px`;
    popupFalta.style.left = `${rect.left - calendarRect.left}px`;
    
    diaFaltaSelecionado = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

    let faltasNesteDia = [];
    if (currentUser) {
        const { data } = await window.supabase.from('faltas').select('disciplina, id').eq('user_id', currentUser.id).eq('data_falta', diaFaltaSelecionado);
        if (data) faltasNesteDia = data;
    }

    const materias = [
       "Semiótica", "Planejamento e Produção Gráfica", 
        "Design Visual e Serviços", "Editorial", "Edição e Criação", "Legislação e Gestão do Design"
    ];

    let htmlBotoes = '';
    materias.forEach(materia => {
        const faltaExistente = faltasNesteDia.find(f => f.disciplina === materia);
        if (faltaExistente) htmlBotoes += `<button class="btn-primary w-100 btn-falta-acao" data-materia="${materia}" data-acao="excluir" data-id="${faltaExistente.id}">${materia} (✓)</button>`;
        else htmlBotoes += `<button class="btn-outline w-100 btn-falta-acao" data-materia="${materia}" data-acao="salvar">${materia}</button>`;
    });

    htmlBotoes += `<div id="btn-cancelar-popup" style="text-align: right; margin-top: 10px; cursor: pointer; color: var(--navy-blue); font-weight: 600;">Cancelar</div>`;
    popupFalta.innerHTML = htmlBotoes;
    configurarEventosPopUp();
}

function configurarEventosPopUp() {
    const botoesAcao = document.querySelectorAll('.btn-falta-acao');
    botoesAcao.forEach(botao => {
        botao.addEventListener('click', async (e) => {
            const acao = e.currentTarget.getAttribute('data-acao');
            const materia = e.currentTarget.getAttribute('data-materia');
            const textoOriginal = e.currentTarget.innerText;
            e.currentTarget.innerText = "Processando...";
            e.currentTarget.disabled = true;

            if (acao === 'salvar') await registrarFalta(materia);
            else if (acao === 'excluir') {
                const idFalta = e.currentTarget.getAttribute('data-id');
                await excluirFalta(idFalta, materia);
            }
        });
    });

    const btnCancelar = document.getElementById('btn-cancelar-popup');
    if (btnCancelar) btnCancelar.addEventListener('click', () => document.getElementById('popup-falta').classList.add('hidden'));
}

async function registrarFalta(disciplina) {
    if (!diaFaltaSelecionado || !currentUser) return;
    const { error } = await window.supabase.from('faltas').insert([{ user_id: currentUser.id, disciplina: disciplina, data_falta: diaFaltaSelecionado, limite_faltas: 20 }]);
    if (error) alert("Erro ao salvar a falta. Tente novamente.");
    else {
        document.getElementById('popup-falta').classList.add('hidden');
        diaFaltaSelecionado = null;
        carregarDashboardFaltas();
        renderizarCalendario();
    }
}

async function excluirFalta(id, disciplina) {
    if (!currentUser) return;
    const { error } = await window.supabase.from('faltas').delete().eq('id', id);
    if (error) alert("Erro ao remover a falta.");
    else {
        document.getElementById('popup-falta').classList.add('hidden');
        diaFaltaSelecionado = null;
        carregarDashboardFaltas();
        renderizarCalendario();
    }
}

async function carregarDashboardFaltas() {
    if (!currentUser) return;
    const dashboardContainer = document.querySelector('.dashboard-grid');
    if (!dashboardContainer) return;

    const { data, error } = await window.supabase.from('faltas').select('*').eq('user_id', currentUser.id);
    if (error) return;

    const materiasPadrao = [
        "Semiótica", "Planejamento e Produção Gráfica", 
        "Design Visual e Serviços", "Editorial", "Edição e Criação", "Legislação e Gestão do Design"
    ];

    let faltasPorDisciplina = {};
    if (data && data.length > 0) faltasPorDisciplina = data.reduce((acc, falta) => { acc[falta.disciplina] = (acc[falta.disciplina] || 0) + 1; return acc; }, {});

    dashboardContainer.innerHTML = '';
    materiasPadrao.forEach((disciplina, index) => {
        const quantidade = faltasPorDisciplina[disciplina] || 0;
        const corCard = index % 2 === 0 ? 'card-salmon' : 'card-navy';
        const cardHTML = `<div class="dash-card ${corCard}"><div class="dash-number">${quantidade}</div><div class="dash-label">faltas p/ aula</div><div class="dash-subject">${disciplina.toUpperCase()}</div></div>`;
        dashboardContainer.insertAdjacentHTML('beforeend', cardHTML);
    });
}

// ==========================================
// LÓGICA DE DATAS IMPORTANTES
// ==========================================
function renderizarCardsDatas(data) {
    const datasGrid = document.getElementById('datas-grid');
    datasGrid.innerHTML = '';
    eventosAtuais = data; 

    if (!data || data.length === 0) {
        datasGrid.innerHTML = '<p style="color: var(--navy-blue); font-weight: bold; grid-column: span 2;">Nenhum evento importante cadastrado.</p>';
        return;
    }

    data.forEach(evento => {
        const [ano, mes, dia] = evento.data_entrega.split('-');
        const corCard = evento.disciplina.length % 2 === 0 ? 'card-navy' : 'card-salmon';
        const cardHTML = `
            <div class="card ${corCard}" style="cursor: pointer;" onclick="abrirEdicaoEvento('${evento.id}')">
                <div class="card-tag">Matéria: ${evento.disciplina.toUpperCase()}</div>
                <h3 style="margin-top: 15px; font-size: 1.1rem; font-weight: normal;">${evento.titulo}</h3>
                <h2 style="font-size: 1.8rem; margin: 5px 0;">Entrega: ${dia}/${mes}</h2>
                <div class="card-footer" style="margin-top: auto; padding-top: 20px;">
                    <span>Criado por: ${evento.nome_autor}</span>
                    <p class="btn-opcoes" onclick="event.stopPropagation(); abrirEdicaoEvento('${evento.id}')">⋮</p>
                </div>
            </div>
        `;
        datasGrid.insertAdjacentHTML('beforeend', cardHTML);
    });
}

window.abrirEdicaoEvento = function(idEvento) {
    const evento = eventosAtuais.find(e => e.id === idEvento);
    if (!evento) return;

    document.getElementById('edit-data-id').value = evento.id;
    document.getElementById('edit-select-materia-data').value = evento.disciplina;
    document.getElementById('edit-titulo-data').value = evento.titulo;
    document.getElementById('edit-data-entrega').value = evento.data_entrega;

    document.getElementById('datas-grid').classList.add('hidden');
    document.querySelector('#datas .top-bar').classList.add('hidden'); 
    document.querySelector('#datas .section-header').classList.add('hidden'); 
    document.getElementById('edit-data-form').classList.remove('hidden');
};

async function carregarDatas() {
    const datasGrid = document.getElementById('datas-grid');
    if (!datasGrid) return;
    datasGrid.innerHTML = '<p style="color: var(--navy-blue); font-weight: bold; grid-column: span 2;">Carregando eventos...</p>';

    const { data, error } = await window.supabase.from('datas').select('*').order('data_entrega', { ascending: true });
    if (error) {
        datasGrid.innerHTML = '<p style="color: var(--salmon); font-weight: bold; grid-column: span 2;">Erro ao carregar os eventos.</p>';
        return;
    }
    renderizarCardsDatas(data);
}

// ==========================================
// LÓGICA DE MATERIAIS / ARQUIVOS
// ==========================================
function renderizarCardsMateriais(data) {
    const materiaisGrid = document.getElementById('materiais-grid');
    materiaisGrid.innerHTML = '';
    materiaisAtuais = data;

    if (!data || data.length === 0) {
        materiaisGrid.innerHTML = '<p style="color: var(--navy-blue); font-weight: bold; grid-column: span 2;">Nenhum material encontrado.</p>';
        return;
    }

    data.forEach(material => {
        const dataUpload = new Date(material.created_at);
        const dia = String(dataUpload.getDate()).padStart(2, '0');
        const mes = String(dataUpload.getMonth() + 1).padStart(2, '0');
        const corCard = material.disciplina.length % 2 === 0 ? 'card-navy' : 'card-salmon';

        const cardHTML = `
            <div class="card ${corCard}">
                <div class="card-tag">Matéria: ${material.disciplina.toUpperCase()}</div>
                <h3 style="margin-top: 15px; font-size: 1.1rem; font-weight: normal;">${material.titulo}</h3>
                <p style="font-size: 0.8rem; margin-top: 5px; opacity: 0.8;">Arquivo: ${material.arquivo_nome}</p>
                <div style="margin-top: auto; padding-top: 20px;">
                    <a href="${material.arquivo_url}" target="_blank" download style="text-decoration: none;">
                        <button class="btn-outline w-100" style="background-color: white; color: var(--navy-blue); display: flex; justify-content: center; align-items: center; gap: 10px;">
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                           Baixar Arquivo
                        </button>
                    </a>
                </div>
                <div class="card-footer" style="margin-top: 15px;">
                    <span>Enviado por: ${material.nome_autor} (${dia}/${mes})</span>
                    <p class="btn-opcoes" style="cursor: pointer; padding-left: 10px;" onclick="event.stopPropagation(); abrirEdicaoMaterial('${material.id}')">⋮</p>
                </div>
            </div>
        `;
        materiaisGrid.insertAdjacentHTML('beforeend', cardHTML);
    });
}

window.abrirEdicaoMaterial = function(idMaterial) {
    const material = materiaisAtuais.find(m => m.id === idMaterial);
    if (!material) return;

    document.getElementById('edit-material-id').value = material.id;
    document.getElementById('edit-select-materia-material').value = material.disciplina;
    document.getElementById('edit-titulo-material').value = material.titulo;
    
    const urlParts = material.arquivo_url.split('/materiais-aulas/');
    if(urlParts.length > 1) document.getElementById('edit-material-filepath').value = urlParts[1];
    else document.getElementById('edit-material-filepath').value = ""; 

    document.getElementById('materiais-grid').classList.add('hidden');
    document.getElementById('materiais-header').classList.add('hidden');
    document.getElementById('edit-material-form').classList.remove('hidden');
};

async function carregarMateriais() {
    const materiaisGrid = document.getElementById('materiais-grid');
    if (!materiaisGrid) return;
    materiaisGrid.innerHTML = '<p style="color: var(--navy-blue); font-weight: bold; grid-column: span 2;">Carregando materiais...</p>';

    const { data, error } = await window.supabase.from('materiais').select('*').order('created_at', { ascending: false });
    if (error) {
        materiaisGrid.innerHTML = '<p style="color: var(--salmon); font-weight: bold; grid-column: span 2;">Erro ao carregar os materiais.</p>';
        return;
    }
    renderizarCardsMateriais(data);
}

// ==========================================
// INICIALIZAÇÃO E EVENTOS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    // Navegação de Abas
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            tabContents.forEach(tab => {
                tab.classList.add('hidden');
                tab.classList.remove('active');
            });
            const targetId = item.getAttribute('data-target');
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.classList.remove('hidden');
                targetElement.classList.add('active');
            }
        });
    });

    // SISTEMA DE PESQUISA E FILTRO DE ANOTAÇÕES
    const searchNotesInput = document.getElementById('search-notes');
    if (searchNotesInput) {
        searchNotesInput.addEventListener('input', (e) => {
            const termo = e.target.value.toLowerCase().trim();
            const notasFiltradas = notasAtuais.filter(nota => {
                return nota.conteudo.toLowerCase().includes(termo) || nota.disciplina.toLowerCase().includes(termo) || nota.nome_autor.toLowerCase().includes(termo);
            });
            if (termo === '') {
                const materiaSelecionada = document.getElementById('select-filtro-materia').value;
                if (materiaSelecionada !== 'Todas') {
                    renderizarCards(notasAtuais.filter(n => n.disciplina === materiaSelecionada));
                    return;
                }
                renderizarCards(notasAtuais); 
                return;
            }
            renderizarCards(notasFiltradas);
        });
    }

    const btnAbrirFiltro = document.getElementById('btn-abrir-filtro');
    const popupFiltro = document.getElementById('popup-filtro-materia');
    const btnAplicarFiltro = document.getElementById('btn-aplicar-filtro');
    const btnLimparFiltro = document.getElementById('btn-limpar-filtro');
    const selectFiltro = document.getElementById('select-filtro-materia');

    if (btnAbrirFiltro && popupFiltro) {
        btnAbrirFiltro.addEventListener('click', () => popupFiltro.classList.toggle('hidden'));

        btnAplicarFiltro.addEventListener('click', () => {
            const materiaSelecionada = selectFiltro.value;
            popupFiltro.classList.add('hidden'); 
            if(searchNotesInput) searchNotesInput.value = '';
            if (materiaSelecionada === 'Todas') {
                renderizarCards(notasAtuais); 
                btnAbrirFiltro.style.backgroundColor = "transparent";
                btnAbrirFiltro.style.color = "var(--navy-blue)";
            } else {
                renderizarCards(notasAtuais.filter(n => n.disciplina === materiaSelecionada));
                btnAbrirFiltro.style.backgroundColor = "var(--navy-blue)";
                btnAbrirFiltro.style.color = "white";
            }
        });

        btnLimparFiltro.addEventListener('click', () => {
            selectFiltro.value = 'Todas';
            btnAplicarFiltro.click(); 
        });

        document.addEventListener('click', (e) => {
            if (!popupFiltro.contains(e.target) && e.target !== btnAbrirFiltro) {
                popupFiltro.classList.add('hidden');
            }
        });
    }

    // Criar e Ler Anotação
    const btnCriarNota = document.getElementById('btn-criar-nota');
    const btnVoltarNotas = document.getElementById('btn-voltar-notas');
    const notesGridElement = document.getElementById('notes-grid');
    const createNoteForm = document.getElementById('create-note-form');
    const anotacoesHeader = document.getElementById('anotacoes-header');

    if(btnCriarNota && btnVoltarNotas) {
        btnCriarNota.addEventListener('click', () => {
            notesGridElement.classList.add('hidden');
            if (anotacoesHeader) anotacoesHeader.classList.add('hidden');
            createNoteForm.classList.remove('hidden');
            createNoteForm.style.display = 'flex'; 
        });
        btnVoltarNotas.addEventListener('click', () => {
            createNoteForm.classList.add('hidden');
            createNoteForm.style.display = 'none'; 
            if (anotacoesHeader) anotacoesHeader.classList.remove('hidden');
            notesGridElement.classList.remove('hidden');
        });
    }

    const btnSalvarNota = document.getElementById('btn-salvar-nota');
    if (btnSalvarNota) {
        btnSalvarNota.addEventListener('click', async () => {
            const conteudoNota = document.getElementById('texto-nota').value;
            const materiaSelecionada = document.getElementById('select-materia').value;

            if (!conteudoNota.trim()) { alert("A anotação não pode estar vazia!"); return; }

            const textoOriginal = btnSalvarNota.innerText;
            btnSalvarNota.innerText = "Salvando...";
            btnSalvarNota.disabled = true;

            const nomeAutor = currentUser.user_metadata?.full_name || 'Aluno';
            const { error } = await window.supabase.from('anotacoes').insert([{ user_id: currentUser.id, nome_autor: nomeAutor, disciplina: materiaSelecionada, conteudo: conteudoNota, professor: 'Não informado' }]);

            btnSalvarNota.innerText = textoOriginal;
            btnSalvarNota.disabled = false;

            if (error) alert("Erro ao salvar a anotação.");
            else {
                document.getElementById('texto-nota').value = '';
                createNoteForm.classList.add('hidden');
                createNoteForm.style.display = 'none'; 
                if (anotacoesHeader) anotacoesHeader.classList.remove('hidden');
                notesGridElement.classList.remove('hidden');
                carregarAnotacoes();
            }
        });
    }

    const btnFecharLeitura = document.getElementById('btn-fechar-leitura');
    const readNoteView = document.getElementById('read-note-view');
    if (btnFecharLeitura) {
        btnFecharLeitura.addEventListener('click', () => {
            readNoteView.classList.add('hidden');
            readNoteView.style.display = 'none';
            document.getElementById('anotacoes-header').classList.remove('hidden');
            document.getElementById('notes-grid').classList.remove('hidden');
        });
    }

    const btnEditarNota = document.getElementById('btn-editar-nota');
    if (btnEditarNota) {
        btnEditarNota.addEventListener('click', async () => {
            const textArea = document.getElementById('read-texto-nota');
            const idNota = document.getElementById('nota-atual-id').value;

            if (textArea.readOnly) {
                textArea.readOnly = false;
                textArea.style.border = "2px solid var(--navy-blue)";
                textArea.focus();
                btnEditarNota.innerText = "SALVAR ALTERAÇÃO";
                btnEditarNota.style.backgroundColor = "green";
            } else {
                const novoConteudo = textArea.value;
                if (!novoConteudo.trim()) { alert("A nota não pode ficar vazia."); return; }

                btnEditarNota.innerText = "Salvando...";
                btnEditarNota.disabled = true;

                const { error } = await window.supabase.from('anotacoes').update({ conteudo: novoConteudo }).eq('id', idNota);
                btnEditarNota.disabled = false;

                if (error) { alert("Erro ao editar nota."); btnEditarNota.innerText = "SALVAR ALTERAÇÃO"; } 
                else {
                    textArea.readOnly = true;
                    textArea.style.border = "1px solid var(--gray-border)";
                    btnEditarNota.innerText = "EDITAR";
                    btnEditarNota.style.backgroundColor = "var(--navy-blue)";
                    carregarAnotacoes(); 
                }
            }
        });
    }

    const btnExcluirNota = document.getElementById('btn-excluir-nota');
    if (btnExcluirNota) {
        btnExcluirNota.addEventListener('click', async () => {
            const idNota = document.getElementById('nota-atual-id').value;
            if (confirm("Tem certeza que deseja excluir esta anotação para sempre?")) {
                btnExcluirNota.innerText = "Excluindo...";
                btnExcluirNota.disabled = true;
                const { error } = await window.supabase.from('anotacoes').delete().eq('id', idNota);
                btnExcluirNota.innerText = "EXCLUIR";
                btnExcluirNota.disabled = false;
                if (error) alert("Erro ao excluir nota.");
                else { btnFecharLeitura.click(); carregarAnotacoes(); }
            }
        });
    }

    // Datas Importantes
    const btnCriarEvento = document.getElementById('btn-criar-evento');
    const btnVoltarDatas = document.getElementById('btn-voltar-datas');
    const datasGridElement = document.getElementById('datas-grid');
    const createDataForm = document.getElementById('create-data-form');

    if(btnCriarEvento && btnVoltarDatas) {
        btnCriarEvento.addEventListener('click', () => {
            datasGridElement.classList.add('hidden');
            createDataForm.classList.remove('hidden');
        });
        btnVoltarDatas.addEventListener('click', () => {
            createDataForm.classList.add('hidden');
            datasGridElement.classList.remove('hidden');
        });
    }

    const btnSalvarData = document.getElementById('btn-salvar-data');
    if (btnSalvarData) {
        btnSalvarData.addEventListener('click', async () => {
            const tituloData = document.getElementById('titulo-data').value;
            const materiaData = document.getElementById('select-materia-data').value;
            const dataEntrega = document.getElementById('data-entrega').value;

            if (!tituloData.trim() || !dataEntrega) { alert("Preencha título e data."); return; }

            btnSalvarData.innerText = "Salvando...";
            btnSalvarData.disabled = true;

            const nomeAutor = currentUser.user_metadata?.full_name || 'Aluno';
            const { error } = await window.supabase.from('datas').insert([{ user_id: currentUser.id, nome_autor: nomeAutor, disciplina: materiaData, titulo: tituloData, data_entrega: dataEntrega }]);

            btnSalvarData.innerText = "SALVAR DATA +";
            btnSalvarData.disabled = false;

            if (error) alert("Erro ao salvar o evento.");
            else {
                document.getElementById('titulo-data').value = '';
                document.getElementById('data-entrega').value = '';
                createDataForm.classList.add('hidden');
                datasGridElement.classList.remove('hidden');
                carregarDatas(); 
            }
        });
    }
    
    const searchDatasInput = document.getElementById('search-datas');
    if (searchDatasInput) {
        searchDatasInput.addEventListener('input', async (e) => {
            const termo = e.target.value.trim().toLowerCase();
            const datasGrid = document.getElementById('datas-grid');
            if (termo.length === 0) { carregarDatas(); return; }
            datasGrid.innerHTML = '<p style="color: var(--navy-blue); font-weight: bold; grid-column: span 2;">Buscando...</p>';
            const { data, error } = await window.supabase.from('datas').select('*').or(`titulo.ilike.%${termo}%, disciplina.ilike.%${termo}%`).order('data_entrega', { ascending: true });
            if (error) datasGrid.innerHTML = '<p style="color: var(--salmon); font-weight: bold; grid-column: span 2;">Erro na pesquisa.</p>';
            else renderizarCardsDatas(data);
        });
    }

    const btnFecharEditData = document.getElementById('btn-fechar-edit-data');
    const editDataForm = document.getElementById('edit-data-form');
    const datasGridElementForEdit = document.getElementById('datas-grid'); 
    const datasTopBar = document.querySelector('#datas .top-bar');
    const datasSectionHeader = document.querySelector('#datas .section-header');

    if (btnFecharEditData) {
        btnFecharEditData.addEventListener('click', () => {
            editDataForm.classList.add('hidden');
            datasGridElementForEdit.classList.remove('hidden');
            datasTopBar.classList.remove('hidden');
            datasSectionHeader.classList.remove('hidden');
        });
    }

    const btnSalvarEditData = document.getElementById('btn-salvar-edit-data');
    if (btnSalvarEditData) {
        btnSalvarEditData.addEventListener('click', async () => {
            const idEvento = document.getElementById('edit-data-id').value;
            const novaMateria = document.getElementById('edit-select-materia-data').value;
            const novoTitulo = document.getElementById('edit-titulo-data').value;
            const novaDataEntrega = document.getElementById('edit-data-entrega').value;

            if (!novoTitulo.trim() || !novaDataEntrega) { alert("Preencha título e data!"); return; }

            btnSalvarEditData.innerText = "Salvando...";
            btnSalvarEditData.disabled = true;

            const { error } = await window.supabase.from('datas').update({ disciplina: novaMateria, titulo: novoTitulo, data_entrega: novaDataEntrega }).eq('id', idEvento);

            btnSalvarEditData.disabled = false;
            btnSalvarEditData.innerText = "SALVAR ALTERAÇÕES";

            if (error) alert("Erro ao editar evento.");
            else { btnFecharEditData.click(); carregarDatas(); }
        });
    }

    const btnExcluirData = document.getElementById('btn-excluir-data');
    if (btnExcluirData) {
        btnExcluirData.addEventListener('click', async () => {
            const idEvento = document.getElementById('edit-data-id').value;
            if (confirm("Tem certeza que deseja excluir este evento?")) {
                btnExcluirData.innerText = "Excluindo...";
                btnExcluirData.disabled = true;
                const { error } = await window.supabase.from('datas').delete().eq('id', idEvento);
                btnExcluirData.disabled = false;
                btnExcluirData.innerText = "EXCLUIR";
                if (error) alert("Erro ao excluir evento.");
                else { btnFecharEditData.click(); carregarDatas(); }
            }
        });
    }

    // Navegação Calendário
    const btnMesAnterior = document.getElementById('btn-mes-anterior');
    const btnMesProximo = document.getElementById('btn-mes-proximo');
    if (btnMesAnterior) btnMesAnterior.addEventListener('click', () => { dataCalendario.setMonth(dataCalendario.getMonth() - 1); renderizarCalendario(); });
    if (btnMesProximo) btnMesProximo.addEventListener('click', () => { dataCalendario.setMonth(dataCalendario.getMonth() + 1); renderizarCalendario(); });

    document.addEventListener('click', (e) => {
        const popupFalta = document.getElementById('popup-falta');
        if (popupFalta && !popupFalta.classList.contains('hidden')) {
            if (e.target.closest('div[style*="cursor: pointer"] i') || e.target.closest('div[style*="cursor: pointer"]')) { popupFalta.classList.add('hidden'); return; }
            if (!popupFalta.contains(e.target) && !e.target.closest('.calendar-grid div')) popupFalta.classList.add('hidden');
        }
    });

    const uploadInput = document.getElementById('upload-horario');
    const previewDiv = document.getElementById('horario-preview');
    if(uploadInput) {
        uploadInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if(file) {
                const reader = new FileReader();
                reader.onload = function(event) { previewDiv.innerHTML = `<img src="${event.target.result}" style="max-width: 100%; border-radius: 8px;">`; }
                reader.readAsDataURL(file);
            }
        });
    }

    const btnLogout = document.getElementById('btn-logout');
    if(btnLogout) btnLogout.addEventListener('click', async () => { await window.supabase.auth.signOut(); window.location.href = 'index.html'; });

    // Materiais
    const btnNovoMaterial = document.getElementById('btn-novo-material');
    const btnVoltarMateriais = document.getElementById('btn-voltar-materiais');
    const materiaisGridElement = document.getElementById('materiais-grid');
    const uploadMaterialForm = document.getElementById('upload-material-form');
    const materiaisHeader = document.getElementById('materiais-header');

    if(btnNovoMaterial && btnVoltarMateriais) {
        btnNovoMaterial.addEventListener('click', () => {
            materiaisGridElement.classList.add('hidden');
            if (materiaisHeader) materiaisHeader.classList.add('hidden');
            uploadMaterialForm.classList.remove('hidden');
        });
        btnVoltarMateriais.addEventListener('click', () => {
            uploadMaterialForm.classList.add('hidden');
            if (materiaisHeader) materiaisHeader.classList.remove('hidden');
            materiaisGridElement.classList.remove('hidden');
        });
    }

    const btnSalvarMaterial = document.getElementById('btn-salvar-material');
    if (btnSalvarMaterial) {
        btnSalvarMaterial.addEventListener('click', async () => {
            const tituloMaterial = document.getElementById('titulo-material').value;
            const materiaSelecionada = document.getElementById('select-materia-upload').value;
            const inputFile = document.getElementById('arquivo-material');

            if (!tituloMaterial.trim()) { alert("Por favor, dê um título ao material."); return; }
            if (!inputFile.files || inputFile.files.length === 0) { alert("Você precisa selecionar um arquivo."); return; }

            const arquivo = inputFile.files[0];
            const timestamp = new Date().getTime();
            const filePath = `${timestamp}-${arquivo.name}`;

            const textoOriginal = btnSalvarMaterial.innerText;
            btnSalvarMaterial.innerText = "Fazendo Upload... ⏳";
            btnSalvarMaterial.disabled = true;

            try {
                const { error: uploadError } = await window.supabase.storage.from('materiais-aulas').upload(filePath, arquivo);
                if (uploadError) throw new Error("Erro no upload: " + uploadError.message);

                const { data: urlData } = window.supabase.storage.from('materiais-aulas').getPublicUrl(filePath);
                const arquivoUrlPublica = urlData.publicUrl;
                const nomeAutor = currentUser.user_metadata?.full_name || 'Aluno';

                const { error: insertError } = await window.supabase.from('materiais').insert([{ user_id: currentUser.id, nome_autor: nomeAutor, disciplina: materiaSelecionada, titulo: tituloMaterial, arquivo_nome: arquivo.name, arquivo_url: arquivoUrlPublica }]);
                if (insertError) throw new Error("Erro ao salvar: " + insertError.message);

                document.getElementById('titulo-material').value = '';
                inputFile.value = '';
                btnVoltarMateriais.click();
                carregarMateriais();
            } catch (erro) { alert(erro.message); } 
            finally { btnSalvarMaterial.innerText = textoOriginal; btnSalvarMaterial.disabled = false; }
        });
    }

    const btnFecharEditMaterial = document.getElementById('btn-fechar-edit-material');
    const editMaterialForm = document.getElementById('edit-material-form');
    if (btnFecharEditMaterial) {
        btnFecharEditMaterial.addEventListener('click', () => {
            editMaterialForm.classList.add('hidden');
            document.getElementById('materiais-grid').classList.remove('hidden');
            document.getElementById('materiais-header').classList.remove('hidden');
        });
    }

    const btnSalvarEditMaterial = document.getElementById('btn-salvar-edit-material');
    if (btnSalvarEditMaterial) {
        btnSalvarEditMaterial.addEventListener('click', async () => {
            const idMaterial = document.getElementById('edit-material-id').value;
            const novaMateria = document.getElementById('edit-select-materia-material').value;
            const novoTitulo = document.getElementById('edit-titulo-material').value;

            if (!novoTitulo.trim()) { alert("Por favor, preencha o título!"); return; }

            btnSalvarEditMaterial.innerText = "Salvando...";
            btnSalvarEditMaterial.disabled = true;

            const { error } = await window.supabase.from('materiais').update({ disciplina: novaMateria, titulo: novoTitulo }).eq('id', idMaterial);

            btnSalvarEditMaterial.disabled = false;
            btnSalvarEditMaterial.innerText = "SALVAR ALTERAÇÕES";

            if (error) alert("Erro ao editar material.");
            else { btnFecharEditMaterial.click(); carregarMateriais(); }
        });
    }

    const btnExcluirMaterial = document.getElementById('btn-excluir-material');
    if (btnExcluirMaterial) {
        btnExcluirMaterial.addEventListener('click', async () => {
            const idMaterial = document.getElementById('edit-material-id').value;
            const filePath = document.getElementById('edit-material-filepath').value;
            
            if (confirm("Tem certeza que deseja excluir este material para sempre? O arquivo será deletado.")) {
                btnExcluirMaterial.innerText = "Excluindo...";
                btnExcluirMaterial.disabled = true;

                if (filePath) await window.supabase.storage.from('materiais-aulas').remove([filePath]);
                const { error } = await window.supabase.from('materiais').delete().eq('id', idMaterial);

                btnExcluirMaterial.disabled = false;
                btnExcluirMaterial.innerText = "EXCLUIR";

                if (error) alert("Erro ao excluir material.");
                else { btnFecharEditMaterial.click(); carregarMateriais(); }
            }
        });
    }

    const searchMateriaisInput = document.getElementById('search-materiais');
    if (searchMateriaisInput) {
        searchMateriaisInput.addEventListener('input', async (e) => {
            const termo = e.target.value.trim().toLowerCase();
            const grid = document.getElementById('materiais-grid');
            if (termo.length === 0) { carregarMateriais(); return; }
            grid.innerHTML = '<p style="color: var(--navy-blue); font-weight: bold; grid-column: span 2;">Buscando...</p>';
            const { data, error } = await window.supabase.from('materiais').select('*').or(`titulo.ilike.%${termo}%, disciplina.ilike.%${termo}%, arquivo_nome.ilike.%${termo}%`).order('created_at', { ascending: false });
            if (error) grid.innerHTML = '<p style="color: var(--salmon); font-weight: bold; grid-column: span 2;">Erro na pesquisa.</p>';
            else renderizarCardsMateriais(data);
        });
    }
// ==========================================
    // CONTROLES DO MENU MOBILE E OVERLAY
    // ==========================================
    const btnAbrirMenu = document.getElementById('btn-abrir-menu');
    const btnFecharMenu = document.getElementById('btn-fechar-menu');
    const menuOverlay = document.getElementById('menu-overlay');
    const sidebar = document.querySelector('.sidebar');
    const linksNavegacao = document.querySelectorAll('.nav-item');

    function fecharMenu() {
        sidebar.classList.remove('aberto');
        menuOverlay.classList.remove('aberto');
    }

    if (btnAbrirMenu && btnFecharMenu && sidebar && menuOverlay) {
        // Abre o menu e a cortina
        btnAbrirMenu.addEventListener('click', () => {
            sidebar.classList.add('aberto');
            menuOverlay.classList.add('aberto');
        });

        // Fecha ao clicar no X
        btnFecharMenu.addEventListener('click', fecharMenu);

        // Fecha ao clicar na cortina escura
        menuOverlay.addEventListener('click', fecharMenu);

        // Fecha automaticamente se clicar em alguma aba
        linksNavegacao.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    fecharMenu();
                }
            });
        });
    }

});