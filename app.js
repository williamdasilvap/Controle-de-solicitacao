// ======= MODELO DE DADOS =======
let solicitacoes = [];
let registros = [];

const LS_SOL = 'pwa_solicitacoes';
const LS_REG = 'pwa_registros';

let chartRelatorio = null;
let registroAtivoId = null; // id do registro aberto (fim = null)

// ======= UTILITÁRIOS =======
function salvarDados() {
  localStorage.setItem(LS_SOL, JSON.stringify(solicitacoes));
  localStorage.setItem(LS_REG, JSON.stringify(registros));
}

function carregarDados() {
  try {
    solicitacoes = JSON.parse(localStorage.getItem(LS_SOL)) || [];
    registros = JSON.parse(localStorage.getItem(LS_REG)) || [];
  } catch (e) {
    solicitacoes = [];
    registros = [];
  }
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

function formatarDataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR');
}

function diffMinutos(inicioIso, fimIso) {
  if (!inicioIso || !fimIso) return 0;
  const ini = new Date(inicioIso);
  const fim = new Date(fimIso);
  const diffMs = fim.getTime() - ini.getTime();
  if (diffMs <= 0) return 0;
  return Math.round(diffMs / 1000 / 60);
}

function formatarDuracaoHHMM(inicioIso, fimIso) {
  const minutos = diffMinutos(inicioIso, fimIso);
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}`;
}

function minutosParaHorasDecimais(minutos) {
  return (minutos / 60).toFixed(2);
}

function toDateInputValue(date) {
  const pad = (n) => (n < 10 ? '0' + n : n);
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function toDateTimeLocalValue(date) {
  const pad = (n) => (n < 10 ? '0' + n : n);
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

// Verifica conflito de horário com outros registros (fim != null)
// retorno true = existe conflito
function existeConflito(inicioIso, fimIso, ignoreId = null) {
  const inicioNovo = new Date(inicioIso).getTime();
  const fimNovo = new Date(fimIso).getTime();
  if (isNaN(inicioNovo) || isNaN(fimNovo) || fimNovo <= inicioNovo) {
    return true;
  }

  return registros.some((r) => {
    if (!r.fim) return false; // ignora registros em aberto
    if (ignoreId && r.id === ignoreId) return false;

    const ini = new Date(r.inicio).getTime();
    const fim = new Date(r.fim).getTime();

    // sobreposição: (novoInicio < fimExistente) && (novoFim > inicioExistente)
    return inicioNovo < fim && fimNovo > ini;
  });
}

// ======= RENDERIZAÇÕES =======
function renderSolicitacoes() {
  const tbody = document.getElementById('listaSolicitacoes');
  const select = document.getElementById('selectSolicitacaoTrabalho');
  const badgeTotal = document.getElementById('badgeTotalSolicitacoes');

  tbody.innerHTML = '';
  select.innerHTML = '';

  solicitacoes.forEach((sol, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${sol.numero}</td>
      <td>${sol.descricao}</td>
      <td>${formatarDataHora(sol.criadaEm)}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-link text-decoration-none me-1" data-id="${sol.id}" data-action="edit">
          ✏️
        </button>
        <button class="btn btn-sm btn-link text-decoration-none text-danger" data-id="${sol.id}" data-action="delete">
          🗑️
        </button>
      </td>
    `;
    tbody.appendChild(tr);

    const opt = document.createElement('option');
    opt.value = sol.id;
    opt.textContent = `${sol.numero} - ${sol.descricao}`;
    select.appendChild(opt);
  });

  badgeTotal.textContent = solicitacoes.length;
  atualizarTrabalhoUI();
}

