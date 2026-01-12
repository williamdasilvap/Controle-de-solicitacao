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

function formatarDuracaoHoras(inicioIso, fimIso) {
  if (!inicioIso || !fimIso) return '';
  const ini = new Date(inicioIso);
  const fim = new Date(fimIso);
  const diffMs = fim.getTime() - ini.getTime();
  if (diffMs <= 0) return '0';
  const horas = diffMs / 1000 / 60 / 60;
  return horas.toFixed(2);
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

// ======= RENDERIZAÇÕES =======
function renderSolicitacoes() {
  const tbody = document.getElementById('listaSolicitacoes');
  const select = document.getElementById('selectSolicitacaoTrabalho');

  tbody.innerHTML = '';
  select.innerHTML = '';

  solicitacoes.forEach((sol, index) => {
    // tabela
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${sol.numero}</td>
      <td>${sol.descricao}</td>
      <td>${formatarDataHora(sol.criadaEm)}</td>
    `;
    tbody.appendChild(tr);

    // select
    const opt = document.createElement('option');
    opt.value = sol.id;
    opt.textContent = `${sol.numero} - ${sol.descricao}`;
    select.appendChild(opt);
  });

  atualizarTrabalhoUI();
}

function renderRegistrosRecentes() {
  const tbody = document.getElementById('listaRegistrosRecentes');
  tbody.innerHTML = '';

  const regsOrdenados = [...registros].sort((a, b) => {
    const da = new Date(a.inicio).getTime();
    const db = new Date(b.inicio).getTime();
    return db - da;
  }).slice(0, 10);

  regsOrdenados.forEach((r) => {
    const sol = solicitacoes.find((s) => s.id === r.solicitacaoId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sol ? sol.numero : '(apagada)'}</td>
      <td>${formatarDataHora(r.inicio)}</td>
      <td>${r.fim ? formatarDataHora(r.fim) : '-'}</td>
      <td>${r.fim ? formatarDuracaoHoras(r.inicio, r.fim) : '-'}</td>
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
      <p><strong>Solicitação:</strong> ${sol ? sol.numero + ' - ' + sol.descricao : 'não encontrada'}</p>
      <p><strong>Início:</strong> ${formatarDataHora(ativo.inicio)}</p>
      <p class="text-danger">Trabalho em andamento...</p>
    `;
    btnIniciar.disabled = true;
    btnFinalizar.disabled = false;
    if (sol) {
      select.value = sol.id;
    }
  } else {
    registroAtivoId = null;
    info.textContent = 'Nenhum trabalho em andamento.';
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

  // Filtra por período usando a data de início do registro
  const regsFiltrados = registrosFinalizados.filter((r) => {
    const di = new Date(r.inicio);
    if (dtIni && di < dtIni) return false;
    if (dtFim && di > dtFim) return false;
    return true;
  });

  if (tipo === 'dia') {
    colunaChaveRel.textContent = 'Dia';
    const mapa = {};
    regsFiltrados.forEach((r) => {
      const d = new Date(r.inicio);
      const chave = toDateInputValue(d); // yyyy-mm-dd
      const horas = parseFloat(formatarDuracaoHoras(r.inicio, r.fim)) || 0;
      mapa[chave] = (mapa[chave] || 0) + horas;
    });

    const labels = Object.keys(mapa).sort();
    const dados = labels.map((k) => mapa[k].toFixed(2));

    labels.forEach((label) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${label}</td>
        <td>${mapa[label].toFixed(2)}</td>
      `;
      tabelaBody.appendChild(tr);
    });

    desenharGrafico(labels, dados, 'Horas por dia');
  } else {
    colunaChaveRel.textContent = 'Solicitação';
    const mapa = {};
    regsFiltrados.forEach((r) => {
      const sol = solicitacoes.find((s) => s.id === r.solicitacaoId);
      const chave = sol ? `${sol.numero} - ${sol.descricao}` : 'Solicitação apagada';
      const horas = parseFloat(formatarDuracaoHoras(r.inicio, r.fim)) || 0;
      mapa[chave] = (mapa[chave] || 0) + horas;
    });

    const labels = Object.keys(mapa);
    const dados = labels.map((k) => mapa[k].toFixed(2));

    labels.forEach((label) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${label}</td>
        <td>${mapa[label].toFixed(2)}</td>
      `;
      tabelaBody.appendChild(tr);
    });

    desenharGrafico(labels, dados, 'Horas por solicitação');
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

    document.getElementById('inicioEdit').value = toDateTimeLocalValue(inicioDate);
    document.getElementById('fimEdit').value = toDateTimeLocalValue(fimDate);

    const modalEl = document.getElementById('modalFinalizar');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  });

  // Salvar finalização após editar horários
  document.getElementById('btnSalvarFinalizar').addEventListener('click', () => {
    const inicioStr = document.getElementById('inicioEdit').value;
    const fimStr = document.getElementById('fimEdit').value;
    if (!inicioStr || !fimStr) {
      alert('Preencha os horários de início e fim.');
      return;
    }
    const inicio = new Date(inicioStr);
    const fim = new Date(fimStr);
    if (fim <= inicio) {
      alert('O horário de fim deve ser maior que o de início.');
      return;
    }

    const ativo = registros.find((r) => r.id === registroAtivoId && !r.fim);
    if (!ativo) {
      alert('Nenhum trabalho em andamento.');
      return;
    }

    ativo.inicio = inicio.toISOString();
    ativo.fim = fim.toISOString();
    salvarDados();
    atualizarTrabalhoUI();

    const modalEl = document.getElementById('modalFinalizar');
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
