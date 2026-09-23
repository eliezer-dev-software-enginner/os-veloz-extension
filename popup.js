const DEFAULTS = {
  cliente: '',
  projeto: '',
  jornada: '9',
  intervalo: 500
};

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('configuracao');
  const cliente = document.getElementById('cliente');
  const projeto = document.getElementById('projeto');
  const jornada = document.getElementById('jornada');
  const intervalo = document.getElementById('intervalo');
  const salvar = document.getElementById('salvar');
  const preencher = document.getElementById('preencher');
  const status = document.getElementById('status');
  const periodoTarde = document.getElementById('periodoTarde');

  function mensagem(texto, tipo = '') {
    status.textContent = texto;
    status.className = tipo;
  }

  function lerFormulario() {
    return {
      cliente: cliente.value.trim(),
      projeto: projeto.value.trim(),
      jornada: jornada.value,
      intervalo: Number(intervalo.value)
    };
  }

  function atualizarHorario() {
    periodoTarde.textContent = jornada.value === '8' ? '13:00 — 17:00' : '13:00 — 18:00';
  }

  try {
    const dados = await chrome.storage.local.get(DEFAULTS);
    cliente.value = dados.cliente;
    projeto.value = dados.projeto;
    jornada.value = dados.jornada;
    intervalo.value = dados.intervalo;
  } catch {
    mensagem('Não foi possível carregar os dados salvos.', 'error');
  }
  atualizarHorario();

  jornada.addEventListener('change', atualizarHorario);

  salvar.addEventListener('click', async () => {
    if (!form.reportValidity()) return;
    try {
      await chrome.storage.local.set(lerFormulario());
      mensagem('Configuração salva neste navegador.', 'success');
    } catch {
      mensagem('Não foi possível salvar a configuração.', 'error');
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const configuracao = lerFormulario();
    if (!configuracao.cliente || !configuracao.projeto) return;

    preencher.disabled = true;
    mensagem('Preenchendo a ordem de serviço…');
    try {
      await chrome.storage.local.set(configuracao);
      const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!aba?.id) throw new Error('Aba ativa indisponível.');

      const execucoes = await chrome.scripting.executeScript({
        target: { tabId: aba.id, allFrames: true },
        world: 'MAIN',
        func: preencherOrdemServico,
        args: [configuracao]
      });
      const execucao = execucoes.find(item => item.result?.ok) ||
        execucoes.find(item => item.result?.encontrouTela);
      const resultado = execucao?.result;
      if (!resultado) throw new Error('Tela de períodos não encontrada nesta página.');
      mensagem(resultado.mensagem, resultado.ok ? 'success' : 'error');
    } catch (erro) {
      mensagem(erro.message || 'Não foi possível executar nesta página.', 'error');
    } finally {
      preencher.disabled = false;
    }
  });
});

async function preencherOrdemServico(configuracao) {
  const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));
  const intervalo = Math.max(50, Math.min(10000, Number(configuracao.intervalo) || 500));

  function setNativeValue(elemento, valor) {
    const proto = elemento.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (!setter) return false;
    setter.call(elemento, valor);
    elemento.dispatchEvent(new Event('input', { bubbles: true }));
    elemento.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function getTriggerByLabel(texto, raiz = document) {
    const label = [...raiz.querySelectorAll('label')]
      .find(item => item.textContent.trim().startsWith(texto));
    return label?.parentElement?.querySelector('button[role="combobox"]') || null;
  }

  function getPeriodCards() {
    return [...document.querySelectorAll('div')]
      .filter(div => String(div.className).includes('rounded-full') && /^\d+$/.test(div.textContent.trim()))
      .map(badge => ({ numero: Number(badge.textContent.trim()), card: badge.closest('.rounded-lg.border') }))
      .filter(periodo => periodo.card);
  }

  async function aguardar(procurar, limite = Math.max(3000, intervalo * 10)) {
    const inicio = Date.now();
    while (Date.now() - inicio < limite) {
      const resultado = procurar();
      if (resultado) return resultado;
      await pausa(Math.min(intervalo, 250));
    }
    return null;
  }

  async function selecionarOpcao(trigger, texto) {
    if (!trigger) return false;
    trigger.click();
    const opcao = await aguardar(() => {
      const opcoes = [...document.querySelectorAll('[role="option"]')];
      return opcoes.find(item => item.textContent.trim() === texto) ||
        opcoes.find(item => item.textContent.includes(texto));
    });
    if (!opcao) return false;
    opcao.click();
    await pausa(intervalo);
    return true;
  }

  const clienteTrigger = getTriggerByLabel('Cliente');
  if (!clienteTrigger) {
    return { ok: false, encontrouTela: false, mensagem: 'Campo Cliente não encontrado nesta página.' };
  }
  if (!await selecionarOpcao(clienteTrigger, configuracao.cliente)) {
    return { ok: false, encontrouTela: true, mensagem: `Cliente “${configuracao.cliente}” não encontrado.` };
  }

  let periodos = getPeriodCards();
  if (periodos.length < 2) {
    const adicionar = [...document.querySelectorAll('button')]
      .find(botao => botao.textContent.trim() === 'Adicionar Período');
    if (!adicionar) {
      return { ok: false, encontrouTela: true, mensagem: 'Botão Adicionar Período não encontrado.' };
    }
    adicionar.click();
    periodos = await aguardar(() => {
      const atuais = getPeriodCards();
      return atuais.length >= 2 ? atuais : null;
    });
  }

  if (!periodos || periodos.length < 2) {
    return { ok: false, encontrouTela: true, mensagem: 'O segundo período não carregou a tempo.' };
  }

  const fim = configuracao.jornada === '8' ? '17:00' : '18:00';
  const horarios = { 1: ['08:00', '12:00'], 2: ['13:00', fim] };
  for (const { numero, card } of periodos.filter(item => item.numero === 1 || item.numero === 2)) {
    if (!await selecionarOpcao(getTriggerByLabel('Projeto', card), configuracao.projeto)) {
      return { ok: false, encontrouTela: true, mensagem: `Projeto não encontrado no período ${numero}.` };
    }
    const [inicioInput, fimInput] = card.querySelectorAll('input[type="time"]');
    const [inicio, termino] = horarios[numero];
    if (!inicioInput || !fimInput) {
      return { ok: false, encontrouTela: true, mensagem: `Horários do período ${numero} não encontrados.` };
    }
    setNativeValue(inicioInput, inicio);
    setNativeValue(fimInput, termino);
    await pausa(intervalo);
  }

  return { ok: true, encontrouTela: true, mensagem: `OS preenchida para ${configuracao.jornada} horas de trabalho.` };
}