function renderRegistrosRecentes() {
  const tbody = document.getElementById('listaRegistrosRecentes');
  tbody.innerHTML = '';

  const regsOrdenados = [...registros].sort((a, b) => {
    const da = new Date(a.inicio).getTime();
    const db = new Date(b.inicio).getTime();
    return db - da;
  }).slice(0, 20);

  regsOrdenados.forEach((r) => {
    const sol = solicitacoes.find((s) => s.id === r.solicitacaoId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sol ? sol.numero : '(apagada)'}</td>
      <td>${formatarDataHora(r.inicio)}</td>
      <td>${r.fim ? formatarDataHora(r.fim) : '-'}</td>
      <td>${r.fim ? formatarDuracaoHHMM(r.inicio, r.fim) : '-'}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-link text-decoration-none me-1" data-id="${r.id}" data-action="edit-reg">
          ✏️
        </button>
        <button class="btn btn-sm btn-link text-decoration-none text-danger" data-id="${r.id}" data-action="delete-reg">
          🗑️
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function atualizarTrabalhoUI() {
  const info = document.getElementById('infoTrabalhoAtual');
  const btnIniciar = document.getElementById('btnIniciar');
  const btnFinalizar = document.getElementById('btnFinalizar');
  const select = document.getElementById('selectSolicitacaoTrabalho');

  const ativo = registros.find((r) => !r.fim);
  if (ativo) {
    registroAtivoId = ativo.id;
    const sol = solicitacoes.find((s) => s.id === ativo.solicitacaoId);
    info.innerHTML = `
      <p class="mb-1 small"><strong>Solicitação:</strong> ${sol ? sol.numero + ' - ' + sol.descricao : 'não encontrada'}</p>
      <p class="mb-1 small"><strong>Início:</strong> ${formatarDataHora(ativo.inicio)}</p>
      <p class="mb-0 small text-danger">Trabalho em andamento...</p>
    `;
    btnIniciar.disabled = true;
    btnFinalizar.disabled = false;
    if (sol) {
      select.value = sol.id;
    }
  } else {
    registroAtivoId = null;
    info.innerHTML = '<span class="text-muted small">Nenhum trabalho em andamento.</span>';
    btnIniciar.disabled = solicitacoes.length === 0;
    btnFinalizar.disabled = true;
  }

  renderRegistrosRecentes();
}

function gerarRelatorio() {
  const dataInicioStr = document.getElementById('dataInicioRel').value;
  const dataFimStr = document.getElementById('dataFimRel').value;
  const tipo = document.querySelector('input[name="tipoRel"]:checked').value;
  const colunaChaveRel = document.getElementById('colunaChaveRel');
  const tabelaBody = document.getElementById('tabelaRelatorio');

  tabelaBody.innerHTML = '';

  let dtIni = dataInicioStr ? new Date(dataInicioStr + 'T00:00:00') : null;
  let dtFim = dataFimStr ? new Date(dataFimStr + 'T23:59:59') : null;

  const registrosFinalizados = registros.filter((r) => r.fim);

  const regsFiltrados = registrosFinalizados.filter((r) => {
    const di = new Date(r.inicio);
    if (dtIni && di < dtIni) return false;
    if (dtFim && di > dtFim) return false;
    return true;
  });

  if (tipo === 'dia') {
    colunaChaveRel.textContent = 'Dia';
    const mapaMinutos = {};
    regsFiltrados.forEach((r) => {
      const d = new Date(r.inicio);
      const chave = toDateInputValue(d);
      const minutos = diffMinutos(r.inicio, r.fim);
      mapaMinutos[chave] = (mapaMinutos[chave] || 0) + minutos;
    });

    const labels = Object.keys(mapaMinutos).sort();
    const dadosHoras = labels.map((k) => minutosParaHorasDecimais(mapaMinutos[k]));

    labels.forEach((label) => {
      const minutos = mapaMinutos[label];
      const h = Math.floor(minutos / 60);
      const m = minutos % 60;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${label}</td>
        <td>${hh}:${mm}</td>
      `;
      tabelaBody.appendChild(tr);
    });

    desenharGrafico(labels, dadosHoras, 'Horas por dia');
  } else {
    colunaChaveRel.textContent = 'Solicitação';
    const mapaMinutos = {};
    regsFiltrados.forEach((r) => {
      const sol = solicitacoes.find((s) => s.id === r.solicitacaoId);
      const chave = sol ? `${sol.numero} - ${sol.descricao}` : 'Solicitação apagada';
      const minutos = diffMinutos(r.inicio, r.fim);
      mapaMinutos[chave] = (mapaMinutos[chave] || 0) + minutos;
    });

    const labels = Object.keys(mapaMinutos);
    const dadosHoras = labels.map((k) => minutosParaHorasDecimais(mapaMinutos[k]));

    labels.forEach((label) => {
      const minutos = mapaMinutos[label];
      const h = Math.floor(minutos / 60);
      const m = minutos % 60;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${label}</td>
        <td>${hh}:${mm}</td>
      `;
      tabelaBody.appendChild(tr);
    });

    desenharGrafico(labels, dadosHoras, 'Horas por solicitação');
  }
}

function desenharGrafico(labels, dados, titulo) {
  const ctx = document.getElementById('graficoRelatorio').getContext('2d');
  if (chartRelatorio) {
    chartRelatorio.destroy();
  }
  chartRelatorio = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: titulo,
        data: dados
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: titulo }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// ======= BACKUP =======
function exportarBackup() {
  const backup = {
    solicitacoes,
    registros
  };
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'backup_horas_solicitacoes.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importarBackup(arquivo) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.solicitacoes || !data.registros) {
        alert('Arquivo de backup inválido.');
        return;
      }
      solicitacoes = data.solicitacoes;
      registros = data.registros;
      salvarDados();
      renderSolicitacoes();
      renderRegistrosRecentes();
      atualizarTrabalhoUI();
      alert('Backup importado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao importar backup.');
    }
  };
  reader.readAsText(arquivo);
}

// ======= EVENTOS =======
document.addEventListener('DOMContentLoaded', () => {
  carregarDados();
  renderSolicitacoes();
  renderRegistrosRecentes();
  atualizarTrabalhoUI();

  // Form nova solicitação
  document.getElementById('formSolicitacao').addEventListener('submit', (e) => {
    e.preventDefault();
    const numero = document.getElementById('numeroSolicitacao').value.trim();
    const descricao = document.getElementById('descricaoSolicitacao').value.trim();
    if (!numero || !descricao) return;

    const nova = {
      id: uuid(),
      numero,
      descricao,
      criadaEm: new Date().toISOString()
    };
    solicitacoes.push(nova);
    salvarDados();
    renderSolicitacoes();

    e.target.reset();
  });

  // Clique na tabela de solicitações (editar / excluir)
  document.getElementById('listaSolicitacoes').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    const sol = solicitacoes.find((s) => s.id === id);
    if (!sol) return;

    if (action === 'edit') {
      document.getElementById('editSolicitacaoId').value = sol.id;
      document.getElementById('editNumeroSolicitacao').value = sol.numero;
      document.getElementById('editDescricaoSolicitacao').value = sol.descricao;
      const modalEl = document.getElementById('modalSolicitacao');
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    } else if (action === 'delete') {
      const temRegistros = registros.some((r) => r.solicitacaoId === id);
      const msgExtra = temRegistros ? '\\n\\nAtenção: todos os registros de horas desta solicitação também serão removidos.' : '';
      if (confirm('Deseja realmente excluir esta solicitação?' + msgExtra)) {
        solicitacoes = solicitacoes.filter((s) => s.id !== id);
        if (temRegistros) {
          registros = registros.filter((r) => r.solicitacaoId !== id);
        }
        salvarDados();
        renderSolicitacoes();
        renderRegistrosRecentes();
        atualizarTrabalhoUI();
      }
    }
  });

  // Salvar edição de solicitação
  document.getElementById('btnSalvarSolicitacaoEdit').addEventListener('click', () => {
    const id = document.getElementById('editSolicitacaoId').value;
    const numero = document.getElementById('editNumeroSolicitacao').value.trim();
    const descricao = document.getElementById('editDescricaoSolicitacao').value.trim();
    if (!id || !numero || !descricao) return;
    const sol = solicitacoes.find((s) => s.id === id);
    if (!sol) return;

    sol.numero = numero;
    sol.descricao = descricao;
    salvarDados();
    renderSolicitacoes();
    renderRegistrosRecentes();
    atualizarTrabalhoUI();

    const modalEl = document.getElementById('modalSolicitacao');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
  });

  // Iniciar trabalho
  document.getElementById('btnIniciar').addEventListener('click', () => {
    if (registroAtivoId) {
      alert('Já existe um trabalho em andamento. Finalize antes de iniciar outro.');
      return;
    }
    const select = document.getElementById('selectSolicitacaoTrabalho');
    const solId = select.value;
    if (!solId) {
      alert('Selecione uma solicitação.');
      return;
    }

    const reg = {
      id: uuid(),
      solicitacaoId: solId,
      inicio: new Date().toISOString(),
      fim: null
    };
    registros.push(reg);
    salvarDados();
    atualizarTrabalhoUI();
  });

  // Finalizar trabalho (abrir modal)
  document.getElementById('btnFinalizar').addEventListener('click', () => {
    const ativo = registros.find((r) => r.id === registroAtivoId && !r.fim);
    if (!ativo) {
      alert('Nenhum trabalho em andamento.');
      return;
    }
    const inicioDate = new Date(ativo.inicio);
    const fimDate = new Date();

    document.getElementById('registroEditId').value = ativo.id;
    document.getElementById('inicioEdit').value = toDateTimeLocalValue(inicioDate);
    document.getElementById('fimEdit').value = toDateTimeLocalValue(fimDate);
    document.getElementById('tituloModalRegistro').textContent = 'Finalizar trabalho / ajustar horários';

    const modalEl = document.getElementById('modalRegistro');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  });

  // Clique na tabela de registros (editar / excluir)
  document.getElementById('listaRegistrosRecentes').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    const reg = registros.find((r) => r.id === id);
    if (!reg) return;

    if (action === 'edit-reg') {
      if (!reg.fim) {
        alert('Para editar este registro, finalize-o primeiro.');
        return;
      }
      document.getElementById('registroEditId').value = reg.id;
      document.getElementById('inicioEdit').value = toDateTimeLocalValue(new Date(reg.inicio));
      document.getElementById('fimEdit').value = toDateTimeLocalValue(new Date(reg.fim));
      document.getElementById('tituloModalRegistro').textContent = 'Editar registro de horas';

      const modalEl = document.getElementById('modalRegistro');
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    } else if (action === 'delete-reg') {
      if (confirm('Deseja realmente excluir este registro de horas?')) {
        registros = registros.filter((r) => r.id !== id);
        if (registroAtivoId === id) {
          registroAtivoId = null;
        }
        salvarDados();
        renderRegistrosRecentes();
        atualizarTrabalhoUI();
      }
    }
  });

  // Salvar finalização / edição de registro
  document.getElementById('btnSalvarRegistro').addEventListener('click', () => {
    const id = document.getElementById('registroEditId').value;
    const inicioStr = document.getElementById('inicioEdit').value;
    const fimStr = document.getElementById('fimEdit').value;

    if (!id || !inicioStr || !fimStr) {
      alert('Preencha os horários de início e fim.');
      return;
    }

    const inicio = new Date(inicioStr);
    const fim = new Date(fimStr);
    if (fim <= inicio) {
      alert('O horário de fim deve ser maior que o de início.');
      return;
    }

    const inicioIso = inicio.toISOString();
    const fimIso = fim.toISOString();

    if (existeConflito(inicioIso, fimIso, id)) {
      alert('Existe conflito de horário com outro registro. Ajuste os horários.');
      return;
    }

    const reg = registros.find((r) => r.id === id);
    if (!reg) {
      alert('Registro não encontrado.');
      return;
    }

    reg.inicio = inicioIso;
    reg.fim = fimIso;
    salvarDados();
    atualizarTrabalhoUI();

    const modalEl = document.getElementById('modalRegistro');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
  });

  // Botão gerar relatório
  document.getElementById('btnGerarRelatorio').addEventListener('click', () => {
    gerarRelatorio();
  });

  // Exportar backup
  document.getElementById('btnExportarBackup').addEventListener('click', () => {
    exportarBackup();
  });

  // Importar backup
  document.getElementById('btnImportarBackup').addEventListener('click', () => {
    const input = document.getElementById('inputImportarBackup');
    if (!input.files || !input.files[0]) {
      alert('Selecione um arquivo de backup.');
      return;
    }
    importarBackup(input.files[0]);
  });
});
